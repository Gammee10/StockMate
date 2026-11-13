# Auth adapters

Your auth library knows who is signed in. `server/auth.ts` is the **only** file that talks to it. The rest of the app calls `requireUser()`, `requireAdmin()` or `requirePageUser()`.

Each folder here has a complete `server/auth.ts` for one library. Copy it over the project's `server/auth.ts`.

| Folder | Library | Extra files |
|---|---|---|
| `better-auth/` | Better Auth 1.7 | `lib/auth.ts` (the library setup), the route at `app/api/auth/[...all]/route.ts`, an optional `proxy.ts` |
| `authjs/` | Auth.js v5 (`next-auth@beta`) | `auth.ts` (setup), the route at `app/api/auth/[...nextauth]/route.ts` |
| `clerk/` | Clerk 7 | an optional `proxy.ts` |

The extra files are only for projects that do not have the library installed yet. If the library is already set up, copy only `server/auth.ts` and keep the project's own setup files (fix the import path at the top if the setup file is somewhere else).

These files were checked with the TypeScript compiler against the library versions above. They were **not** run end to end: no sign-in was done. After you connect one, sign in and confirm that a `userRoute` sees the right `user.id`, and that a signed-out call gets 401.

`proxy.ts` only does an early redirect. It is not the security check. The check happens in `requireUser()`.

User ids: Better Auth uses text ids. If your tables point to the user table, the owner column must have the same type (`text`, not `uuid`).

Roles: each adapter returns `role: "user"`. Return the real role from your user data when the app has admins.
