# Templates

Files to copy into a project. `references/setup.md` says when and how.

| Folder | Copy it to | What is in it |
|---|---|---|
| `common/` | the project root (or `src/`) | the route and action helpers, auth stub, env, errors, rate limit, webhook check, money helpers, the Vitest config and the tests of the helpers |
| `drizzle/` | the project root | the database client, an empty starter `schema.ts`, `drizzle.config.ts`, the PGlite test helper |
| `prisma/` | the project root | the Prisma 7 client with its driver adapter, `prisma.config.ts`, a starter schema |
| `auth/` | see `auth/README.md` | `server/auth.ts` for Better Auth, Auth.js v5 and Clerk |

Copy the files, then change them to fit the project. They are the starting point, not a library: after you copy them they belong to the project.

The tests in `common/test/` pass without a database (63 tests). If they pass in the project, the helpers are installed correctly.
