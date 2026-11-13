---
name: backend-solid
description: Required for ANY task that creates or changes backend code in this Next.js app: API route handlers, server actions, database schema or queries, auth and permissions, webhooks, scheduled jobs, environment variables, validation, error handling, or fixing a server-side bug. Gives a safe structure, copy-paste patterns and a checker script so the backend is secure, correct on retries and parallel requests, and testable. Use it even for small changes.
---

# Backend solid

Goal: a backend that is safe, correct and boring. Not clever.

Backend bugs do not show in a demo. A missing owner check works until a user changes an id in the URL. A missing transaction works until a request fails halfway. A missing unique constraint works until two requests arrive together. So these rules are strict, and the project has helpers that make the safe way the easy way. Use them. Do not write your own auth, validation, error handling or SQL strings.

## Workflow

Follow these steps in order.

1. **Check the foundation.** Run `npm run backend:check`. If it says "SETUP NEEDED" or the script is missing, do `references/setup.md` first.
2. **Look before you build.** Open one existing service and one route or action that are close to what you build. Match them. Read `server/api.ts` and `server/action.ts` to see what the helpers do. Do not guess.
3. **Pick a pattern.** Open `references/patterns.md` and copy the closest one. A complete worked example is in `examples/invoices/`.
4. **Answer the six questions** below for every route handler and server action, before you write code. If you cannot tell who may see or change something, ask the user. Do not guess permissions.
5. **Build** with the rules below. Write the tests as you go.
6. **Run the checks:** `npm run typecheck`, `npm test`, `npm run backend:check`. Fix every FAIL. Fix every WARN too, unless you have a clear reason. Do not say you are done while a check fails. Never weaken a rule, an owner filter or a test to make a check pass.
7. **Review** with `references/review.md`.
8. **Report** in a few lines: what you changed, who can call each new endpoint, what you could not test, and every `backend-check-ignore` you wrote, with its reason.

## The six questions

Ask them for every entry point (route handler or server action). A wrong answer to any one of them is a bug.

1. **Who is calling?** Use `userRoute`, `adminRoute`, `publicRoute`, `webhookRoute`, `cronRoute` (or `userAction`, `adminAction`, `publicAction`). Never read cookies, headers or a user id from the request yourself.
2. **Are they allowed?** The owner is in the same `where` as the id: `and(eq(t.id, id), eq(t.userId, user.id))`. Someone else's record and a missing record both give the same 404. In a team, a non-member gets that 404 too, and a member without the needed role gets 403.
3. **Is the input valid?** A zod schema with max lengths, ranges and enums, passed to the helper. Never `as`, never `any`, never a raw `request.json()`.
4. **What if it fails halfway?** Two or more writes are one `db.transaction`, and every query inside uses `tx`.
5. **What if it runs twice, or at the same time?** The database decides: a unique constraint (catch the violation), `onConflictDoNothing`, or a conditional `UPDATE ... WHERE status = 'draft'`. Never "check, then insert".
6. **What does it return and log?** A DTO that lists its fields one by one, never the raw row. Never `error.message` to the client. Never a password, token, cookie or secret in a log.

## Structure

```
app/api/<thing>/route.ts       thin: helper + one service call
server/<thing>/validators.ts   zod schemas
server/<thing>/service.ts      the logic: plain functions (db, userId, input)
server/<thing>/actions.ts      "use server": helper + service + revalidatePath
server/db/schema.ts            all tables
server/db/index.ts             the one database client
server/auth.ts                 the one place that talks to the auth library
server/env.ts                  the one place that reads process.env
server/api.ts, server/action.ts   the safe helpers
lib/                           safe for the browser: errors, money
test/                          vitest. Service tests use a real database
```

- Route files and actions are thin: helper, one service call, return. No `db.` in them.
- A service knows nothing about `Request`, cookies or `next/*`. That keeps it testable.
- Use the folder layout the project already has (for example `src/`). Keep the same roles.

## Rules

### Access
- Every route handler and server action is a public endpoint. Build it with a helper. A bare `export async function POST(request)` is a bug.
- The user id comes from the session (`user.id`). Never from the body, the query string or a header.
- Every query on user data has the owner in the same `where` as the id. Children (payments of an invoice) are read through the parent with the owner in the join.
- A role check lives on the server (`adminRoute`, `adminAction`). Hiding a button is not security.
- `proxy.ts` (was `middleware.ts`) may redirect early. It is never the only check.
- Never build login, passwords, sessions or JWT checks yourself. The project's auth library does that. Only `server/auth.ts` talks to it.

### Input
- Every input has a zod schema: body, query, params, form data. Every string has `.max()`, every number a range. Choices are `z.enum`. Ids are `z.uuid()`.
- Write the parsed value to the database, never the raw body. Otherwise a client can send `role: "admin"` (mass assignment).
- Update schemas: build them from the fields **without defaults**, then `.partial()`.
- Values with business meaning (paid, approved, role) change only through their own function, never through a generic update.
- Lists: `limit` has a maximum (100), a stable `orderBy` (the id last) and a `total`.

### Database
- Money is whole cents (`amountCents`, an integer). Never a float.
- A rule the database can enforce is a constraint: `unique`, foreign key, not null. Catch the violation (`isUniqueViolation`) and answer 409.
- Index every foreign key and every column a list is filtered or sorted by.
- Never query inside a loop. Use `inArray` or a join. Never `select()` a whole table without a limit.
- Never build SQL from strings. Use the ORM, or the `sql` tagged template.
- Change the schema with migrations (`db:generate`, then `db:migrate`). `db:push` is for local experiments.
- The database client is created once, in `server/db/index.ts`.

