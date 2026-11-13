// app/invoices/new/page.tsx
"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toCents } from "@/lib/money"
import { createInvoiceAction } from "@/server/invoices/actions"

// A client component calls the server action like a normal async function.
// The action checks the session and the input again on the server, so this form is only a convenience.
export default function NewInvoicePage() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState("")
  const [errors, setErrors] = useState<Record<string, string[]>>({})

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    startTransition(async () => {
      const result = await createInvoiceAction({
        number: String(form.get("number") ?? ""),
        customerName: String(form.get("customerName") ?? ""),
        amountCents: toCents(String(form.get("amount") ?? "")) ?? Number.NaN,
        dueDate: String(form.get("dueDate") ?? ""),
      })
      if (!result.ok) {
        setMessage(result.error.message)
        setErrors(result.error.fields ?? {})
        return
      }
      router.push("/invoices")
    })
  }

  return (
    <main>
      <h1>New invoice</h1>
      <form onSubmit={onSubmit}>
        <input name="number" placeholder="Number" aria-label="Number" />
        <input name="customerName" placeholder="Customer" aria-label="Customer" />
        <input name="amount" placeholder="Amount (12.34)" aria-label="Amount" />
        <input name="dueDate" type="date" aria-label="Due date" />
        <button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Create"}
        </button>
        {message ? <p role="alert">{message}</p> : null}
        {Object.entries(errors).map(([field, list]) => (
          <p key={field}>
            {field}: {list.join(", ")}
          </p>
        ))}
      </form>
    </main>
  )
}
