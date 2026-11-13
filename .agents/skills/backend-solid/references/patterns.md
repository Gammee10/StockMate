# Patterns

Copy the closest pattern. Change the names and the fields. Keep the structure.

Every Drizzle pattern here is taken from `examples/invoices/`, which has tests for each one (run and passing). The Prisma versions are in `examples/invoices-prisma/` (checked with the compiler, not run). Patterns 11 to 13 show shapes that are not in the example app. Their helpers are tested, the snippets themselves are compiled but have no test of their own. Pattern 19 comes from a team-invitation trial run that passed a live HTTP test (parallel requests, expiry, rate limit, no plain token in the database).

Contents: 1 Recipe · 2 Schema · 3 Validators · 4 Service · 5 List · 6 Route handlers · 7 Server actions · 8 Pages · 9 Transaction and "once only" · 10 Webhook · 11 Scheduled job · 12 Public form · 13 Teams and organizations · 14 File uploads · 15 Money, dates, ids · 16 Errors · 17 Testing · 18 Drizzle and Prisma side by side · 19 One-time tokens (invitations, password reset)

## 1. Recipe: add a new resource

Say you add "projects" that belong to a user. Do these in order:

1. `server/db/schema.ts`: add the table (pattern 2). Run `npm run db:generate`, then `npm run db:migrate`.
2. `server/projects/validators.ts`: the input schemas (pattern 3).
3. `server/projects/service.ts`: functions `(db, userId, ...)` (patterns 4, 5, 9).
4. `app/api/projects/route.ts` and `app/api/projects/[id]/route.ts`, or `server/projects/actions.ts` (patterns 6, 7). Keep them thin.
5. Pages read through the service (pattern 8).
6. `test/projects.service.test.ts` (pattern 17): wrong owner, duplicate, invalid input, rollback, repeat.
7. `npm run typecheck && npm test && npm run backend:check`.

## 2. Schema

- Every user-owned table has an owner column with a foreign key. Every query filters on it.
- Rules the database can enforce are constraints (`unique`), not `if` statements in code.
- Postgres does not index foreign keys for you. Add an index for each one, and for the columns a list is sorted by.
- Money is an integer number of cents. Dates that need a time are `timestamp with time zone`.
- Pick `onDelete` on purpose: `cascade` for things that mean nothing without the parent, `restrict` for history you must keep.
- If your auth library creates the user table (Better Auth does), do not define it again. Reference its `id`. It is `text`, not `uuid`.

```ts
// server/db/schema.ts (excerpt)
export const invoiceStatus = pgEnum("invoice_status", ["draft", "sent", "paid"])

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Every row that belongs to a user has an owner column. Every query filters on it.
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    number: text("number").notNull(),
    customerName: text("customer_name").notNull(),
    amountCents: integer("amount_cents").notNull(), // money is whole cents. Never a float.
    currency: text("currency").notNull().default("USD"),
    status: invoiceStatus("status").notNull().default("draft"),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // The database enforces the rule, so two requests at the same time cannot break it.
    unique("invoices_user_number_unique").on(t.userId, t.number),
    // Foreign keys are not indexed automatically in Postgres. This also serves the list query.
    index("invoices_user_created_idx").on(t.userId, t.createdAt),
  ],
)
```

Do not put `import "server-only"` in `schema.ts`: `drizzle-kit` loads this file on its own and would fail.

## 3. Validators

One `validators.ts` per domain. Everything that comes in has a schema: body, query string, route params, form data.

- Every string has `.max()`. Every number has a range. Choices are `z.enum`. Ids are `z.uuid()` (or the id format your auth library uses). Dates are `z.iso.date()`.
- `z.object` drops keys it does not know. Spread the parsed value into the database, never the raw body.
- Build the update schema from the fields **without defaults**, then `.partial()`. A default inside `.partial()` silently resets the field on every edit.
- Fields with business meaning (`paid`, `approved`, `role`) are not in the generic create and update schemas. They change only through their own function.
- Query strings are text. Use `z.coerce.number()` and give `limit` a maximum.

```ts
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
```

