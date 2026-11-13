// test/api.test.ts
// Route handlers, called directly. Auth and the database are replaced, everything else is real.
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { adminRoute, publicRoute } from "@/server/api"
import type { Db } from "@/server/db"
import { invoices, payments } from "@/server/db/schema"
import * as invoiceById from "@/app/api/invoices/[id]/route"
import * as invoiceList from "@/app/api/invoices/route"
import * as paymentWebhook from "@/app/api/webhooks/payments/route"
import { createTestDb, emptyTables, seedUser } from "./helpers/db"
import { read, request, sign, withParams } from "./helpers/http"

type TestUser = { id: string; email: string; role: "user" | "admin" }
const held = vi.hoisted(() => ({ db: undefined as unknown, user: null as TestUser | null }))

vi.mock("@/server/db", () => ({
  get db() {
    return held.db
  },
}))
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

const SECRET = "test-webhook-secret-0123456789"
const invoiceBody = { number: "INV-001", customerName: "Northwind Traders", amountCents: 125_000, dueDate: "2026-12-01" }

let db: Db
let close: () => Promise<void>
let alice: TestUser
let bob: TestUser

beforeAll(async () => {
  ;({ db, close } = await createTestDb())
  held.db = db
})
afterAll(() => close())
beforeEach(async () => {
  await emptyTables(db)
  alice = { ...(await seedUser(db, "alice@example.com")), role: "user" }
  bob = { ...(await seedUser(db, "bob@example.com")), role: "user" }
  held.user = alice
})

async function createFor(user: TestUser, overrides: Record<string, unknown> = {}) {
  const previous = held.user
  held.user = user
  const res = await read(await invoiceList.POST(request("POST", "/api/invoices", { body: { ...invoiceBody, ...overrides } })))
  held.user = previous
  return res.body?.data as { id: string }
}

describe("signed out", () => {
  beforeEach(() => {
    held.user = null
  })
  it("every invoice route answers 401 with the standard error shape", async () => {
    const id = "9b2f6f0e-8c53-4b7e-9a3a-0e8f8f1a2b3c"
    const calls = [
      () => invoiceList.GET(request("GET", "/api/invoices")),
      () => invoiceList.POST(request("POST", "/api/invoices", { body: invoiceBody })),
      () => invoiceById.GET(request("GET", `/api/invoices/${id}`), withParams({ id })),
      () => invoiceById.PATCH(request("PATCH", `/api/invoices/${id}`, { body: { customerName: "x" } }), withParams({ id })),
      () => invoiceById.DELETE(request("DELETE", `/api/invoices/${id}`), withParams({ id })),
    ]
    for (const call of calls) {
      const res = await read(await call())
      expect(res.status).toBe(401)
      expect(res.body?.error?.code).toBe("UNAUTHORIZED")
    }
  })
})

describe("create", () => {
  it("returns 201 and the invoice, and is never cached", async () => {
    const res = await read(await invoiceList.POST(request("POST", "/api/invoices", { body: invoiceBody })))
    expect(res.status).toBe(201)
    expect(res.body?.data).toMatchObject({ number: "INV-001", currency: "USD", status: "draft" })
    expect(res.headers.get("cache-control")).toContain("no-store")
  })

  it("returns 400 with field messages when the input is wrong", async () => {
    const res = await read(await invoiceList.POST(request("POST", "/api/invoices", { body: { ...invoiceBody, amountCents: -1, customerName: "" } })))
    expect(res.status).toBe(400)
    expect(res.body?.error?.code).toBe("VALIDATION")
    expect(Object.keys(res.body?.error?.fields ?? {}).sort()).toEqual(["amountCents", "customerName"])
  })

  it("returns 400 for broken JSON and does not leak parser details", async () => {
    const res = await read(await invoiceList.POST(request("POST", "/api/invoices", { raw: "{not json", headers: { "content-type": "application/json" } })))
    expect(res.status).toBe(400)
    expect(res.text).not.toMatch(/SyntaxError|Unexpected|position/i)
  })

  it("returns 415 when the body is not JSON", async () => {
    const res = await read(await invoiceList.POST(request("POST", "/api/invoices", { raw: "hello", headers: { "content-type": "text/plain" } })))
    expect(res.status).toBe(415)
  })

  it("returns 413 when the body is too big", async () => {
    const big = JSON.stringify({ ...invoiceBody, customerName: "x".repeat(1_100_000) })
    const res = await read(await invoiceList.POST(request("POST", "/api/invoices", { raw: big, headers: { "content-type": "application/json" } })))
    expect(res.status).toBe(413)
  })

  it("returns 409 for a duplicate number", async () => {
    await createFor(alice)
    const res = await read(await invoiceList.POST(request("POST", "/api/invoices", { body: invoiceBody })))
    expect(res.status).toBe(409)
    expect(res.body?.error?.code).toBe("CONFLICT")
  })
})

