# One-time setup

Do these steps once per project. Skip any step that is already done. Tell the user what you changed. Save the work in git before you start.

Paths below are relative to this skill folder (`.agents/skills/backend-solid/`). If the project keeps its code in `src/`, put the copied files under `src/` and read "project root" as `src/`.

## 1. Check what exists

Read `package.json`, `tsconfig.json` and the folders. Write down:

- Next.js version. This skill expects **16** (App Router, an `app/` folder). On 15 it mostly works: use `middleware.ts` and the one-argument `revalidateTag`. On 14 or older, stop and ask the user: `cookies()`, `headers()` and `params` are not Promises there.
- The database layer: `drizzle-orm` (use `templates/drizzle`), `@prisma/client` (use `templates/prisma`), or neither. If there is neither, ask the user which one to use. Drizzle is the default here.
- The auth library: `better-auth`, `next-auth` or `@auth/core`, `@clerk/nextjs`, `@supabase/ssr`, or none. If there is none, ask the user. **Do not write your own login.** For a new project, Better Auth is the usual choice (Auth.js is now maintained by the Better Auth team).
- Where the code lives: `src/` or the project root. The alias `@/*` in `tsconfig.json` must point there (`"@/*": ["./*"]` or `["./src/*"]`), and `"strict": true` must be on.
- What already exists under `server/`, `lib/` and `test/`. Never overwrite a file you did not write. Compare it and merge.

## 2. Install the packages

```bash
npm install zod server-only
npm install -D vitest@5 @types/node@22
```

Vitest 5 needs Node 22.12 or newer, and `@types/node` 22 or newer. `create-next-app` installs `@types/node@20`, and without `@types/node@22` npm stops with an `ERESOLVE` error. On Node 20, try `vitest@4` and keep `@types/node@20` (this path was not tested).

Drizzle also needs (skip what is there). `drizzle.config.ts` uses `@next/env`, which comes with Next.js. With pnpm, add it yourself (`pnpm add -D @next/env`).

```bash
npm install drizzle-orm pg
npm install -D drizzle-kit @electric-sql/pglite @types/pg
```

Prisma 7 also needs (use the same major version for all three, because the CLI `latest` tag can be a pre-release):

```bash
npm install @prisma/client@7 @prisma/adapter-pg@7 pg
npm install -D prisma@7 dotenv @types/pg
```

## 3. Copy the helper files

Copy everything in `templates/common/` to the project root. Keep the paths:

| File | What it is |
|---|---|
| `server/api.ts` | `userRoute`, `adminRoute`, `publicRoute`, `webhookRoute`, `cronRoute` |
| `server/action.ts` | `userAction`, `adminAction`, `publicAction` |
| `server/auth.ts` | `requireUser`, `requireAdmin`, `requirePageUser`. Step 5 connects it to your auth library |
| `server/env.ts` | the only file that reads `process.env` |
| `server/errors.ts`, `server/validate.ts`, `server/log.ts`, `server/rate-limit.ts`, `server/webhook.ts` | helpers used by the two files above |
| `lib/errors.ts`, `lib/money.ts` | safe for the browser too |
| `vitest.config.mts` | test settings (alias `@/`, empty `server-only`, test env vars) |
| `test/helpers/*`, `test/*.test.ts` | tests of the helpers. They prove the setup works |
| `.env.example` | the variable names |

With a `src/` folder: copy to `src/` and, in `vitest.config.mts`, change `replacement: root` to ``replacement: `${root}src/` ``. Keep `test/` at the project root.

If the project already has a file with one of these names, do not overwrite it. Keep the project's version, add what is missing, and tell the user.

## 4. Database

**Drizzle.** Copy `templates/drizzle/` to the project root: `server/db/index.ts` (the one client), `drizzle.config.ts`, `test/helpers/db.ts`.

- If the project already has a client file (for example `lib/db.ts` or `db/index.ts`), do not create a second client. Make `server/db/index.ts` re-export it (`export { db } from "@/lib/db"`). Keep the `Db` type from the template, with the `schema` import it needs. That type lets a service run inside a transaction too.
- A new project has no schema yet: `templates/drizzle/server/db/schema.ts` is an empty starter with the rules in its comments. Add your tables there (see `examples/invoices/server/db/schema.ts`).
- Keep the schema where it is, but all tables in one place (`server/db/schema.ts`, or the existing file). Update the two imports of `@/server/db/schema` (in `test/helpers/db.ts` and `drizzle.config.ts`) to the real path.
- Add the scripts: `"db:generate": "drizzle-kit generate"`, `"db:migrate": "drizzle-kit migrate"`.
- Existing database with data: `db:generate`, **read the SQL it wrote**, then `db:migrate`. Never run `drizzle-kit push` or a reset against a database that has data you want to keep.