## 4. Service: read, create, update, delete

The service is plain TypeScript. It knows nothing about HTTP, cookies or Next.js. That is why it is easy to test, and why the same function works for a route and for an action.

- Signature: `(db, userId, ...input)`. `userId` comes from the session, **never** from the input.
- The owner is in the same `where` as the id. Not "load, then compare": that is two steps and one of them can be forgotten.
- Someone else's record and a missing record give the same `notFound()`. Do not reveal that it exists.
- Children (payments of an invoice) are read through the parent, with the owner in the join.
- Return a DTO built field by field, not the row. A column you add later is then never leaked by accident.
- The database enforces uniqueness. Catch the violation and turn it into a 409.

```ts
// server/invoices/service.ts (excerpt)
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
```

```ts
// server/invoices/service.ts (excerpt)
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
```

```ts
// server/invoices/service.ts (excerpt)
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
```

```ts
// server/invoices/service.ts (excerpt)
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
```

```ts
// server/invoices/service.ts (excerpt)
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
```

## 5. List with pagination

- `limit` has a maximum (the validator enforces 100). `offset` has a maximum too.
- Sort by a stable key. Add the id as the last sort key, so rows with the same date never swap places between pages.
- Return `total`, so the UI can show pages.
- Never `select()` a whole table. Never query inside a loop: fetch with `inArray` or a join and group in memory.

```ts
// server/invoices/service.ts (excerpt)
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
```

## 6. Route handlers

A route handler is a public HTTP endpoint. Build it with a helper. The helper checks who is calling, validates params, query and body, limits the body size, refuses cross-site browser requests, hides internal errors and answers with one JSON shape: `{ data }` or `{ error: { code, message, fields? } }`.

| Helper | Who can call it |
|---|---|
| `userRoute` | signed-in users |
| `adminRoute` | admins |
| `publicRoute` | anyone. Add `rateLimit` if it writes or is expensive |
| `webhookRoute` | another service that signs its requests (pattern 10) |
| `cronRoute` | a scheduler that sends a secret (pattern 11) |

```ts
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
```

```ts
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
```

- Return the data. The helper wraps it as `{ data }`. For a different status use `created(...)` (201) or `noContent()` (204).
- The file stays this short. If you want to write `db.` in a route file, the code belongs in the service.
- The folder name `[id]` is a dynamic segment. The helper reads it for you (`params`), already validated.

## 7. Server actions and forms

A server action is a public POST endpoint too. Anyone can call it with any input. Build it with a helper. It returns `{ ok: true, data }` or `{ ok: false, error }`. It never throws to the client, except `redirect()` and `notFound()`, which keep working.

```ts
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
```

- A file with `"use server"` may export **only async functions**. Put schemas and constants in another file. (`export const createInvoiceAction = userAction(...)` is fine: it is a function.)
- After a write, refresh what the page shows: `revalidatePath("/invoices")`, `revalidateTag("name", "max")` or `updateTag("name")`.
- A client component calls the action like an async function and shows `result.error.message` and `result.error.fields`:

```tsx
// app/invoices/new/page.tsx (excerpt)
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
```

## 8. Pages (Server Components)

A page reads data by calling the service directly. It does not `fetch` its own `/api` routes. In Next.js 16 `searchParams` and `params` are Promises: `await` them. A page has no wrapper, so it calls `requirePageUser()` itself. It redirects a visitor who is signed out to the sign-in page.

```tsx
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
```

## 9. Transaction and "once only"

Use a transaction when a request writes to more than one place. Either everything happens or nothing does. Use the database to decide "only once". Do not decide it in code.

- **Two or more writes:** `db.transaction(async (tx) => { ... })`. Every query inside uses `tx`. A query on `db` runs outside the transaction and is not rolled back.
- **A repeat must do nothing** (webhooks, payments, "claim this invite"): store the event id with a unique constraint, insert with `onConflictDoNothing()`, and look at whether a row was inserted.
- **Two requests at the same time:** lock the row (`.for("update")`) or use a conditional update (`UPDATE ... WHERE status <> 'paid'` and check how many rows changed).
- **Counters and balances:** `SET count = count + 1` in the database. Never read the value, add in code and write it back.
- **"Check, then insert" is a bug.** Two requests both pass the check.
- Anything slow (sending an email, calling another API) stays outside the transaction. A long transaction holds locks.

