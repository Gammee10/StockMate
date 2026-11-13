// server/invoices/service.ts
// Business logic. No HTTP, no cookies, no Next.js here: only plain functions.
// Every function takes `db` and the CURRENT USER'S ID. Every query is filtered by that id.
import "server-only"
import { and, desc, eq, ne, sql } from "drizzle-orm"
import { conflict, notFound, unprocessable } from "@/lib/errors"
import type { Db } from "@/server/db"
import { invoices, payments } from "@/server/db/schema"
import { isForeignKeyViolation, isUniqueViolation } from "@/server/errors"
import type { CreateInvoice, ListInvoices, UpdateInvoice } from "./validators"

type InvoiceRow = typeof invoices.$inferSelect
type PaymentRow = typeof payments.$inferSelect

// Only these shapes leave the server. Fields are picked one by one on purpose,
// so a column you add later (or userId, updatedAt) is never exposed by accident.
function toSummary(row: InvoiceRow) {
  return {
    id: row.id,
    number: row.number,
    customerName: row.customerName,
    amountCents: row.amountCents,
    currency: row.currency,
    status: row.status,
    dueDate: row.dueDate,
    createdAt: row.createdAt.toISOString(),
  }
}

function toDetail(row: InvoiceRow, paymentRows: PaymentRow[]) {
  return {
    ...toSummary(row),
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    payments: paymentRows.map((p) => ({ eventId: p.eventId, amountCents: p.amountCents, createdAt: p.createdAt.toISOString() })),
  }
}

export type InvoiceSummary = ReturnType<typeof toSummary>
export type InvoiceDetail = ReturnType<typeof toDetail>

export async function listInvoices(db: Db, userId: string, query: ListInvoices) {
  const where = and(eq(invoices.userId, userId), query.status ? eq(invoices.status, query.status) : undefined)
  const [rows, totals] = await Promise.all([
    db
      .select()
      .from(invoices)
      .where(where)
      .orderBy(desc(invoices.createdAt), desc(invoices.id)) // a stable order, so pages do not overlap
      .limit(query.limit)
      .offset(query.offset),
    db.select({ total: sql<number>`count(*)::int` }).from(invoices).where(where),
  ])
  return { items: rows.map(toSummary), total: totals[0]?.total ?? 0, limit: query.limit, offset: query.offset }
}

export async function getInvoice(db: Db, userId: string, id: string) {
  const [row] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.userId, userId)))
    .limit(1)
  // Someone else's invoice looks exactly like a missing one. We do not reveal that it exists.
  if (!row) throw notFound("Invoice")
  // Children are read through the parent with the owner in the same query. Do not rely on the check above.
  const paymentRows = await db
    .select({ payment: payments })
    .from(payments)
    .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
    .where(and(eq(payments.invoiceId, row.id), eq(invoices.userId, userId)))
    .orderBy(payments.createdAt)
    .limit(100) // an invoice has a handful of payments. The cap is a safety net.
  return toDetail(row, paymentRows.map((r) => r.payment))
}

export async function createInvoice(db: Db, userId: string, input: CreateInvoice) {
  try {
    // userId comes last and from the session, never from the input.
    const [row] = await db.insert(invoices).values({ ...input, userId }).returning()
    if (!row) throw new Error("Insert returned no row")
    return toSummary(row)
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict(`Invoice number ${input.number} already exists.`)
    throw err
  }
}

export async function updateInvoice(db: Db, userId: string, id: string, patch: UpdateInvoice) {
  try {
    const [row] = await db
      .update(invoices)
      .set(patch)
      .where(and(eq(invoices.id, id), eq(invoices.userId, userId), ne(invoices.status, "paid"))) // id AND owner, in the same statement
      .returning()
    if (!row) {
      // Nothing changed: either it is not yours (404) or it is paid (a paid invoice is final).
      const [own] = await db.select({ id: invoices.id }).from(invoices).where(and(eq(invoices.id, id), eq(invoices.userId, userId))).limit(1)
      if (own) throw conflict("A paid invoice cannot be changed.")
      throw notFound("Invoice")
    }
    return toSummary(row)
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict("Another invoice already has this number.")
    throw err
  }
}

export async function deleteInvoice(db: Db, userId: string, id: string) {
  try {
    const rows = await db
      .delete(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.userId, userId)))
      .returning({ id: invoices.id })
    if (rows.length === 0) throw notFound("Invoice")
  } catch (err) {
    if (isForeignKeyViolation(err)) throw conflict("This invoice has payments and cannot be deleted.")
    throw err
  }
}

/**
 * Called by the payment webhook. It writes to two tables, so it runs in ONE transaction:
 * either everything happens or nothing does. It is safe to run twice with the same event.
 */
// backend-check-ignore unscoped-read,unscoped-write: a webhook has no signed-in user. The signature proves who is calling and the invoice id comes from the provider.
export async function recordPayment(db: Db, event: { id: string; invoiceId: string; amountCents: number }) {
  return db.transaction(async (tx) => {
    // Lock the invoice row until the transaction ends, so two events cannot pay it at the same time.
    const [invoice] = await tx.select().from(invoices).where(eq(invoices.id, event.invoiceId)).for("update")
    if (!invoice) throw notFound("Invoice")

    // The UNIQUE event id makes a retried webhook a no-op instead of a second payment.
    const inserted = await tx
      .insert(payments)
      .values({ invoiceId: invoice.id, eventId: event.id, amountCents: event.amountCents })
      .onConflictDoNothing({ target: payments.eventId })
      .returning({ id: payments.id })
    if (inserted.length === 0) return { duplicate: true }

    // Throwing from here on rolls back the payment row inserted above.
    if (event.amountCents !== invoice.amountCents) throw unprocessable("Payment amount does not match the invoice.")
    // A second, different payment for a paid invoice needs a human. Fail loudly: the sender shows a failed delivery.
    if (invoice.status === "paid") throw conflict("This invoice is already paid.")

    await tx.update(invoices).set({ status: "paid", paidAt: new Date() }).where(eq(invoices.id, invoice.id))
    return { duplicate: false }
  })
}
