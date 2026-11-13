// test/action.test.ts
// Server actions built with the wrappers, called like normal functions.
import { notFound, redirect } from "next/navigation"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { adminAction, publicAction, userAction } from "@/server/action"

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

vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7" }) }))

const schema = z.object({ title: z.string().trim().min(1).max(50) })
const alice: TestUser = { id: "11111111-1111-4111-8111-111111111111", email: "alice@example.com", role: "user" }

beforeEach(() => {
  held.user = alice
})

describe("userAction", () => {
  it("runs the handler with the validated input and the session user", async () => {
    const action = userAction(schema, async ({ input, user }) => ({ title: input.title, by: user.id }))
    expect(await action({ title: "  Hello " })).toEqual({ ok: true, data: { title: "Hello", by: alice.id } })
  })

  it("does not run the handler when signed out", async () => {
    held.user = null
    const handler = vi.fn(async () => "done")
    const result = await userAction(schema, handler)({ title: "x" })
    expect(result).toMatchObject({ ok: false, error: { code: "UNAUTHORIZED" } })
    expect(handler).not.toHaveBeenCalled()
  })

  it("returns field errors and does not run the handler when the input is wrong", async () => {
    const handler = vi.fn(async () => "done")
    const result = await userAction(schema, handler)({ title: "" })
    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION", fields: { title: expect.any(Array) } } })
    expect(handler).not.toHaveBeenCalled()
  })

  it("accepts FormData", async () => {
    const form = new FormData()
    form.set("title", "From a form")
    expect(await userAction(schema, async ({ input }) => input.title)(form)).toEqual({ ok: true, data: "From a form" })
  })

  it("drops fields the schema does not list", async () => {
    const action = userAction(schema, async ({ input }) => input)
    expect(await action({ title: "x", role: "admin", userId: "someone-else" } as never)).toEqual({ ok: true, data: { title: "x" } })
  })

  it("hides unexpected errors", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const result = await userAction(schema, async () => {
      throw new Error("relation \"secret_table\" does not exist")
    })({ title: "x" })
    expect(result).toEqual({ ok: false, error: { code: "INTERNAL", message: "Something went wrong. Please try again.", fields: undefined } })
    spy.mockRestore()
  })

  it("lets redirect() and notFound() inside the handler work", async () => {
    await expect(userAction(schema, async () => redirect("/invoices"))({ title: "x" })).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") })
    await expect(userAction(schema, async () => notFound())({ title: "x" })).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK") })
  })
})

describe("adminAction", () => {
  it("refuses a normal user and allows an admin", async () => {
    const action = adminAction(schema, async () => "secret")
    expect(await action({ title: "x" })).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } })
    held.user = { ...alice, role: "admin" }
    expect(await action({ title: "x" })).toEqual({ ok: true, data: "secret" })
  })
})

describe("rate limit option", () => {
  it("stops a visitor after the limit, and does not run the handler", async () => {
    held.user = null
    const handler = vi.fn(async () => "sent")
    const action = publicAction(schema, handler, { rateLimit: { key: "test.contact", limit: 2, windowSeconds: 60 } })
    expect((await action({ title: "a" })).ok).toBe(true)
    expect((await action({ title: "b" })).ok).toBe(true)
    expect(await action({ title: "c" })).toMatchObject({ ok: false, error: { code: "RATE_LIMITED" } })
    expect(handler).toHaveBeenCalledTimes(2)
  })
})

describe("publicAction", () => {
  it("works signed out, and still validates", async () => {
    held.user = null
    const action = publicAction(schema, async ({ input }) => input.title)
    expect(await action({ title: "hi" })).toEqual({ ok: true, data: "hi" })
    expect(await action({ title: "" })).toMatchObject({ ok: false, error: { code: "VALIDATION" } })
  })
})