describe("read, update, delete", () => {
  it("lists with limit and offset, and refuses a limit above 100", async () => {
    for (let i = 1; i <= 3; i++) await createFor(alice, { number: `INV-00${i}` })
    const page = await read(await invoiceList.GET(request("GET", "/api/invoices?limit=2")))
    expect(page.status).toBe(200)
    expect(page.body?.data.items).toHaveLength(2)
    expect(page.body?.data.total).toBe(3)
    expect((await read(await invoiceList.GET(request("GET", "/api/invoices?limit=101")))).status).toBe(400)
    expect((await read(await invoiceList.GET(request("GET", "/api/invoices?status=bogus")))).status).toBe(400)
  })

  it("another user's invoice is a 404 for get, patch and delete, and stays unchanged", async () => {
    const theirs = await createFor(bob)
    const { id } = theirs
    expect((await read(await invoiceById.GET(request("GET", `/api/invoices/${id}`), withParams({ id })))).status).toBe(404)
    expect((await read(await invoiceById.PATCH(request("PATCH", `/api/invoices/${id}`, { body: { customerName: "Hacked" } }), withParams({ id })))).status).toBe(404)
    expect((await read(await invoiceById.DELETE(request("DELETE", `/api/invoices/${id}`), withParams({ id })))).status).toBe(404)
    const [row] = await db.select().from(invoices).where(eq(invoices.id, id))
    expect(row?.customerName).toBe("Northwind Traders")
  })

  it("a bad id is a 400", async () => {
    const res = await read(await invoiceById.GET(request("GET", "/api/invoices/nope"), withParams({ id: "nope" })))
    expect(res.status).toBe(400)
  })

  it("patch ignores userId and other unknown fields", async () => {
    const { id } = await createFor(alice)
    const res = await read(
      await invoiceById.PATCH(request("PATCH", `/api/invoices/${id}`, { body: { customerName: "Contoso", userId: bob.id, status: "sent" } }), withParams({ id })),
    )
    expect(res.status).toBe(200)
    expect(res.body?.data.customerName).toBe("Contoso")
    const [row] = await db.select().from(invoices).where(eq(invoices.id, id))
    expect(row?.userId).toBe(alice.id)
  })

  it("patch cannot mark an invoice as paid", async () => {
    const { id } = await createFor(alice)
    const res = await read(await invoiceById.PATCH(request("PATCH", `/api/invoices/${id}`, { body: { status: "paid" } }), withParams({ id })))
    expect(res.status).toBe(400)
  })

  it("delete returns 204 with no body", async () => {
    const { id } = await createFor(alice)
    const res = await invoiceById.DELETE(request("DELETE", `/api/invoices/${id}`), withParams({ id }))
    expect(res.status).toBe(204)
    expect(await res.text()).toBe("")
  })
})