```ts
// server/invoices/service.ts (excerpt)
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
```

## 10. Webhook endpoint

Another service calls it, so there is no user. The caller proves who it is with a signature over the **raw** body. `webhookRoute` does it in this order: read the raw text (with a size limit) → check the signature and the timestamp → only then parse the JSON → validate it with zod → run your handler.

```ts
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
```

- The signature header is `t=<unix seconds>,v1=<hex>`. The signed text is `${t}.${rawBody}`, HMAC-SHA256 with the shared secret. **This is exactly Stripe's `Stripe-Signature` format**, so for Stripe use `signatureHeader: "stripe-signature"` and the endpoint secret (`whsec_...`). Several `v1` values are accepted, because a provider sends one per active secret while it rotates a secret.
- If the provider has an official SDK (`stripe.webhooks.constructEvent(rawBody, header, secret)`), using it is also fine. Keep the same order: raw body, verify, then use.
- Providers send the same event more than once and not always in order. Store the event id (unique) and make the handler safe to repeat (pattern 9). Do not rely on the order of events.
- Answer `2xx` for event types you do not handle, so the provider stops retrying them. Answer a non-2xx only when you want a retry.
- Return fast. Do slow work (emails, other APIs) after you have saved the event, in a job.
- Put the secret in `server/env.ts` (for example `STRIPE_WEBHOOK_SECRET`), never in code.

## 11. Scheduled job endpoint

A scheduler (Vercel Cron, GitHub Actions, any HTTP cron) calls a route on a timer. If the route has no check, anyone on the internet can run your job. `cronRoute` checks `Authorization: Bearer <secret>` in constant time, and fails closed when the secret is not set.

```ts
// app/api/cron/purge-sessions/route.ts
import { cronRoute } from "@/server/api"
import { db } from "@/server/db"
import { env } from "@/server/env" // add CRON_SECRET: z.string().min(16) to server/env.ts
import { purgeExpiredSessions } from "@/server/sessions/service"

export const GET = cronRoute({ secret: () => env.CRON_SECRET }, async () => {
  return purgeExpiredSessions(db)
})
```

- Vercel: add the environment variable `CRON_SECRET` (16 or more letters and digits). Vercel sends it as the `Authorization: Bearer` header by itself. Schedule it in `vercel.json`: `{ "crons": [{ "path": "/api/cron/purge-sessions", "schedule": "0 3 * * *" }] }`. Vercel calls it with GET, and only on the production deployment.
- A scheduler can run a job twice or miss a run, and it does not retry. Write the job so a repeat is harmless and a missed run is caught up ("process everything that is pending", not "process the last hour").
- Runs can overlap if the job is slow. Use a conditional update or a lock so two runs do not take the same rows.
- A job works on many users, so it has no owner filter by design. Say so above the service function: `// backend-check-ignore unscoped-write: scheduled cleanup, runs for all users`.
- Slow jobs: do a batch (for example 100 rows) per run.

## 12. Public form with a rate limit

Sign-up, contact, "forgot password", invites and anything that sends an email can be abused by a script. Use `publicAction` (or `publicRoute`) with `rateLimit`. The limit counts per client address for visitors and per user for signed-in users.

```ts
// server/contact/actions.ts
"use server"

import { z } from "zod"
import { publicAction } from "@/server/action"
import { db } from "@/server/db"
import { saveMessage } from "./service"

export const sendContactMessage = publicAction(
  z.object({
    name: z.string().trim().min(1).max(100),
    email: z.email().max(254),
    message: z.string().trim().min(1).max(2000),
  }),
  async ({ input }) => {
    await saveMessage(db, input)
    return { sent: true }
  },
  { rateLimit: { key: "contact.send", limit: 5, windowSeconds: 600 } },
)
```

