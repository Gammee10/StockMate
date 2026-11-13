// server/invoices/service.ts  (Prisma 7 variant)
// Same rules as the Drizzle version: every function takes `db` and the CURRENT USER'S ID, and every query filters by it.
import "server-only"
import type { Invoice, Payment, Prisma, PrismaClient } from "@/generated/prisma/client"
import { conflict, notFound, unprocessable } from "@/lib/errors"
import type { Db } from "@/server/db"
import { isForeignKeyViolation, isRecordNotFound, isUniqueViolation } from "@/server/errors"
import type { CreateInvoice, ListInvoices, UpdateInvoice } from "./validators"

function toSummary(row: Invoice) {
  return {
    id: row.id,
    number: row.number,
    customerName: row.customerName,
    amountCents: row.amountCents,
    currency: row.currency,
    status: row.status,
    dueDate: row.dueDate.toISOString().slice(0, 10), // a @db.Date column comes back as a Date at UTC midnight
    createdAt: row.createdAt.toISOString(),
  }
}

function toDetail(row: Invoice, payments: Payment[]) {
  return {
    ...toSummary(row),
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    payments: payments.map((p) => ({ eventId: p.eventId, amountCents: p.amountCents, createdAt: p.createdAt.toISOString() })),
  }
}

export async function listInvoices(db: Db, userId: string, query: ListInvoices) {
  const where: Prisma.InvoiceWhereInput = { userId, ...(query.status ? { status: query.status } : {}) }
  const [rows, total] = await Promise.all([
    db.invoice.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: query.limit, skip: query.offset }),
    db.invoice.count({ where }),
  ])
  return { items: rows.map(toSummary), total, limit: query.limit, offset: query.offset }
}

export async function getInvoice(db: Db, userId: string, id: string) {
  const row = await db.invoice.findFirst({ where: { id, userId }, include: { payments: { orderBy: { createdAt: "asc" } } } })
  if (!row) throw notFound("Invoice")
  const { payments, ...invoice } = row
  return toDetail(invoice, payments)
}

export async function createInvoice(db: Db, userId: string, input: CreateInvoice) {
  try {
    const row = await db.invoice.create({ data: { ...input, dueDate: new Date(input.dueDate), userId } })
    return toSummary(row)
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict(`Invoice number ${input.number} already exists.`)
    throw err
  }
}

export async function updateInvoice(db: Db, userId: string, id: string, patch: UpdateInvoice) {
  const { dueDate, ...rest } = patch
  try {
    // where: { id, userId } is allowed on update(). It throws P2025 when the invoice is not this user's.
    const row = await db.invoice.update({ where: { id, userId }, data: { ...rest, ...(dueDate ? { dueDate: new Date(dueDate) } : {}) } })
    return toSummary(row)
  } catch (err) {
    if (isRecordNotFound(err)) throw notFound("Invoice")
    if (isUniqueViolation(err)) throw conflict("Another invoice already has this number.")
    throw err
  }
}

export async function deleteInvoice(db: Db, userId: string, id: string) {
  try {
    await db.invoice.delete({ where: { id, userId } })
  } catch (err) {
    if (isRecordNotFound(err)) throw notFound("Invoice")
    if (isForeignKeyViolation(err)) throw conflict("This invoice has payments and cannot be deleted.")
    throw err
  }
}

/** Needs the full PrismaClient, because it opens a transaction. */
// backend-check-ignore unscoped-read,unscoped-write: a webhook has no signed-in user. The signature proves who is calling and the invoice id comes from the provider.
export async function recordPayment(db: PrismaClient, event: { id: string; invoiceId: string; amountCents: number }) {
  return db.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id: event.invoiceId } })
    if (!invoice) throw notFound("Invoice")

    // skipDuplicates = INSERT ... ON CONFLICT DO NOTHING. A retried event inserts 0 rows.
    const { count } = await tx.payment.createMany({
      data: [{ invoiceId: invoice.id, eventId: event.id, amountCents: event.amountCents }],
      skipDuplicates: true,
    })
    if (count === 0) return { duplicate: true }

    // Throwing from here on rolls back the payment row inserted above.
    if (event.amountCents !== invoice.amountCents) throw unprocessable("Payment amount does not match the invoice.")
    // Conditional update: only one request can move the invoice from "not paid" to "paid".
    const updated = await tx.invoice.updateMany({ where: { id: invoice.id, status: { not: "paid" } }, data: { status: "paid", paidAt: new Date() } })
    if (updated.count === 0) throw conflict("This invoice is already paid.")
    return { duplicate: false }
  })
}
