// server/invoices/actions.ts
"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { userAction } from "@/server/action"
import { db } from "@/server/db"
import * as invoices from "./service"
import { createInvoiceInput, invoiceIdParams, updateInvoiceInput } from "./validators"

// Actions stay thin: wrapper (session + validation + errors) -> service -> revalidate.

export const createInvoiceAction = userAction(createInvoiceInput, async ({ input, user }) => {
  const invoice = await invoices.createInvoice(db, user.id, input)
  revalidatePath("/invoices")
  return invoice
})

export const updateInvoiceAction = userAction(
  z.object({ id: invoiceIdParams.shape.id, changes: updateInvoiceInput }),
  async ({ input, user }) => {
    const invoice = await invoices.updateInvoice(db, user.id, input.id, input.changes)
    revalidatePath("/invoices")
    return invoice
  },
)

export const deleteInvoiceAction = userAction(invoiceIdParams, async ({ input, user }) => {
  await invoices.deleteInvoice(db, user.id, input.id)
  revalidatePath("/invoices")
  return { id: input.id }
})