**Prisma 7.** Copy `templates/prisma/` to the project root: `server/db/index.ts`, `prisma.config.ts`, `prisma/schema.prisma`.

- Prisma 7 needs a driver adapter (`@prisma/adapter-pg`) and does not read `.env` by itself. `prisma.config.ts` loads it with `dotenv/config`. Use `.env` there, or change the line to load `.env.local`.
- The client is generated into `generated/prisma` (add it to `.gitignore`). Run `npx prisma generate` after every schema change. Add `"postinstall": "prisma generate"` so CI and deploys do it too.
- If the project already has a `schema.prisma`, keep its models. Take only the `generator` and `datasource` blocks from the template if it has none that fit.
- Tests: the PGlite helper is for Drizzle only. With Prisma, tests need a real Postgres test database: set `TEST_DATABASE_URL`, apply the migrations to it, and empty the tables before each test.
- The Prisma files in this skill were checked with the TypeScript compiler. They were not run against a database. Run the service tests early, and tell the user if something does not behave as `references/patterns.md` says.

## 5. Connect your auth library

Open `server/auth.ts`. It has `getSessionUser()`, which must return `{ id, email, role }` for the signed-in user, or `null`.

- Better Auth, Auth.js v5 or Clerk: copy `templates/auth/<library>/server/auth.ts` over `server/auth.ts`. The other files in that folder (`lib/auth.ts`, the route, `proxy.ts`) are only needed when the library is not yet installed in the project. Read `templates/auth/README.md`.
- Another library (Supabase Auth, Lucia, a custom session): write `getSessionUser()` with the same return type. Keep `requireUser`, `requireAdmin` and `requirePageUser` as they are.
- Roles: `role` is `"user"` unless your user data says `"admin"`. Return the real role.
- If the project's users have a different id type (Better Auth uses text ids), the owner columns in your tables use the same type.
- Check it: sign in, call a `userRoute` and see that `user.id` is right. A signed-out call must answer 401.

## 6. Environment variables

1. Find every use of `process.env` in server code: `grep -rn "process.env" app server lib src --include=*.ts --include=*.tsx`.
2. Add each server-side variable to the zod schema in `server/env.ts`. Replace the uses with `import { env } from "@/server/env"` and `env.NAME`.
3. List every name in `.env.example` (no values). The real values stay in `.env.local`.
4. `.gitignore` must contain `.env*` and `!.env.example`. If a real `.env` is tracked by git, run `git rm --cached .env` and tell the user to rotate every secret in it.
5. `NEXT_PUBLIC_` variables are public. Only publishable keys belong there.
6. If `next build` runs somewhere without secrets (Docker, CI), build with `SKIP_ENV_VALIDATION=1`. The running server still validates its variables at startup.
7. Add the test values to `test.env` in `vitest.config.mts` for every variable `server/env.ts` requires.

## 7. Scripts

In `package.json`:

```json
"scripts": {
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "backend:check": "node .agents/skills/backend-solid/scripts/check-backend.mjs"
}
```

Keep the scripts that exist. If the skill folder is somewhere else, change the path. `next lint` no longer exists in Next.js 16: use `"lint": "eslint ."`.

The skill folder has example and template `.ts` files. `tsc` and `next build` skip it (they do not look inside `.agents/`). ESLint does not skip it. If the project uses ESLint, add `.agents/**` to the ignored paths in `eslint.config.mjs` (`globalIgnores([".agents/**"])`).

```bash
npm run backend:check                      # check app/, src/, server/, lib/, pages/, components/, db/
npm run backend:check -- app/api/orders    # check one folder or file
npm run backend:check -- --changed         # check only files changed in git
```

## 8. Prove it works

```bash
npm run typecheck
npm test
npm run backend:check
```

- `npm test` runs the tests of the helpers (63 tests, no database needed). They must pass. If not, the setup is wrong: fix it before you build anything.
- `npm run typecheck` must have no errors.
- `npm run backend:check` should have no "SETUP NEEDED". It will list problems in the existing code. That list is the work to do next. Go through it as described in `SKILL.md` ("Fixing existing code").

## 9. Tell the user

Say in a few lines: what you installed, which files you added or changed, which auth library and database layer you connected, and what the checker found in the existing code. Remind them to add the backend rule from `ANTIGRAVITY-SETUP.md` to `AGENTS.md`, so future tasks load this skill.