- The default limiter lives in the memory of one server process. On Vercel or any host with several instances, every instance counts on its own, so the limit is weaker than it looks. Replace the body of `rateLimit()` in `server/rate-limit.ts` with a shared store (Upstash Redis or a database table). Keep the function signature. For a limit that must hold across servers without Redis, count the user's own rows in the last hour inside the transaction, after locking the user's row (see pattern 19).
- Behind a proxy, `x-forwarded-for` is only trustworthy when your host sets it. Vercel does.
- Add a bot check (Turnstile or reCAPTCHA) when a form is under attack. That is a product decision: ask the user.
- Do not tell the caller whether an email address has an account ("Email not found"). Answer the same way in both cases.

## 13. Teams and organizations

When data belongs to a team, the owner column is `organizationId`, not `userId`. The rule is the same: every query filters on it, and the id of the organization is **never trusted from the client without a membership check**.

```ts
// server/orgs/membership.ts
import "server-only"
import { and, eq } from "drizzle-orm"
import { forbidden, notFound } from "@/lib/errors"
import type { Db } from "@/server/db"
import { memberships } from "@/server/db/schema"

type Role = "member" | "admin" | "owner"

/**
 * The user's role in the organization.
 * Not a member: 404, the same answer as for an organization that does not exist.
 * A member without the needed role: 403. They already know the organization exists.
 */
export async function requireMember(db: Db, userId: string, orgId: string, allowed: Role[] = ["member", "admin", "owner"]) {
  const [row] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)))
    .limit(1)
  if (!row) throw notFound("Organization")
  if (!allowed.includes(row.role)) throw forbidden("You are not allowed to do this.")
  return row.role
}
```

- The route reads `orgId` from the URL (`/api/orgs/[orgId]/projects`) and validates it as a uuid. The handler calls `requireMember(db, user.id, params.orgId)` first, then the service with `orgId`.
- Every service function takes `(db, orgId, ...)` and filters every query by `orgId` in the same `where`, exactly like `userId` above.
- Roles are checked on the server for each action (`requireMember(..., ["admin", "owner"])`). Hiding a button is not security.
- The unique rules include the organization: `unique().on(t.orgId, t.slug)`.
- Removing a member or changing a role must also stop their access at once. Do not cache roles in a cookie.
- One owner per organization: let the database enforce it with a partial unique index, `uniqueIndex("one_owner").on(t.orgId).where(sql\`role = 'owner'\`)`. The owner cannot be removed. Only the owner changes an admin.
- Ids in the body (a `projectId` that belongs to another organization) are loaded with the `orgId` filter before they are used.

## 14. File uploads

Not implemented in the example app. Follow these rules.

- Upload straight to object storage (S3, R2, Vercel Blob, UploadThing) with a presigned URL or the provider's SDK. Do not stream big files through a route handler.
- Your server creates the upload URL after it checks the user. It sets the allowed content type and the maximum size. The object key is `${userId}/${crypto.randomUUID()}`. Never build it from the client's file name.
- Allow-list the types (for example `image/png`, `image/jpeg`, `application/pdf`). Do not trust the file name or the `Content-Type` the client sends. If you process the file, check its first bytes.
- Never serve user-uploaded HTML, SVG or JavaScript from your own domain: it runs with your cookies. Serve it as a download (`Content-Disposition: attachment`) or from a separate domain.
- Save the key and the owner in your database. Check the owner before you give out a download URL.
- Limit the number and total size of files per user. Delete files when the row that owns them is deleted.

## 15. Money, dates, ids

- Money: whole cents in an `integer` column and in JSON (`amountCents`). Convert user input with `toCents("12.34")` from `lib/money.ts` (it refuses `"1.005"` and never multiplies floats). Show it with `formatMoney(cents, currency)`. For a currency with no cents (JPY) or three decimals, store the smallest unit and adapt the helper.
- Dates and times: store `timestamp with time zone`. Send ISO strings. Calendar days with no time (a due date) are `date` columns and `YYYY-MM-DD` strings.
- Ids: `uuid` (or the text id of your auth library). Do not use counting integers for user-owned data.
- Do not use `Math.random()` for ids or tokens. Use `crypto.randomUUID()` or `crypto.randomBytes(32).toString("hex")`. Store only a hash of a token (invite links, password resets), and give it an expiry.

