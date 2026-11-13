// test/route-wrappers.test.ts
// The route helpers in server/api.ts, tested without a database. Only the session is replaced.
// If these tests pass in your project, the helpers are installed correctly.
import { beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { adminRoute, cronRoute, publicRoute, userRoute, webhookRoute } from "@/server/api"
import { read, request, sign, withParams } from "./helpers/http"

type TestUser = { id: string; email: string; role: "user" | "admin" }
const held = vi.hoisted(() => ({ user: null as TestUser | null }))

vi.mock("@/server/auth", async () => {
  const { AppError } = await import("@/lib/errors")
  const requireUser = async () => {
    if (!held.user) throw new AppError("UNAUTHORIZED", "Please sign in.")
    return held.user
  }
  const requireAdmin = async () => {
    const user = await requireUser()
    if (user.role !== "admin") throw new AppError("FORBIDDEN", "You do not have access to this.")
    return user
  }
  return { requireUser, requireAdmin }
})

const alice: TestUser = { id: "11111111-1111-4111-8111-111111111111", email: "alice@example.com", role: "user" }
const ID = "9b2f6f0e-8c53-4b7e-9a3a-0e8f8f1a2b3c"

beforeEach(() => {
  held.user = alice
})

describe("userRoute", () => {
  const schemas = {
    params: z.object({ id: z.uuid() }),
    query: z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) }),
    body: z.object({ title: z.string().trim().min(1).max(50) }),
  }
  const seen: unknown[] = []
  const route = userRoute(schemas, async (args) => {
    seen.push({ user: args.user.id, params: args.params, query: args.query, body: args.body })
    return { saved: true }
  })
  const call = async (path = `/api/things/${ID}`, options: Parameters<typeof request>[2] = { body: { title: "Hello" } }, id = ID) =>
    read(await route(request("POST", path, options), withParams({ id })))

  beforeEach(() => {
    seen.length = 0
  })

  it("passes the session user and the parsed params, query and body to the handler", async () => {
    const res = await call(`/api/things/${ID}?limit=5`, { body: { title: "  Hello  " } })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ data: { saved: true } })
    expect(seen).toEqual([{ user: alice.id, params: { id: ID }, query: { limit: 5 }, body: { title: "Hello" } }])
  })

  it("answers 401 with the standard error shape when signed out, and does not run the handler", async () => {
    held.user = null
    const res = await call()
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: { code: "UNAUTHORIZED", message: "Please sign in." } })
    expect(seen).toHaveLength(0)
  })

  it("answers 400 with field messages for a bad body, query or id, and does not run the handler", async () => {
    const badBody = await call(undefined, { body: { title: "" } })
    expect(badBody.status).toBe(400)
    expect(badBody.body?.error?.code).toBe("VALIDATION")
    expect(badBody.body?.error?.fields).toHaveProperty("title")
    expect((await call(`/api/things/${ID}?limit=1000`)).status).toBe(400)
    expect((await call(undefined, undefined, "not-a-uuid")).status).toBe(400)
    expect(seen).toHaveLength(0)
  })

  it("drops fields the schema does not list (no mass assignment)", async () => {
    await call(undefined, { body: { title: "x", userId: "someone-else", role: "admin" } })
    expect(seen[0]).toMatchObject({ body: { title: "x" } })
    expect((seen[0] as { body: object }).body).not.toHaveProperty("userId")
    expect((seen[0] as { body: object }).body).not.toHaveProperty("role")
  })

  it("answers 415 for a body that is not JSON, 400 for broken JSON and 413 for a huge body", async () => {
    expect((await call(undefined, { raw: "title=x", headers: { "content-type": "text/plain" } })).status).toBe(415)
    const broken = await call(undefined, { raw: "{ not json", headers: { "content-type": "application/json" } })
    expect(broken.status).toBe(400)
    expect(broken.text).not.toMatch(/Unexpected token|position \d+/)
    const huge = await call(undefined, { raw: JSON.stringify({ title: "x".repeat(1_100_000) }), headers: { "content-type": "application/json" } })
    expect(huge.status).toBe(413)
    expect(seen).toHaveLength(0)
  })

  it("refuses a cross-site request that carries cookies, and accepts the same site", async () => {
    const cross = await call(undefined, { body: { title: "x" }, headers: { cookie: "session=abc", origin: "https://evil.example", host: "localhost:3000" } })
    expect(cross.status).toBe(403)
    const same = await call(undefined, { body: { title: "x" }, headers: { cookie: "session=abc", origin: "http://localhost:3000", host: "localhost:3000" } })
    expect(same.status).toBe(200)
    // API clients send no cookie, so no Origin check applies
    expect((await call(undefined, { body: { title: "x" }, headers: { origin: "https://other.example" } })).status).toBe(200)
  })

  it("never lets a response be cached", async () => {
    expect((await call()).headers.get("cache-control")).toBe("private, no-store")
  })

  it("turns a bug into a plain 500 and keeps the details in the log", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const broken = userRoute({}, async () => {
      throw new Error("connect ECONNREFUSED 10.0.0.5:5432 password=hunter2")
    })
    const res = await read(await broken(request("GET", "/api/x")))
    expect(res.status).toBe(500)
    expect(res.body?.error?.code).toBe("INTERNAL")
    expect(res.text).not.toMatch(/hunter2|ECONNREFUSED|10\.0\.0\.5/)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe("adminRoute", () => {
  it("answers 403 for a normal user, 401 when signed out and 200 for an admin", async () => {
    const route = adminRoute({}, async () => ({ secret: true }))
    expect((await read(await route(request("GET", "/api/admin")))).status).toBe(403)
    held.user = null
    expect((await read(await route(request("GET", "/api/admin")))).status).toBe(401)
    held.user = { ...alice, role: "admin" }
    expect((await read(await route(request("GET", "/api/admin")))).status).toBe(200)
  })
})

describe("publicRoute", () => {
  it("works signed out and does not look at the session", async () => {
    held.user = null
    const route = publicRoute({}, async ({ user }) => ({ user }))
    const res = await read(await route(request("GET", "/api/public")))
    expect(res).toMatchObject({ status: 200, body: { data: { user: null } } })
  })

  it("answers 429 with Retry-After after the limit, counted per client address", async () => {
    const route = publicRoute({}, async () => ({ ok: true }), { rateLimit: { key: "test.wrappers.limit", limit: 2, windowSeconds: 60 } })
    const a = { "x-forwarded-for": "203.0.113.9" }
    expect((await route(request("GET", "/api/x", { headers: a }))).status).toBe(200)
    expect((await route(request("GET", "/api/x", { headers: a }))).status).toBe(200)
    const third = await route(request("GET", "/api/x", { headers: a }))
    expect(third.status).toBe(429)
    expect(Number(third.headers.get("retry-after"))).toBeGreaterThan(0)
    // another address has its own count
    expect((await route(request("GET", "/api/x", { headers: { "x-forwarded-for": "203.0.113.10" } }))).status).toBe(200)
  })
})

describe("webhookRoute", () => {
  const SECRET = "whsec_test_0123456789abcdef"
  const handled: unknown[] = []
  const route = webhookRoute({ secret: () => SECRET, body: z.object({ id: z.string().min(1).max(100), type: z.string().max(100) }) }, async ({ event }) => {
    handled.push(event)
    return { received: true }
  })
  const post = async (raw: string, signature: string | null = sign(raw, SECRET)) =>
    read(await route(request("POST", "/api/webhooks/x", { raw, headers: signature ? { "x-signature": signature } : {} })))

  beforeEach(() => {
    handled.length = 0
  })

  it("runs the handler with the parsed event when the signature is right", async () => {
    const raw = JSON.stringify({ id: "evt_1", type: "thing.created", extra: "dropped" })
    const res = await post(raw)
    expect(res).toMatchObject({ status: 200, body: { data: { received: true } } })
    expect(handled).toEqual([{ id: "evt_1", type: "thing.created" }])
  })

  it("answers 401 and does not run the handler for a missing, wrong or old signature", async () => {
    const raw = JSON.stringify({ id: "evt_1", type: "thing.created" })
    expect((await post(raw, null)).status).toBe(401)
    expect((await post(raw, sign(raw, "another-secret-0123456789"))).status).toBe(401)
    expect((await post(raw, sign(raw, SECRET, Math.floor(Date.now() / 1000) - 3600))).status).toBe(401)
    expect((await post(raw + " ")).status).toBe(200) // signed again over the changed text, so valid
    expect((await post(raw, sign(raw + " ", SECRET))).status).toBe(401) // signature of other text
    expect(handled).toHaveLength(1)
  })

  it("answers 400 for a body that is signed but is not valid JSON or has the wrong shape", async () => {
    expect((await post("not json")).status).toBe(400)
    expect((await post(JSON.stringify({ id: "", type: "x" }))).status).toBe(400)
    expect(handled).toHaveLength(0)
  })

  it("answers 413 for a huge body before any work is done", async () => {
    const raw = JSON.stringify({ id: "evt_1", type: "x".repeat(300_000) })
    expect((await post(raw)).status).toBe(413)
    expect(handled).toHaveLength(0)
  })
})

describe("cronRoute", () => {
  const CRON = "cron-secret-0123456789"
  const runs: number[] = []
  const handler = cronRoute({ secret: () => CRON }, async () => {
    runs.push(1)
    return { processed: 3 }
  })
  const call = async (headers: Record<string, string> = {}) => read(await handler(request("GET", "/api/cron/cleanup", { headers })))

  beforeEach(() => {
    runs.length = 0
  })

  it("runs the job when the bearer token is right", async () => {
    const res = await call({ authorization: `Bearer ${CRON}` })
    expect(res.status).toBe(200)
    expect(res.body?.data).toEqual({ processed: 3 })
    expect(runs).toHaveLength(1)
  })

  it.each([
    ["no header", {}],
    ["a wrong token", { authorization: "Bearer not-the-secret" }],
    ["the secret without the Bearer prefix", { authorization: CRON }],
    ["a different scheme", { authorization: `Basic ${CRON}` }],
    ["an empty header", { authorization: "" }],
  ])("answers 401 and does not run the job with %s", async (_name, headers) => {
    const res = await call(headers)
    expect(res.status).toBe(401)
    expect(res.body?.error?.code).toBe("UNAUTHORIZED")
    expect(runs).toHaveLength(0)
  })

  it("fails closed when no secret is configured, even if the caller sends an empty bearer token", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    for (const secret of [undefined, ""]) {
      const unconfigured = cronRoute({ secret: () => secret }, async () => {
        runs.push(1)
        return {}
      })
      const res = await read(await unconfigured(request("GET", "/api/cron/cleanup", { headers: { authorization: "Bearer " } })))
      expect(res.status).toBe(500)
      expect(res.body?.error?.code).toBe("INTERNAL")
      expect(res.text).not.toContain("secret is not set")
    }
    expect(runs).toHaveLength(0)
    expect(log).toHaveBeenCalled()
    log.mockRestore()
  })
})
