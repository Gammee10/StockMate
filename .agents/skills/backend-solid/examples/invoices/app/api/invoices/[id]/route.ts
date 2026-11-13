// app/api/invoices/[id]/route.ts
import { noContent, userRoute } from "@/server/api"
import { db } from "@/server/db"
import * as invoices from "@/server/invoices/service"
import { invoiceIdParams, updateInvoiceInput } from "@/server/invoices/validators"

export const GET = userRoute({ params: invoiceIdParams }, async ({ params, user }) => {
  return invoices.getInvoice(db, user.id, params.id)
})

export const PATCH = userRoute({ params: invoiceIdParams, body: updateInvoiceInput }, async ({ params, body, user }) => {
  return invoices.updateInvoice(db, user.id, params.id, body)
})

export const DELETE = userRoute({ params: invoiceIdParams }, async ({ params, user }) => {
  await invoices.deleteInvoice(db, user.id, params.id)
  return noContent()
})
