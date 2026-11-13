// test/validators.test.ts
import { describe, expect, it } from "vitest"
import { createInvoiceInput, invoiceIdParams, listInvoicesQuery, updateInvoiceInput } from "@/server/invoices/validators"

const valid = { number: "INV-001", customerName: "Northwind Traders", amountCents: 125_000, dueDate: "2026-12-01" }

describe("createInvoiceInput", () => {
  it("applies defaults and trims text", () => {
    const parsed = createInvoiceInput.parse({ ...valid, customerName: "  Northwind  " })
    expect(parsed).toMatchObject({ customerName: "Northwind", currency: "USD", status: "draft" })
  })

  it("drops fields it does not know (no mass assignment)", () => {
    const parsed = createInvoiceInput.parse({ ...valid, userId: "someone-else", id: "x", paidAt: "2026-01-01" })
    expect(parsed).not.toHaveProperty("userId")
    expect(parsed).not.toHaveProperty("id")
    expect(parsed).not.toHaveProperty("paidAt")
  })

  it.each([
    ["a float amount", { amountCents: 10.5 }],
    ["a zero amount", { amountCents: 0 }],
    ["a negative amount", { amountCents: -5 }],
    ["a huge amount", { amountCents: 10 ** 12 }],
    ["an amount sent as text", { amountCents: "100" }],
    ["status paid", { status: "paid" }],
    ["an unknown currency", { currency: "XXX" }],
    ["an impossible date", { dueDate: "2026-13-45" }],
    ["an empty number", { number: "   " }],
    ["a very long name", { customerName: "x".repeat(201) }],
  ])("rejects %s", (_label, patch) => {
    expect(createInvoiceInput.safeParse({ ...valid, ...patch }).success).toBe(false)
  })
})

describe("updateInvoiceInput", () => {
  it("does not add defaults to a partial update", () => {
    expect(updateInvoiceInput.parse({ customerName: "Contoso" })).toEqual({ customerName: "Contoso" })
  })
  it("needs at least one field", () => {
    expect(updateInvoiceInput.safeParse({}).success).toBe(false)
    expect(updateInvoiceInput.safeParse({ userId: "x" }).success).toBe(false)
  })
})

describe("listInvoicesQuery", () => {
  it("coerces text from the URL and applies defaults", () => {
    expect(listInvoicesQuery.parse({})).toEqual({ limit: 20, offset: 0 })
    expect(listInvoicesQuery.parse({ limit: "50", offset: "10", status: "sent" })).toEqual({ limit: 50, offset: 10, status: "sent" })
  })
  it.each([{ limit: "101" }, { limit: "0" }, { limit: "abc" }, { offset: "-1" }, { status: "bogus" }])("rejects %o", (q) => {
    expect(listInvoicesQuery.safeParse(q).success).toBe(false)
  })
})

describe("invoiceIdParams", () => {
  it("only accepts a uuid", () => {
    expect(invoiceIdParams.safeParse({ id: "not-a-uuid" }).success).toBe(false)
    expect(invoiceIdParams.safeParse({ id: "9b2f6f0e-8c53-4b7e-9a3a-0e8f8f1a2b3c" }).success).toBe(true)
  })
})
