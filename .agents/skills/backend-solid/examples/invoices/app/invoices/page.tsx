// app/invoices/page.tsx
// A Server Component reads data by calling the service directly. Do not fetch your own /api routes from here.
import { formatMoney } from "@/lib/money"
import { requirePageUser } from "@/server/auth"
import { db } from "@/server/db"
import { listInvoices } from "@/server/invoices/service"
import { listInvoicesQuery } from "@/server/invoices/validators"

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function InvoicesPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePageUser()
  // A bad query string in the URL must not crash the page. Fall back to the defaults.
  const parsed = listInvoicesQuery.safeParse(await searchParams)
  const query = parsed.success ? parsed.data : listInvoicesQuery.parse({})
  const { items, total } = await listInvoices(db, user.id, query)

  return (
    <main>
      <h1>Invoices ({total})</h1>
      <ul>
        {items.map((invoice) => (
          <li key={invoice.id}>
            {invoice.number} · {invoice.customerName} · {formatMoney(invoice.amountCents, invoice.currency)} · {invoice.status}
          </li>
        ))}
      </ul>
    </main>
  )
}
