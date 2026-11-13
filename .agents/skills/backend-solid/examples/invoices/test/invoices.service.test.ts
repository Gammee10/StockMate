// test/invoices.service.test.ts
// The service is where the rules live, so this is where most tests belong.
import { and, eq } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import type { Db } from "@/server/db"
import { invoices, payments } from "@/server/db/schema"
import * as service from "@/server/invoices/service"
import { createTestDb, emptyTables, seedUser } from "./helpers/db"

let db: Db
let close: () => Promise<void>
let alice: { id: string }
let bob: { id: string }

const base = { number: "INV-001", customerName: "Northwind Traders", amountCents: 125_000, currency: "USD" as const, dueDate: "2026-12-01", status: "draft" as const }

beforeAll(async () => {
  ;({ db, close } = await createTestDb())
})
afterAll(() => close())
beforeEach(async () => {
  await emptyTables(db)
  alice = await seedUser(db, "alice@example.com")
  bob = await seedUser(db, "bob@example.com")
})

describe("create and read", () => {
  it("returns only the public fields, and the detail adds paidAt and payments", async () => {
    const dto = await service.createInvoice(db, alice.id, base)
    const summary = ["amountCents", "createdAt", "currency", "customerName", "dueDate", "id", "number", "status"]
    expect(Object.keys(dto).sort()).toEqual(summary)
    const detail = await service.getInvoice(db, alice.id, dto.id)
    expect(Object.keys(detail).sort()).toEqual([...summary, "paidAt", "payments"].sort())
    expect(detail.payments).toEqual([])
  })

  it("takes the owner from the argument, never from the input", async () => {
    const dto = await service.createInvoice(db, alice.id, { ...base, userId: bob.id } as never)
    const [row] = await db.select().from(invoices).where(eq(invoices.id, dto.id))
    expect(row?.userId).toBe(alice.id)
  })

  it("rejects a duplicate number for the same user, but allows it for another user", async () => {
    await service.createInvoice(db, alice.id, base)
    await expect(service.createInvoice(db, alice.id, base)).rejects.toMatchObject({ code: "CONFLICT" })
    await expect(service.createInvoice(db, bob.id, base)).resolves.toMatchObject({ number: "INV-001" })
  })

  it("two requests at the same time cannot both create the same number", async () => {
    const results = await Promise.allSettled([service.createInvoice(db, alice.id, base), service.createInvoice(db, alice.id, base)])
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1)
    const rejected = results.find((r) => r.status === "rejected")
    expect(rejected).toMatchObject({ reason: { code: "CONFLICT" } })
  })
})

describe("ownership", () => {
  it("get, update and delete treat someone else's invoice as missing", async () => {
    const theirs = await service.createInvoice(db, bob.id, base)
    await expect(service.getInvoice(db, alice.id, theirs.id)).rejects.toMatchObject({ code: "NOT_FOUND" })
    await expect(service.updateInvoice(db, alice.id, theirs.id, { customerName: "Hacked" })).rejects.toMatchObject({ code: "NOT_FOUND" })
    await expect(service.deleteInvoice(db, alice.id, theirs.id)).rejects.toMatchObject({ code: "NOT_FOUND" })
    const after = await service.getInvoice(db, bob.id, theirs.id)
    expect(after.customerName).toBe("Northwind Traders")
  })

  it("list only returns the user's own invoices", async () => {
    await service.createInvoice(db, alice.id, base)
    await service.createInvoice(db, bob.id, { ...base, number: "INV-002" })
    const page = await service.listInvoices(db, alice.id, { limit: 20, offset: 0 })
    expect(page.total).toBe(1)
    expect(page.items.map((i) => i.number)).toEqual(["INV-001"])
  })
})

describe("list", () => {
  it("paginates in a stable order and reports the total", async () => {
    for (let i = 1; i <= 5; i++) await service.createInvoice(db, alice.id, { ...base, number: `INV-00${i}` })
    const first = await service.listInvoices(db, alice.id, { limit: 2, offset: 0 })
    const second = await service.listInvoices(db, alice.id, { limit: 2, offset: 2 })
    const third = await service.listInvoices(db, alice.id, { limit: 2, offset: 4 })
    expect(first.total).toBe(5)
    const numbers = [...first.items, ...second.items, ...third.items].map((i) => i.number)
    expect(new Set(numbers).size).toBe(5)
    expect(third.items).toHaveLength(1)
  })

  it("filters by status", async () => {
    await service.createInvoice(db, alice.id, base)
    await service.createInvoice(db, alice.id, { ...base, number: "INV-002", status: "sent" })
    const page = await service.listInvoices(db, alice.id, { status: "sent", limit: 20, offset: 0 })
    expect(page.items.map((i) => i.number)).toEqual(["INV-002"])
  })
})