### Errors, logs, secrets
- Throw `notFound()`, `conflict()` or `unprocessable()` from services. Anything else is a bug: the helper logs it and the client sees a plain message.
- Never send `error.message`, a stack or SQL to the client. Never log passwords, tokens, cookies, `Authorization` headers or whole request bodies.
- Secrets live in `.env.local` and are read only in `server/env.ts`. Never in code, never `NEXT_PUBLIC_`, never in git. `.env*` is in `.gitignore`. `.env.example` has names only.
- Tokens and ids: `crypto.randomUUID()` or `crypto.randomBytes(32)`. Never `Math.random()`.

### Webhooks, jobs, abuse
- A webhook checks the signature on the raw body before it does anything, and is safe to receive twice (`webhookRoute`, a unique event id).
- A scheduled job route checks a secret (`cronRoute`) and is safe to run twice.
- Sign-up, login, password reset, contact, invites and anything that sends email need a `rateLimit`.
- File uploads: `references/patterns.md`, pattern 14.

### Next.js 16
- `cookies()`, `headers()`, `params` and `searchParams` are Promises. `await` them.
- `proxy.ts`, not `middleware.ts`. `revalidateTag("tag", "max")` takes two arguments. In an action you can use `updateTag("tag")`.
- After a write, refresh what the page shows: `revalidatePath("/path")`.
- A `"use server"` file exports only async functions. Schemas and constants go in another file.
- `redirect()` and `notFound()` work by throwing. Do not swallow them in `try/catch`. The helpers already handle this.
- A Server Component calls the service directly. It does not `fetch` its own `/api`.
- Every file in `server/` starts with `import "server-only"` (not `schema.ts`: drizzle-kit loads it).

### Tests
- Test services against a real database (PGlite, in memory). Do not mock the ORM.
- Every new endpoint gets tests for: signed out (401), wrong owner (404), bad input (400), duplicate (409), and a repeat.

## Looks like a weak backend? Replace it.

| If you wrote this | Write this instead |
|---|---|
| `const body = await request.json(); db.insert(t).values(body)` | `userRoute({ body: schema }, ...)`, and write the parsed `body` |
| `where(eq(t.id, id))` on a user's data | `where(and(eq(t.id, id), eq(t.userId, user.id)))` |
| `403 Forbidden` for another user's record | The same 404 as a missing record |
| `catch (e) { return Response.json({ error: e.message }) }` | Throw `AppError`. The helper hides the rest |
| `const dup = await find(); if (!dup) await insert()` | A unique constraint, and catch `isUniqueViolation` |
| `await db.update(a); await db.update(b)` | One `db.transaction`, using `tx` |
| `price: float`, `Number(price) * 100` | `amountCents` integer, `toCents("12.34")` |
| `limit` taken from the client with no maximum | `z.coerce.number().int().min(1).max(100).default(20)` |
| `new PrismaClient()` or `drizzle(...)` in a feature file | `import { db } from "@/server/db"` |
| `process.env.X!` anywhere | Add `X` to `server/env.ts`, use `env.X` |
| An API key in code, or in `NEXT_PUBLIC_` | `.env.local` + `server/env.ts`. Rotate the key that leaked |
| `fetch("/api/...")` in a Server Component | Call the service function |
| `JSON.parse(await request.text())` in a webhook, no signature check | `webhookRoute` |
| An admin check only in the UI | `adminRoute` or `adminAction` |
| `Math.random()` for a token | `crypto.randomBytes(32).toString("hex")` |
| `return row` (the whole database row) | A DTO with the listed fields |
| `console.log(req.headers)` or `console.log(user)` | Log ids and error codes only |
| `const { id } = params` | `const { id } = await params` |

## Fixing existing code

1. Run `npm run backend:check`. Read the whole list before you change anything. If the project has its own helper that checks the session and answers 401, the checker lists it under "Guards found". Use `userRoute` and `userAction` for new code anyway.
2. Fix in this order: committed secrets and `.env` files, then missing auth and owner filters (IDOR), then validation, then transactions and "once only", then error leaks and logs, then the rest.
3. Add a test for each hole you close (wrong owner gives 404).
4. Work one feature at a time. Run the checks after each one. Use `npm run backend:check -- --changed` to check only what you touched.
5. Keep response shapes as they are, unless the user asks. If a fix must change one (for example 403 becomes 404), say so in the report.
6. A secret that was ever committed is leaked. Tell the user to rotate it. Removing it from the code is not enough.

## When someone asks for something special

Keep every other rule. If the user clearly asks for something a rule blocks (a public endpoint, for example), do it and write `// backend-check-ignore <rule-id>: <reason>` on that line or above the function. The reason is required. Put each ignore in your report. Never add an ignore to silence a real problem.

## More help

- `references/patterns.md`: copy-paste patterns (schema, validators, services, routes, actions, webhooks, jobs, teams and roles, one-time tokens such as invitations and password reset, tests).
- `references/review.md`: self-review checklist and how to probe a running server.
- `references/setup.md`: one-time setup (packages, helper files, auth, database, tests, scripts).
- `references/versions.md`: what is different in Next.js 16, Zod 4, Drizzle, Prisma 7 and the auth libraries.
- `examples/`: the full invoices example. `templates/`: the helper files to copy into a project.