## 16. Errors you throw

Throw these from services. The helper turns them into the right status and a safe message.

| Throw | Status | Use it when |
|---|---|---|
| `notFound("Invoice")` | 404 | the record is missing **or belongs to someone else** |
| `conflict("...")` | 409 | a duplicate, or the record is in a state that forbids this |
| `unprocessable("...")` | 422 | the request is well formed but a business rule says no |
| `forbidden("...")` | 403 | the person may not do this and knowing it exists is no secret (a role check) |
| `new AppError("RATE_LIMITED", ...)` | 429 | the rate limiter does this for you |
| anything else | 500 | a bug. It is logged with details. The client only sees "Something went wrong." |

Validation errors become 400 with `error.fields`. A missing session is 401. Do not catch an error just to hide it. If you catch, handle it, or log it with `logError()` and rethrow.

## 17. Testing

Service tests are the most useful tests. They run the real SQL on a real Postgres (PGlite, in memory, about 100 ms to start), so unique constraints, foreign keys and transactions behave like production. Do not mock the ORM: a mock can only confirm what you already believe.

For every service function, test:

1. **Wrong owner:** another user's record is `NOT_FOUND` for get, update and delete, and it is unchanged afterwards.
2. **Invalid input:** the validator rejects it (a test per rule).
3. **Duplicate:** the second create is `CONFLICT`. Add the same call twice with `Promise.allSettled` to prove it also holds for two requests at the same time.
4. **Rollback:** a failure in the middle leaves nothing behind.
5. **Repeat:** the same webhook or action twice changes nothing the second time.
6. **Fields:** the DTO has exactly the listed fields.

```ts
// test/invoices.service.test.ts (excerpt)
describe("ownership", () => {
  it("get, update and delete treat someone else's invoice as missing", async () => {
    const theirs = await service.createInvoice(db, bob.id, base)
    await expect(service.getInvoice(db, alice.id, theirs.id)).rejects.toMatchObject({ code: "NOT_FOUND" })
    await expect(service.updateInvoice(db, alice.id, theirs.id, { customerName: "Hacked" })).rejects.toMatchObject({ code: "NOT_FOUND" })
    await expect(service.deleteInvoice(db, alice.id, theirs.id)).rejects.toMatchObject({ code: "NOT_FOUND" })
    const after = await service.getInvoice(db, bob.id, theirs.id)
    expect(after.customerName).toBe("Northwind Traders")
  })

  it("list only returns the user's own invoices", async () => {
    await service.createInvoice(db, alice.id, base)
    await service.createInvoice(db, bob.id, { ...base, number: "INV-002" })
    const page = await service.listInvoices(db, alice.id, { limit: 20, offset: 0 })
    expect(page.total).toBe(1)
    expect(page.items.map((i) => i.number)).toEqual(["INV-001"])
  })
})
```

```ts
// test/invoices.service.test.ts (excerpt)
  it("two requests at the same time cannot both create the same number", async () => {
    const results = await Promise.allSettled([service.createInvoice(db, alice.id, base), service.createInvoice(db, alice.id, base)])
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1)
    const rejected = results.find((r) => r.status === "rejected")
    expect(rejected).toMatchObject({ reason: { code: "CONFLICT" } })
  })
```

```ts
// test/invoices.service.test.ts (excerpt)
  it("a wrong amount is refused and leaves no payment row behind (rollback)", async () => {
    const inv = await service.createInvoice(db, alice.id, base)
    await expect(service.recordPayment(db, { id: "evt_1", invoiceId: inv.id, amountCents: 1 })).rejects.toMatchObject({ code: "UNPROCESSABLE" })
    expect(await paymentCount(inv.id)).toBe(0)
    expect((await service.getInvoice(db, alice.id, inv.id)).status).toBe("draft")
  })
```

