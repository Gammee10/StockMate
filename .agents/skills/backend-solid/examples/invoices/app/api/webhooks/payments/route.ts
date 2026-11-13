// app/api/webhooks/payments/route.ts
import { z } from "zod"
import { webhookRoute } from "@/server/api"
import { db } from "@/server/db"
import { env } from "@/server/env"
import { recordPayment } from "@/server/invoices/service"
import { parseInput } from "@/server/validate"

const envelope = z.object({ id: z.string().min(1).max(100), type: z.string().max(100), data: z.unknown() })
const paymentSucceeded = z.object({ invoiceId: z.uuid(), amountCents: z.int().min(1) })

export const POST = webhookRoute({ secret: () => env.PAYMENTS_WEBHOOK_SECRET, body: envelope }, async ({ event }) => {
  // Events we do not handle are acknowledged, so the sender does not keep retrying them.
  if (event.type !== "payment.succeeded") return { received: true, ignored: true }
  const data = parseInput(paymentSucceeded, event.data)
  const result = await recordPayment(db, { id: event.id, ...data })
  return { received: true, ...result }
})