describe("what the wrappers guarantee", () => {
  it("refuses a cross-site request that carries cookies", async () => {
    const res = await read(
      await invoiceList.POST(request("POST", "/api/invoices", { body: invoiceBody, headers: { cookie: "session=abc", origin: "https://evil.example", host: "localhost:3000" } })),
    )
    expect(res.status).toBe(403)
    const same = await read(
      await invoiceList.POST(request("POST", "/api/invoices", { body: invoiceBody, headers: { cookie: "session=abc", origin: "http://localhost:3000", host: "localhost:3000" } })),
    )
    expect(same.status).toBe(201)
  })

  it("adminRoute refuses a normal user with 403", async () => {
    const route = adminRoute({}, async () => ({ secret: true }))
    const res = await read(await route(request("GET", "/api/admin/stats")))
    expect(res.status).toBe(403)
    held.user = { ...alice, role: "admin" }
    expect((await read(await route(request("GET", "/api/admin/stats")))).status).toBe(200)
  })

  it("rate limit answers 429 with Retry-After", async () => {
    const route = publicRoute({}, async () => ({ ok: true }), { rateLimit: { key: "test.limit", limit: 2, windowSeconds: 60 } })
    const headers = { "x-forwarded-for": "203.0.113.9" }
    expect((await route(request("GET", "/api/x", { headers }))).status).toBe(200)
    expect((await route(request("GET", "/api/x", { headers }))).status).toBe(200)
    const third = await route(request("GET", "/api/x", { headers }))
    expect(third.status).toBe(429)
    expect(Number(third.headers.get("retry-after"))).toBeGreaterThan(0)
  })

  it("a bug becomes a plain 500 and the details stay in the log", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const route = publicRoute({}, async () => {
      throw new Error("connect ECONNREFUSED 10.0.0.5:5432 password=hunter2")
    })
    const res = await read(await route(request("GET", "/api/x")))
    expect(res.status).toBe(500)
    expect(res.body?.error?.code).toBe("INTERNAL")
    expect(res.text).not.toMatch(/hunter2|ECONNREFUSED|10\.0\.0\.5/)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe("payment webhook", () => {
  const post = (raw: string, signature: string | null = sign(raw, SECRET)) =>
    paymentWebhook.POST(request("POST", "/api/webhooks/payments", { raw, headers: signature ? { "x-signature": signature, "content-type": "application/json" } : { "content-type": "application/json" } }))
  const event = (invoiceId: string, amountCents: number, id = "evt_1") => JSON.stringify({ id, type: "payment.succeeded", data: { invoiceId, amountCents } })

  beforeEach(() => {
    held.user = null // webhooks have no signed-in user
  })

  it("marks the invoice as paid, and a replay changes nothing", async () => {
    const { id } = await createFor(alice)
    const raw = event(id, 125_000)
    const first = await read(await post(raw))
    expect(first.status).toBe(200)
    expect(first.body?.data).toMatchObject({ received: true, duplicate: false })
    const replay = await read(await post(raw))
    expect(replay.status).toBe(200)
    expect(replay.body?.data).toMatchObject({ duplicate: true })
    expect(await db.select().from(payments).where(eq(payments.invoiceId, id))).toHaveLength(1)
    const [row] = await db.select().from(invoices).where(eq(invoices.id, id))
    expect(row?.status).toBe("paid")
  })

  it("rejects a missing, wrong, tampered or old signature with 401 and changes nothing", async () => {
    const { id } = await createFor(alice)
    const raw = event(id, 125_000)
    expect((await post(raw, null)).status).toBe(401)
    expect((await post(raw, sign(raw, "another-secret-0123456789"))).status).toBe(401)
    expect((await post(event(id, 1), sign(raw, SECRET))).status).toBe(401) // body changed after signing
    expect((await post(raw, sign(raw, SECRET, Math.floor(Date.now() / 1000) - 3600))).status).toBe(401) // too old
    expect((await post(raw, "garbage")).status).toBe(401)
    expect(await db.select().from(payments)).toHaveLength(0)
  })

  it("a wrong amount is 422, an unknown invoice is 404, and neither records a payment", async () => {
    const { id } = await createFor(alice)
    expect((await post(event(id, 5))).status).toBe(422)
    expect((await post(event("00000000-0000-4000-8000-000000000000", 125_000))).status).toBe(404)
    expect(await db.select().from(payments)).toHaveLength(0)
  })

  it("acknowledges event types it does not handle", async () => {
    const raw = JSON.stringify({ id: "evt_9", type: "customer.updated", data: {} })
    const res = await read(await post(raw))
    expect(res.status).toBe(200)
    expect(res.body?.data).toMatchObject({ ignored: true })
  })

  it("a correct signature on a broken body is a 400", async () => {
    const broken = "{nope"
    expect((await post(broken)).status).toBe(400)
    const wrongShape = JSON.stringify({ id: "evt_2", type: "payment.succeeded", data: { invoiceId: "not-a-uuid", amountCents: 100 } })
    const res = await read(await post(wrongShape))
    expect(res.status).toBe(400)
    expect(res.body?.error?.code).toBe("VALIDATION")
  })

  it("refuses a very large body before doing any work", async () => {
    const huge = "x".repeat(300_000)
    expect((await post(huge)).status).toBe(413)
  })
})
