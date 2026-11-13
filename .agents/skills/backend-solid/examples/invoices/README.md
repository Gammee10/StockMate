# Example: invoices

A small but complete backend feature: invoices that belong to a user, and a payment webhook that marks them paid. It uses every pattern in `references/patterns.md`. **Read it. Do not copy it wholesale.** Copy the shape of one file when you build something similar.

| File | Pattern |
|---|---|
| `server/db/schema.ts` | owner column, unique and index, cents, enum, `onDelete` |
| `server/invoices/validators.ts` | zod schemas: create, update without defaults, params, list query |
| `server/invoices/service.ts` | owner-scoped reads and writes, DTOs, 409 on duplicate, transaction + idempotent webhook |
| `server/invoices/actions.ts` | server actions: helper, service, `revalidatePath` |
| `app/api/invoices/route.ts`, `app/api/invoices/[id]/route.ts` | thin route handlers |
| `app/api/webhooks/payments/route.ts` | signed webhook |
| `app/invoices/page.tsx`, `app/invoices/new/page.tsx` | a Server Component page, and a client form that calls the action |
| `test/*.test.ts` | service tests, validator tests, route tests |

## Run its tests

In a scratch Next.js project (or a copy of your project):

1. Copy `templates/common/` and `templates/drizzle/` to the project root.
2. Copy this folder on top of it.
3. The webhook needs one setting. In `server/env.ts` add `PAYMENTS_WEBHOOK_SECRET: z.string().min(16),` to the schema. In `vitest.config.mts` add `PAYMENTS_WEBHOOK_SECRET: "test-webhook-secret-0123456789",` to `test.env`.
4. `npm install zod server-only`, then `npm install -D vitest @electric-sql/pglite drizzle-kit drizzle-orm pg @types/pg`, then `npm test`.

All 124 tests should pass. In the reference project the example passes `npm run backend:check`. Its only two ignores are the webhook function, which has no signed-in user on purpose.