Route tests call the exported handlers directly (no server). Replace only the session and the database:

```ts
vi.mock("@/server/db", () => ({ get db() { return held.db } }))
vi.mock("@/server/auth", async () => { /* requireUser returns held.user, or throws UNAUTHORIZED */ })
```

See `examples/invoices/test/api.test.ts` for the full file: signed out (401), wrong owner (404), bad input (400), duplicate (409), unknown fields ignored, too many results (400).

Run `npm test`. Commands: `npx vitest run test/projects.service.test.ts` for one file.

## 18. Drizzle and Prisma side by side

The rules are the same. Only the calls differ. Prisma 7 needs a driver adapter (`@prisma/adapter-pg`) and a `prisma.config.ts`. It does not read `.env` by itself.

| Task | Drizzle | Prisma 7 |
|---|---|---|
| Owner-scoped read | `db.select().from(t).where(and(eq(t.id, id), eq(t.userId, userId))).limit(1)` | `db.t.findFirst({ where: { id, userId } })` |
| Owner-scoped update | `db.update(t).set(patch).where(and(eq(t.id, id), eq(t.userId, userId))).returning()`, no row = not found | `db.t.update({ where: { id, userId }, data })`, throws `P2025` when none matches (`isRecordNotFound`) |
| Owner-scoped delete | `db.delete(t).where(...).returning({ id })`, no row = not found | `db.t.delete({ where: { id, userId } })`, `P2025` when none matches |
| Duplicate | `isUniqueViolation(err)` | the same helper (`P2002`) |
| Foreign key stops a delete | `isForeignKeyViolation(err)` | the same helper (`P2003`) |
| Transaction | `db.transaction(async (tx) => ...)` | `db.$transaction(async (tx) => ...)` |
| Ignore a duplicate insert | `.onConflictDoNothing({ target }).returning()`, 0 rows = duplicate | `createMany({ data: [...], skipDuplicates: true })`, `count` 0 = duplicate |
| Only one request wins | `.for("update")` on the select, or a conditional update | `updateMany({ where: { id, status: { not: "paid" } }, data })`, check `count` |
| Count | `sql<number>\`count(*)::int\`` | `db.t.count({ where })` |
| Schema changes | `drizzle-kit generate` then `migrate` | `prisma migrate dev` (local), `prisma migrate deploy` (production) |

Prisma returns `DateTime` as `Date`. A `@db.Date` column comes back at UTC midnight: format it with `toISOString().slice(0, 10)` (see `examples/invoices-prisma/server/invoices/service.ts`).

## 19. One-time tokens: invitations, password reset, email verification

A token that arrives by email or in a link is a password. Treat it like one. The example is a team invitation. The same shape fits a password reset and an email check.

Here the members table is `teamMembers` (`teamId`, `userId`, `role`). `requireMember` from pattern 13 must read the same table, so change its table and column names to match. The email you compare with must be a verified email: turn on email verification in your auth library, or anyone can sign up with the invited address.

```ts
// server/db/schema.ts: the invitation table
export const teamInvitations = pgTable(
  "team_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
    email: text("email").notNull(), // always lower case
    role: text("role", { enum: ["admin", "member"] }).notNull(),
    tokenHash: text("token_hash").notNull().unique(), // SHA-256 of the token. The token itself is never stored.
    invitedById: uuid("invited_by_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("team_invitations_team_id_idx").on(t.teamId),
    index("team_invitations_invited_by_idx").on(t.invitedById),
    // At most one pending invitation per team and email. The database decides, not a "check first".
    uniqueIndex("team_invitations_one_pending_idx")
      .on(t.teamId, t.email)
      .where(sql`accepted_at is null and revoked_at is null`),
  ],
)
```

```ts
// server/invitations/token.ts
import "server-only"
import { createHash, randomBytes } from "node:crypto"

export const newToken = () => randomBytes(32).toString("base64url")
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex")
```

