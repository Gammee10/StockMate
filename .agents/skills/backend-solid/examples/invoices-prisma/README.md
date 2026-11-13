# Example: invoices with Prisma 7

The same feature as `../invoices/`, with the two files that change when you use Prisma:

- `schema.prisma`: the models. Copy the `model` blocks into your `prisma/schema.prisma`.
- `server/invoices/service.ts`: the same functions, written with Prisma calls.

Everything else is identical to `../invoices/` (validators, actions, route handlers, pages), because the services have the same function signatures. Use `templates/prisma/server/db/index.ts` as the database client.

**Status: checked with the TypeScript compiler and with `check-backend.mjs`. Not run against a database.** Run its behavior in your own tests: wrong owner (404), duplicate (409), a repeated webhook, and a failed webhook that must roll back.
