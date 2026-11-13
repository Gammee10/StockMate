# Versions and traps

Checked in November 2026. Libraries change. When something here does not match what you see, trust the error message and the library's own docs, and tell the user.

## What this skill was built and tested with

| Package | Version | How it was checked |
|---|---|---|
| Node | 22 (Next.js 16 needs 20.9 or newer) | run |
| next, react | 16.4.5, 19.3.1 | run: `next build`, `next start`, browser tests |
| zod | 4.6.7 | run |
| drizzle-orm, drizzle-kit | 0.45.4, 0.31.11 | run |
| vitest, @electric-sql/pglite | 5.1.0, 0.5.15 | run |
| typescript | 7.0.2 | run |
| prisma, @prisma/client, @prisma/adapter-pg | 7.10.1 | **type-checked only, not run against a database** |
| better-auth, next-auth, @clerk/nextjs | 1.7.18, 5.0.0-beta.32, 7.9.25 | **type-checked only, not run** |

The invoices example was checked in four ways: 124 unit and route tests on a real Postgres engine (PGlite), a production build with the real HTTP server and 33 requests against it, 9 browser tests (server action and redirect included), and mutation checks (removing a guard on purpose and seeing a test fail).

## Next.js 16 (and 15)

- `cookies()`, `headers()`, `draftMode()`, `params` and `searchParams` are Promises. In 16 the old synchronous use is gone. Write `(await cookies()).get("x")` and `const { id } = await params`.
- `middleware.ts` is now `proxy.ts` with `export function proxy(request)`. Use it for quick, early redirects. It is never the only protection. With Better Auth it can only check that a session cookie exists, not that it is valid.
- `revalidateTag("tag", "max")` takes a second argument. In Server Actions, `updateTag("tag")` makes the next read see the new data at once. `revalidatePath("/path")` is unchanged.
- `next lint` is removed. Run `eslint .` yourself.
- `redirect()` and `notFound()` work by throwing a special error. A `catch` block that swallows it breaks the redirect. Call `unstable_rethrow(err)` (from `next/navigation`) first in the `catch`. The helpers in `server/api.ts` and `server/action.ts` do this.
- A `"use server"` file may export only async functions. `export const x = userAction(...)` is fine, because it is a function. A constant or a zod schema is not.
- Route handlers do not cache `GET` by default. Server Actions check that `Origin` matches `Host` for you. Route handlers do not. `server/api.ts` adds that check for requests that carry cookies.
- A Server Component should call the service function directly. A `fetch` to your own `/api` adds a network hop and does not carry the session.

## Zod 4

- Top-level formats: `z.uuid()`, `z.email()`, `z.url()`, `z.int()`, `z.iso.date()`, `z.iso.datetime()`. The old `z.string().email()` still works but is the old style.
- `z.object` **drops** keys it does not know. That is what stops mass assignment.
- A `.default()` inside a schema that you then make `.partial()` still applies the default. Build update schemas from fields without defaults.
- `z.flattenError(error).fieldErrors` gives `{ field: string[] }`. `error.issues` has the details.
- `z.coerce.number()` turns a query string into a number. Add `.int().min().max()`.

## Drizzle

- Errors are `DrizzleQueryError`. The Postgres code is on `err.cause.code`, and `err.message` contains the **SQL and the parameter values**. Never send it to a client. Log `cause` without the parameters (`logError` does).
- Codes: `23505` unique, `23503` foreign key, `23001` restrict (`ON DELETE RESTRICT`). `isUniqueViolation` and `isForeignKeyViolation` know them.
- `.onConflictDoNothing({ target }).returning()` returns no rows when the insert was skipped. That is how you detect a repeat.
- `.for("update")` locks the selected rows until the transaction ends.
- `.$onUpdate(() => new Date())` keeps `updatedAt` current.
- `drizzle-kit` does not read `.env.local`. `drizzle.config.ts` loads it with `@next/env`.
- `drizzle-kit push` can drop columns. Use `generate` and `migrate` for anything that has data.

## Prisma 7

- It needs a driver adapter: `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`.
- The connection URL for the CLI is in `prisma.config.ts`. `.env` is **not** loaded for you (`import "dotenv/config"`).
- Generator `prisma-client` with an `output` folder. Import the client from there, not from `@prisma/client`.
- The CLI `latest` tag may be a pre-release. Install `prisma@7`, `@prisma/client@7` and `@prisma/adapter-pg@7` together.
- `update({ where: { id, userId } })` is allowed (extra filters on a unique where). It throws `P2025` when nothing matches. `P2002` is a duplicate, `P2003` a foreign key.
- `createMany({ data, skipDuplicates: true })` is `INSERT ... ON CONFLICT DO NOTHING`. It returns `{ count }`.

## Auth libraries

- Auth.js is now part of Better Auth. On npm, `next-auth@latest` is still the old v4. Version 5 is `next-auth@beta`. For a new project use Better Auth.
- Better Auth: mount `toNextJsHandler(auth)` at `app/api/auth/[...all]/route.ts`. Put the `nextCookies()` plugin **last**. Its user ids are text, not uuid.
- Clerk: `auth()` is async. `currentUser()` is an extra network call, so keep your own users table in sync with a webhook once the app grows.
- Supabase Auth: `getSessionUser()` calls `supabase.auth.getUser()` (it checks the token with Supabase, `getSession()` does not). If tables are reachable from the browser with the anon key, turn on Row Level Security for every one of them. This skill has not tested Supabase.
- Never read the user id from the request. Only `server/auth.ts` talks to the library.

## Tests

- Vitest needs an alias for `server-only` (an empty module), the `@/` alias, and the env variables that `server/env.ts` requires. The template `vitest.config.mts` has all three.
- Name the config `.mts`, so Node treats it as ESM.
- PGlite is real Postgres running in WebAssembly. It runs one query at a time. The "two requests at the same time" tests prove that the constraint and the lock logic are right, but they are not a real parallel race. On a real Postgres, the same code is safe because of the unique constraint and the row lock.
- The in-memory rate limiter counts per process. On Vercel or any host with several instances, replace it with a shared store (see `server/rate-limit.ts`).

## Not covered

tRPC and GraphQL servers, server-sent events and WebSockets, queues and background workers, multi-region setups, and payment provider SDKs other than the signature format in `server/webhook.ts`. For these, apply the six questions and ask the user.
