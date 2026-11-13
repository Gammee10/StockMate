// app/api/invoices/route.ts
import { created, userRoute } from "@/server/api"
import { db } from "@/server/db"
import * as invoices from "@/server/invoices/service"
import { createInvoiceInput, listInvoicesQuery } from "@/server/invoices/validators"

export const GET = userRoute({ query: listInvoicesQuery }, async ({ query, user }) => {
  return invoices.listInvoices(db, user.id, query)
})

export const POST = userRoute(
  { body: createInvoiceInput },
  async ({ body, user }) => created(await invoices.createInvoice(db, user.id, body)),
  { rateLimit: { key: "invoices.create", limit: 300, windowSeconds: 60 } },
)