describe("update and delete", () => {
  it("changes only the fields that were sent", async () => {
    const dto = await service.createInvoice(db, alice.id, { ...base, currency: "EUR", status: "sent" })
    const updated = await service.updateInvoice(db, alice.id, dto.id, { customerName: "Contoso" })
    expect(updated).toMatchObject({ customerName: "Contoso", currency: "EUR", status: "sent", amountCents: 125_000 })
  })

  it("rejects a number that another of the user's invoices already has", async () => {
    await service.createInvoice(db, alice.id, base)
    const second = await service.createInvoice(db, alice.id, { ...base, number: "INV-002" })
    await expect(service.updateInvoice(db, alice.id, second.id, { number: "INV-001" })).rejects.toMatchObject({ code: "CONFLICT" })
  })

  it("deletes an invoice, and refuses when it has payments", async () => {
    const free = await service.createInvoice(db, alice.id, base)
    await service.deleteInvoice(db, alice.id, free.id)
    await expect(service.getInvoice(db, alice.id, free.id)).rejects.toMatchObject({ code: "NOT_FOUND" })

    const paid = await service.createInvoice(db, alice.id, { ...base, number: "INV-002" })
    await service.recordPayment(db, { id: "evt_1", invoiceId: paid.id, amountCents: paid.amountCents })
    await expect(service.deleteInvoice(db, alice.id, paid.id)).rejects.toMatchObject({ code: "CONFLICT" })
  })
})

describe("recordPayment (webhook)", () => {
  async function paymentCount(invoiceId: string) {
    const rows = await db.select().from(payments).where(eq(payments.invoiceId, invoiceId))
    return rows.length
  }

  it("marks the invoice as paid", async () => {
    const inv = await service.createInvoice(db, alice.id, base)
    const result = await service.recordPayment(db, { id: "evt_1", invoiceId: inv.id, amountCents: inv.amountCents })
    expect(result).toEqual({ duplicate: false })
    const after = await service.getInvoice(db, alice.id, inv.id)
    expect(after.status).toBe("paid")
    expect(after.paidAt).not.toBeNull()
    expect(after.payments).toMatchObject([{ eventId: "evt_1", amountCents: inv.amountCents }])
  })

  it("is safe to deliver twice: the second delivery changes nothing", async () => {
    const inv = await service.createInvoice(db, alice.id, base)
    const event = { id: "evt_1", invoiceId: inv.id, amountCents: inv.amountCents }
    await service.recordPayment(db, event)
    const again = await service.recordPayment(db, event)
    expect(again).toEqual({ duplicate: true })
    expect(await paymentCount(inv.id)).toBe(1)
  })

  it("is safe when the same event arrives twice at the same time", async () => {
    const inv = await service.createInvoice(db, alice.id, base)
    const event = { id: "evt_1", invoiceId: inv.id, amountCents: inv.amountCents }
    const results = await Promise.all([service.recordPayment(db, event), service.recordPayment(db, event)])
    expect(results.filter((r) => r.duplicate)).toHaveLength(1)
    expect(await paymentCount(inv.id)).toBe(1)
  })

  it("a wrong amount is refused and leaves no payment row behind (rollback)", async () => {
    const inv = await service.createInvoice(db, alice.id, base)
    await expect(service.recordPayment(db, { id: "evt_1", invoiceId: inv.id, amountCents: 1 })).rejects.toMatchObject({ code: "UNPROCESSABLE" })
    expect(await paymentCount(inv.id)).toBe(0)
    expect((await service.getInvoice(db, alice.id, inv.id)).status).toBe("draft")
  })

  it("an unknown invoice is NOT_FOUND", async () => {
    await expect(
      service.recordPayment(db, { id: "evt_1", invoiceId: "00000000-0000-4000-8000-000000000000", amountCents: 100 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("a different payment for an already paid invoice is refused and not recorded", async () => {
    const inv = await service.createInvoice(db, alice.id, base)
    await service.recordPayment(db, { id: "evt_1", invoiceId: inv.id, amountCents: inv.amountCents })
    await expect(service.recordPayment(db, { id: "evt_2", invoiceId: inv.id, amountCents: inv.amountCents })).rejects.toMatchObject({ code: "CONFLICT" })
    expect(await paymentCount(inv.id)).toBe(1)
    const [row] = await db.select().from(invoices).where(and(eq(invoices.id, inv.id), eq(invoices.status, "paid")))
    expect(row).toBeDefined()
  })
})
