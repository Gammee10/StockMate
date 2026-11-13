// server/invoices/validators.ts
// Zod schemas for everything that comes in. No secrets here, so client forms may import them too.
import { z } from "zod"

const fields = {
  number: z.string().trim().min(1).max(40),
  customerName: z.string().trim().min(1).max(200),
  amountCents: z.int().min(1).max(100_000_000),
  currency: z.enum(["USD", "EUR", "GBP"]),
  dueDate: z.iso.date(),
  // "paid" is NOT allowed here. Only the payment webhook may mark an invoice as paid.
  status: z.enum(["draft", "sent"]),
}

export const createInvoiceInput = z.object({
  ...fields,
  currency: fields.currency.default("USD"),
  status: fields.status.default("draft"),
})

// Build the update schema from the fields WITHOUT defaults. A default inside .partial()
// would silently reset currency and status every time someone edits only the customer name.
export const updateInvoiceInput = z
  .object(fields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Send at least one field to change.")

export const invoiceIdParams = z.object({ id: z.uuid() })

export const listInvoicesQuery = z.object({
  status: z.enum(["draft", "sent", "paid"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
})

export type CreateInvoice = z.infer<typeof createInvoiceInput>
export type UpdateInvoice = z.infer<typeof updateInvoiceInput>
export type ListInvoices = z.infer<typeof listInvoicesQuery>