```ts
// server/invitations/service.ts
import "server-only"
import { and, eq, gt, isNull, sql } from "drizzle-orm"
import { conflict, forbidden, notFound } from "@/lib/errors"
import type { Db } from "@/server/db"
import { isUniqueViolation } from "@/server/errors"
import { teamInvitations, teamMembers } from "@/server/db/schema"
import { requireMember } from "@/server/orgs/membership"
import { hashToken, newToken } from "./token"

export async function createInvitation(db: Db, userId: string, teamId: string, input: { email: string; role: "admin" | "member" }) {
  const email = input.email.trim().toLowerCase()
  try {
    return await db.transaction(async (tx) => {
      const callerRole = await requireMember(tx, userId, teamId, ["owner", "admin"])
      if (input.role === "admin" && callerRole !== "owner") throw forbidden("Only the owner can invite an admin.")
      // An expired invitation is not pending any more. Revoke it, or the unique index would block a new one for ever.
      await tx
        .update(teamInvitations)
        .set({ revokedAt: sql`now()` })
        .where(and(eq(teamInvitations.teamId, teamId), eq(teamInvitations.email, email), isNull(teamInvitations.acceptedAt), isNull(teamInvitations.revokedAt), sql`${teamInvitations.expiresAt} <= now()`))
      const token = newToken()
      const [row] = await tx
        .insert(teamInvitations)
        .values({ teamId, email, role: input.role, tokenHash: hashToken(token), invitedById: userId, expiresAt: sql`now() + interval '7 days'` })
        .returning({ id: teamInvitations.id, email: teamInvitations.email, role: teamInvitations.role, expiresAt: teamInvitations.expiresAt })
      return { ...row!, token } // the only time the token is shown. In a real app, send it by email.
    })
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict("This person already has a pending invitation.")
    throw err
  }
}

export async function acceptInvitation(db: Db, userId: string, userEmail: string, token: string) {
  return db.transaction(async (tx) => {
    // ONE atomic UPDATE claims the token. It matches only a usable invitation for THIS email.
    // Two requests at once cannot both match. A wrong person matches nothing, so the token is not used up.
    // backend-check-ignore unscoped-write: the invitee has no team id yet. The row is claimed by its secret token and the signed-in user's email.
    const [claimed] = await tx
      .update(teamInvitations)
      .set({ acceptedAt: sql`now()` })
      .where(
        and(
          eq(teamInvitations.tokenHash, hashToken(token)),
          eq(teamInvitations.email, userEmail.toLowerCase()),
          isNull(teamInvitations.acceptedAt),
          isNull(teamInvitations.revokedAt),
          gt(teamInvitations.expiresAt, sql`now()`),
        ),
      )
      .returning({ teamId: teamInvitations.teamId, role: teamInvitations.role })
    if (!claimed) throw notFound("Invitation") // unknown, used, expired, revoked or for someone else: the same answer

    const [joined] = await tx
      .insert(teamMembers)
      .values({ teamId: claimed.teamId, userId, role: claimed.role })
      .onConflictDoNothing()
      .returning({ userId: teamMembers.userId })
    if (!joined) throw conflict("You are already a member of this team.") // the throw rolls back the claim above
    return { teamId: claimed.teamId, role: claimed.role }
  })
}
```

- Make the token with `randomBytes(32)`. Store only its hash. A leaked database then holds nothing that works.
- Every reason a token cannot be used gives the same 404. A caller must not learn whether a token exists, or that it belongs to someone else.
- Use the database clock (`now()`) for the expiry, in the same statement that uses it.
- A list of pending invitations shows `id, email, role, expiresAt, createdAt`. Never the token or its hash.
- A limit per sender that must hold on every server: in the same transaction, lock the sender's row (`tx.select().from(users).where(eq(users.id, userId)).for("update")`), count their invitations from the last hour, and refuse at the limit. This works where the in-memory `rateLimit()` does not.
- Revoking twice may answer 204 (nothing left to do) or 404. Choose one and keep it.
- Password reset and email verification have the same shape: a random token, only the hash stored, one atomic claim, a short expiry (an hour), and the user's other open tokens removed after use. A reset request answers the same way whether or not the email has an account.
- Never write a token into a log, an error message or analytics.
