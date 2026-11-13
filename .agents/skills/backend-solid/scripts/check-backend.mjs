#!/usr/bin/env node
/**
 * backend-solid checker
 *
 * Finds the most common backend mistakes in a Next.js app: missing auth checks, missing owner filters,
 * unvalidated input, leaked secrets and errors, writes without a transaction, webhooks without a signature
 * check, and Next.js 15/16 traps. No dependencies. Needs Node 18 or newer.
 *
 * Usage:
 *   node check-backend.mjs                  check app/, src/, server/, lib/, pages/, components/, db/
 *   node check-backend.mjs app/api/orders   check one folder or file (you can pass several)
 *   node check-backend.mjs --changed        check only files changed in git (staged, unstaged, new)
 *   node check-backend.mjs --include-tests  also check test files (normally skipped)
 *   node check-backend.mjs --skip-setup     do not check that the server/ helpers exist
 *   node check-backend.mjs --json           print the result as JSON
 *
 * Exit code: 0 = no FAIL, 1 = at least one FAIL, 2 = setup missing or bad usage.
 *
 * Escape hatch: a comment on the same line, on the line above, or above the enclosing function:
 *   // backend-check-ignore <rule-id>: <reason>
 * The reason is required. Every ignore is listed in the report.
 * Put `backend-check-ignore-file: <reason>` in the first 5 lines to skip a whole file.
 *
 * Project settings (optional) in package.json:
 *   "backendCheck": { "guards": ["requireTenant", "protectedProcedure"] }
 * Guards are function names that check who is calling. The checker already knows the usual ones.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { extname, join, relative, resolve } from "node:path"

const argv = process.argv.slice(2)
const flags = new Set(argv.filter((a) => a.startsWith("--")))
const targets = argv.filter((a) => !a.startsWith("--") && a !== "-h")
const cwd = process.cwd()

if (flags.has("--help") || argv.includes("-h")) {
  writeSync(
    1,
    [
      "backend-solid checker. Run it from the project root. No dependencies.",
      "",
      "  node check-backend.mjs                  check app/, src/, server/, lib/, pages/, components/, db/",
      "  node check-backend.mjs app/api/orders   check one folder or file (you can pass several)",
      "  node check-backend.mjs --changed        check only files changed in git",
      "  node check-backend.mjs --include-tests  also check test files",
      "  node check-backend.mjs --skip-setup     do not check that the server/ helpers exist",
      "  node check-backend.mjs --json           print the result as JSON",
      "",
      "FAIL = a bug or a real risk. Fix it. WARN = look at it.",
      "Silence one finding on purpose: // backend-check-ignore <rule-id>: <reason>  (the reason is required)",
      "Exit code: 0 = no FAIL, 1 = at least one FAIL, 2 = setup missing or bad usage.",
      "",
    ].join("\n"),
  )
  process.exit(0)
}

const MAX_PER_FILE = 40
const MAX_TOTAL = 120
const toPosix = (p) => p.split("\\").join("/")

/** Bad usage: print one short message on stderr and stop. The message is written synchronously, so it is never cut off. */
function die(message) {
  try {
    writeSync(2, message + "\n")
  } catch {
    console.error(message)
  }
  process.exit(2)
}

/* ------------------------------------------------------------ project facts */

function readJson(file) {
  try {
    return JSON.parse(readFileSync(join(cwd, file), "utf8"))
  } catch {
    return null
  }
}
const pkg = readJson("package.json")
const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) }
const nextMajor = (() => {
  const v = String(deps.next ?? "")
  const m = /(\d+)\./.exec(v.replace(/^[^\d]*/, "")) ?? /(\d+)/.exec(v)
  return m ? Number(m[1]) : 16 // unknown or "latest": assume the newest rules
})()
const customGuards = Array.isArray(pkg?.backendCheck?.guards) ? pkg.backendCheck.guards.map(String) : []

const stack = [
  deps.next ? `next ${deps.next.replace(/^[^\d]*/, "")}` : null,
  deps["drizzle-orm"] ? "drizzle" : null,
  deps["@prisma/client"] || deps.prisma ? "prisma" : null,
  deps["better-auth"] ? "better-auth" : deps["next-auth"] || deps["@auth/core"] ? "auth.js" : deps["@clerk/nextjs"] ? "clerk" : deps["@supabase/supabase-js"] ? "supabase" : null,
].filter(Boolean)

/* --------------------------------------------------------------- rule names */

const FIX = {
  "entry-no-guard":
    "Every route handler and server action is a public endpoint. Build it with userRoute / adminRoute / userAction / adminAction (server/api.ts, server/action.ts), or call requireUser() first. Public on purpose? Use publicRoute / publicAction / webhookRoute / cronRoute, or add a backend-check-ignore comment with the reason. A helper of your own that checks the session and answers 401 is found by itself when it is in server/, lib/ or src/; if the check lives somewhere else, add the helper's name to backendCheck.guards in package.json.",
  "entry-no-validation":
    "Validate the input with zod before you use it. Put the schema in validators.ts and pass it to the wrapper: userRoute({ body: schema }, ...) or userAction(schema, ...).",
  "fat-entry-point":
    "Move the database code into server/<domain>/service.ts as a function (db, userId, input) and call it from here. Services can be tested. Route handlers and actions stay thin.",
  "unscoped-write":
    "This update or delete is not limited to the current user. Put the owner in the same where clause: where(and(eq(t.id, id), eq(t.userId, user.id))). If nothing matches, throw notFound().",
  "unscoped-read":
    "This lookup by id does not check the owner, so one user can read another user's record (IDOR). Add the owner to the where clause and return 404 when nothing matches. Shared data? Add a backend-check-ignore comment with the reason.",
  "tx-not-used":
    "Inside db.transaction(async (tx) => ...) every query must use tx, not db. A query on db runs outside the transaction and is not rolled back.",
  "multi-write-no-transaction":
    "Two or more writes in one function need one transaction: db.transaction(async (tx) => { ... }). Otherwise a failure halfway leaves half-saved data.",
  "check-then-insert":
    "Do not check and then insert. Two requests at the same time both pass the check. Add a unique constraint and catch isUniqueViolation(err), or use onConflictDoNothing().",
  "unbounded-query":
    "A list query needs a limit. Add .limit(n) (Prisma: take: n) and pagination (limit and offset, max 100).",
  "n-plus-one":
    "A database query inside a loop runs once per item. Fetch everything in one query (inArray / where in / join) and group the rows in memory.",
  "money-float":
    "Never store money as a float. Use an integer number of cents (amountCents: integer). Convert with toCents() from lib/money.ts.",
  "fk-no-index":
    "Postgres does not index foreign keys for you. Add index('name').on(t.column) (Prisma: @@index([column])). Without it, joins and deletes get slow.",
  "db-client-in-handler":
    "Create the database client once, in server/db/index.ts, and import { db } from there. A new client per request exhausts the connection limit.",
  "sql-injection":
    "Never build SQL from strings. Use the ORM, or a tagged template: sql`... ${value}` (Prisma: $queryRaw`...`). Both send values as parameters.",
  "raw-sql-unsafe": "Prefer $queryRaw`...` (tagged template). The Unsafe versions only protect you when you pass values as separate parameters.",
  "public-secret":
    "NEXT_PUBLIC_ variables are sent to every browser. A secret must never start with NEXT_PUBLIC_. Rename it and read it only in server code through server/env.ts.",
  "public-key-check": "Anything named NEXT_PUBLIC_ is public. Make sure this one is a publishable key (restricted to your domain), not a secret.",
  "hardcoded-secret": "Secrets never go in code. Put the value in .env.local, declare it in server/env.ts, and rotate the leaked one. It stays in git history.",
  "env-direct": "Read environment variables only in server/env.ts, then import { env } from '@/server/env'. That validates them at startup and gives types.",
  "gitignore-env": "Add `.env*` and `!.env.example` to .gitignore. A committed .env leaks every secret.",
  "env-tracked": "A .env file is committed. Run `git rm --cached <file>`, add it to .gitignore, and rotate every secret in it (they stay in git history).",
  "env-example-missing": "Add a .env.example with every variable name (no real values) so others know what to set.",
  "weak-hash": "Never hash passwords with md5, sha1 or sha256. Use the auth library, or argon2 / bcrypt / scrypt.",
  "math-random-secret": "Math.random() is predictable. For tokens, codes and ids use crypto.randomUUID() or crypto.randomBytes(32).toString('hex').",
  "cookie-no-httponly": "Session and token cookies need httpOnly: true, secure: true (in production) and sameSite: 'lax'. Better: let the auth library set them.",
  "token-in-storage": "A token in localStorage can be stolen by any script on the page. Use an httpOnly cookie (the auth library does this).",
  "eval-use": "Never run strings as code (eval, new Function). Find another way.",
  "exec-injection": "Do not pass user input to a shell. Use execFile with an argument array, or a library.",
  "error-leak": "Never send error.message or a stack to the client: it can contain SQL, file paths or secrets. Throw AppError for expected problems. Use the wrappers: they hide everything else and log the details.",
  "empty-catch": "An empty catch hides failures. Handle the error, rethrow it, or log it with logError().",
  "console-secret": "Never log passwords, tokens, cookies or authorization headers.",
  "any-in-server": "Avoid `any` in server code. Use zod's z.infer types or unknown, and narrow it.",
  "ts-suppress": "Fix the type error instead of hiding it. If you must suppress it, write why in the same comment.",
  "jwt-decode": "decode() does not check the signature. Use verify() (jsonwebtoken) or jwtVerify() (jose), or the auth library.",
  "hand-rolled-auth": "Do not build login, passwords or sessions yourself. Use the project's auth library (Better Auth, Auth.js, Clerk or Supabase Auth).",
  "cors-wildcard": "Access-Control-Allow-Origin: * together with credentials is not allowed and not safe. Allow one named origin.",
  "cors-reflect": "Do not copy the request Origin header into Access-Control-Allow-Origin. Compare it with an allow list.",
  "no-rate-limit": "Login, sign-up, password reset, contact and invite endpoints need a rate limit. Pass { rateLimit: { key, limit, windowSeconds } } to the wrapper.",
  "webhook-no-signature": "A webhook must verify the signature before it does anything. Use webhookRoute (server/api.ts), or the provider's verify function.",
  "webhook-json-body": "Verify the signature on the raw text of the body: await request.text(). Parse JSON only after the signature is valid. webhookRoute does this for you.",
  "webhook-no-idempotency": "Providers send the same event more than once. Store the event id with a unique constraint and use onConflictDoNothing() so a repeat does nothing.",
  "sync-dynamic-api": "In Next.js 15 and 16, cookies(), headers() and draftMode() return a Promise. Write (await cookies()).get(...). Do not call it without await.",
  "sync-params": "In Next.js 15 and 16, params and searchParams are Promises. Type: { params }: { params: Promise<{ id: string }> } and use const { id } = await params.",
  "middleware-renamed": "Next.js 16 renamed middleware.ts to proxy.ts (export function proxy). Rename it, unless you need the edge runtime. Use it only for quick checks, never as the only protection.",
  "revalidate-tag-args": "Next.js 16: revalidateTag needs a second argument: revalidateTag('tag', 'max'). In server actions you can use updateTag('tag').",
  "next-lint-script": "`next lint` was removed in Next.js 16. Run eslint directly: \"lint\": \"eslint .\".",
  "client-imports-server": "A client component must not import server code. Move the logic to a server action (a \"use server\" file) or pass data in from a Server Component.",
  "client-env": "Only NEXT_PUBLIC_ variables exist in the browser. This one is undefined there.",
  "missing-server-only": "Start this file with import \"server-only\" so it can never be bundled for the browser.",
  "self-fetch": "A Server Component or action should call the service function directly, not fetch its own /api route (an extra network hop that loses the session).",
  "no-revalidate": "After a write, refresh the data: revalidatePath('/path'), revalidateTag('tag', 'max'), updateTag('tag') or redirect(). Otherwise the page shows old data.",
  "redirect-in-try": "redirect() and notFound() work by throwing. Inside try/catch call unstable_rethrow(err) first in the catch, or move the call outside the try. The wrappers already do this.",
  "export-in-use-server": "A \"use server\" file can only export async functions. Move constants, schemas and types to another file.",
  "mass-assignment":
    "Never write the raw request body to the database: a client can add fields like userId, role or status. Validate with a zod schema that lists the allowed fields and use the parsed value.",
  "limit-no-max": "A limit or page size from the client needs an upper bound: z.coerce.number().int().min(1).max(100).default(20).",
  "string-no-max": "Give every text field a maximum length: z.string().trim().min(1).max(200). Without it a client can store megabytes in one field.",
  "no-tests": "Add tests for the services: wrong owner (404), duplicate (409), invalid input, rollback, retry. See references/patterns.md (Testing).",
  "ignore-bad-rule": "A backend-check-ignore comment must name a rule id from this list, for example // backend-check-ignore unscoped-write: <reason>. A typo or a missing id ignores nothing.",
  "ignore-no-reason": "A backend-check-ignore comment needs a reason: // backend-check-ignore <rule-id>: <why this is safe>",
}

const KNOWN_RULES = new Set(Object.keys(FIX))

/* ------------------------------------------------------- source masking ---- */
/**
 * Returns the source with comments and the insides of strings replaced by spaces (same length, same lines),
 * so rules can match code without being fooled by text. `kind[i]` is 0 = code, 1 = comment, 2 = string text.
 */
function maskSource(src) {
  const n = src.length
  const out = Array.from(src)
  const kind = new Uint8Array(n)
  const templates = []
  const blank = (a, b, k) => {
    for (let i = a; i < b && i < n; i++) {
      kind[i] = k
      if (out[i] !== "\n") out[i] = " "
    }
  }
  const REGEX_KEYWORDS = new Set(["return", "typeof", "case", "in", "of", "delete", "void", "throw", "new", "else", "do"])

  function regexAllowed(k) {
    let j = k - 1
    while (j >= 0 && /\s/.test(out[j])) j--
    if (j < 0) return true
    const c = out[j]
    if ("(,=:[!&|?{;".includes(c)) return true
    if (/[A-Za-z_$]/.test(c)) {
      let s = j
      while (s >= 0 && /[\w$]/.test(out[s])) s--
      return REGEX_KEYWORDS.has(out.slice(s + 1, j + 1).join(""))
    }
    return false
  }

  function scanTemplate(start) {
    let k = start + 1
    let hasInterp = false
    while (k < n) {
      const c = src[k]
      if (c === "\\") {
        blank(k, k + 2, 2)
        k += 2
        continue
      }
      if (c === "`") {
        templates.push({ start, end: k, hasInterp })
        return k + 1
      }
      if (c === "$" && src[k + 1] === "{") {
        hasInterp = true
        k = scanCode(k + 2, true)
        continue
      }
      blank(k, k + 1, 2)
      k++
    }
    return k
  }

  function scanCode(start, untilBrace) {
    let k = start
    let depth = 0
    while (k < n) {
      const c = src[k]
      const d = src[k + 1]
      if (c === "/" && d === "/") {
        const e = src.indexOf("\n", k)
        const end = e === -1 ? n : e
        blank(k, end, 1)
        k = end
        continue
      }
      if (c === "/" && d === "*") {
        const e = src.indexOf("*/", k + 2)
        const end = e === -1 ? n : e + 2
        blank(k, end, 1)
        k = end
        continue
      }
      if (c === "'" || c === '"') {
        let e = k + 1
        while (e < n && src[e] !== c && src[e] !== "\n") {
          if (src[e] === "\\") e++
          e++
        }
        if (src[e] === c) {
          blank(k + 1, e, 2)
          k = e + 1
          continue
        }
        k++ // a stray apostrophe in JSX text
        continue
      }
      if (c === "`") {
        k = scanTemplate(k)
        continue
      }
      if (c === "/" && regexAllowed(k)) {
        let e = k + 1
        let inClass = false
        while (e < n && src[e] !== "\n") {
          if (src[e] === "\\") e++
          else if (src[e] === "[") inClass = true
          else if (src[e] === "]") inClass = false
          else if (src[e] === "/" && !inClass) break
          e++
        }
        if (src[e] === "/") {
          blank(k + 1, e, 2)
          k = e + 1
          continue
        }
      }
      if (c === "{") depth++
      else if (c === "}") {
        if (untilBrace && depth === 0) return k + 1
        depth--
      }
      k++
    }
    return k
  }

  scanCode(0, false)
  return { code: out.join(""), kind, templates }
}

function lineStartsOf(text) {
  const starts = [0]
  for (let i = 0; i < text.length; i++) if (text[i] === "\n") starts.push(i + 1)
  return starts
}
function lineIndexOf(starts, idx) {
  let lo = 0
  let hi = starts.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (starts[mid] <= idx) lo = mid
    else hi = mid - 1
  }
  return lo
}
function matchClose(code, openIdx, open = "{", close = "}") {
  let depth = 0
  for (let k = openIdx; k < code.length; k++) {
    const c = code[k]
    if (c === open) depth++
    else if (c === close) {
      depth--
      if (depth === 0) return k
    }
  }
  return -1
}
/** End index (exclusive) of a call chain such as db.update(t).set(x).where(y).returning() starting at `from`. */
function chainEnd(code, from) {
  let k = from
  for (;;) {
    let j = k
    while (j < code.length && /\s/.test(code[j])) j++
    if (code[j] === ".") {
      j++
      while (j < code.length && /\s/.test(code[j])) j++
      const m = /^[A-Za-z_$][\w$]*/.exec(code.slice(j, j + 80))
      if (!m) return k
      j += m[0].length
      let p = j
      while (p < code.length && /\s/.test(code[p])) p++
      if (code[p] === "(") {
        const close = matchClose(code, p, "(", ")")
        if (close < 0) return code.length
        k = close + 1
      } else {
        k = j
      }
      continue
    }
    if (code[j] === "(") {
      const close = matchClose(code, j, "(", ")")
      if (close < 0) return code.length
      k = close + 1
      continue
    }
    return k
  }
}
function callArgs(code, name, text) {
  // returns the text inside the first `name(...)` found in `text` (masked code), or null
  const i = text.indexOf(name + "(")
  if (i < 0) return null
  const open = i + name.length
  const close = matchClose(text, open, "(", ")")
  return close < 0 ? text.slice(open + 1) : text.slice(open + 1, close)
}

function findFunctions(code) {
  const fns = []
  for (const m of code.matchAll(/\bfunction\b\s*\*?\s*([A-Za-z_$][\w$]*)?\s*(?:<[^>(]*>)?\s*\(/g)) {
    const open = m.index + m[0].length - 1
    const close = matchClose(code, open, "(", ")")
    if (close < 0) continue
    const brace = code.indexOf("{", close + 1)
    if (brace < 0 || code.slice(close + 1, brace).includes(";")) continue
    const end = matchClose(code, brace)
    if (end < 0) continue
    fns.push({ start: m.index, bodyStart: brace, bodyEnd: end, name: m[1] ?? "", paramsStart: open, paramsEnd: close })
  }
  for (const m of code.matchAll(/=>\s*\{/g)) {
    const brace = m.index + m[0].length - 1
    const end = matchClose(code, brace)
    if (end < 0) continue
    fns.push({ start: m.index, bodyStart: brace, bodyEnd: end, name: "", paramsStart: -1, paramsEnd: -1 })
  }
  return fns
}

/* ------------------------------------------------------------- file walking */

const CODE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"])
const ROOT_DIRS = ["app", "src", "server", "lib", "pages", "components", "db", "prisma", "actions", "services", "utils", "helpers", "drizzle.config.ts"]
const ROOT_FILES = ["middleware.ts", "middleware.js", "proxy.ts", "proxy.js", "next.config.ts", "next.config.js", "next.config.mjs", "auth.ts", "auth.js"]
const SKIP_ANYWHERE = new Set(["node_modules", ".next", ".git", ".turbo", ".vercel", "coverage", "generated", ".pgdata", ".pgdata-run"])
const SKIP_TOP = new Set(["build", "dist", "out"])
const NOT_CODE_DIRS = new Set(["public", "docs", "doc", "drizzle", "migrations", "static", "assets", "styles", "types", "messages", "locales", "content", "emails", "storybook", "stories", "cypress", "scripts"])
const TEST_DIRS = new Set(["test", "tests", "__tests__", "e2e", "cypress", "playwright", "__mocks__"])
const includeTests = flags.has("--include-tests")

const isTestFile = (rel) => /\.(test|spec)\.[cm]?[tj]sx?$/.test(rel) || rel.split("/").some((p) => TEST_DIRS.has(p))

function* walk(dir, depth = 0) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    const full = join(dir, e.name)
    const rel = toPosix(relative(cwd, full))
    if (e.isDirectory()) {
      if (SKIP_ANYWHERE.has(e.name) || e.name.startsWith(".pgdata")) continue
      if (depth === 0 && SKIP_TOP.has(e.name)) continue
      if (rel === "components/ui" || rel === "src/components/ui") continue
      // a folder called "test" inside app/ or pages/ is a URL path (app/api/test/route.ts), not a test folder
      if (!includeTests && TEST_DIRS.has(e.name) && !/^(?:src\/)?(?:app|pages)\//.test(rel)) continue
      yield* walk(full, depth + 1)
    } else if (e.isFile()) {
      if (/\.d\.ts$/.test(e.name)) continue
      if (CODE_EXT.has(extname(e.name)) || e.name === "schema.prisma") {
        if (!includeTests && isTestFile(rel) && !/^(?:src\/)?(?:app|pages)\//.test(rel)) continue
        yield full
      }
    }
  }
}

function collectFiles() {
  const set = new Set()
  if (flags.has("--changed")) {
    let out = ""
    try {
      out =
        execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
    } catch {
      die("--changed needs a git repository.")
    }
    for (const line of out.split("\n")) {
      if (!line.trim()) continue
      let p = line.slice(3).trim()
      if (p.includes(" -> ")) p = p.split(" -> ")[1]
      p = p.replace(/^"|"$/g, "")
      const full = resolve(cwd, p)
      const rel = toPosix(relative(cwd, full))
      if (!existsSync(full) || !(CODE_EXT.has(extname(full)) || full.endsWith("schema.prisma"))) continue
      if (rel.startsWith("node_modules/") || rel.startsWith(".next/") || /\.d\.ts$/.test(rel)) continue
      if (rel.startsWith("components/ui/") || rel.startsWith("src/components/ui/")) continue
      if (!includeTests && isTestFile(rel)) continue
      set.add(full)
    }
    return set
  }
  if (targets.length) {
    for (const t of targets) {
      const full = resolve(cwd, t)
      if (!existsSync(full)) {
        die(`Path not found: ${t}`)
      }
      if (statSync(full).isDirectory()) for (const f of walk(full, 1)) set.add(f)
      else set.add(full)
    }
    return set
  }
  const roots = includeTests ? [...ROOT_DIRS, ...TEST_DIRS] : ROOT_DIRS
  // The usual folders, plus every other top-level folder that is not an asset or output folder
  // (features/, modules/, domain/, jobs/ ...). Code outside the usual folders must not go unchecked.
  const extra = []
  try {
    for (const e of readdirSync(cwd, { withFileTypes: true })) {
      if (e.isDirectory() && !e.name.startsWith(".") && !SKIP_ANYWHERE.has(e.name) && !SKIP_TOP.has(e.name) && !NOT_CODE_DIRS.has(e.name) && !TEST_DIRS.has(e.name) && !roots.includes(e.name)) extra.push(e.name)
    }
  } catch {}
  for (const d of [...roots, ...extra]) {
    const full = join(cwd, d)
    if (existsSync(full) && statSync(full).isDirectory()) for (const f of walk(full, 1)) set.add(f)
  }
  for (const f of ROOT_FILES) {
    const full = join(cwd, f)
    if (existsSync(full)) set.add(full)
  }
  return set
}

/* ------------------------------------------------------------ rule helpers */

const HTTP_METHODS = "GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS"
const ROUTE_WRAPPERS = ["userRoute", "adminRoute", "publicRoute", "webhookRoute", "cronRoute"]
const ACTION_WRAPPERS = ["userAction", "adminAction", "publicAction"]
const PUBLIC_WRAPPERS = ["publicRoute", "webhookRoute", "cronRoute", "publicAction"]
const DEFAULT_GUARDS = [
  "requireUser", "requireAdmin", "requirePageUser", "requireSession", "requireAuth", "requireRole", "requireOrg", "requireTenant",
  "getSessionUser", "getServerSession", "getSession", "getCurrentUser", "currentUser", "getUser", "getToken",
  "auth", "authenticate", "authorize", "protect", "withAuth", "isAuthenticated", "assertAuth", "assertUser", "ensureAuth", "checkAuth",
  "verifyJwt", "verifyToken", "jwtVerify", "validateRequest", "validateSession", "verifySession", "getAuth", "getIronSession",
  "userRoute", "adminRoute", "userAction", "adminAction", "protectedProcedure", "authActionClient", "authedAction",
  "CRON_SECRET", // a hand-written scheduler check: Authorization header compared with CRON_SECRET
  ...customGuards,
]
const GUARD_RE = new RegExp(`\\b(?:${DEFAULT_GUARDS.map((g) => g.replace(/[$]/g, "\\$")).join("|")})\\b`)
const OWNER_RE =
  /\b(?:userId|user_id|ownerId|owner_id|authorId|author_id|createdBy|created_by|organizationId|organization_id|orgId|org_id|workspaceId|tenantId|teamId|accountId|companyId|clerkId|authId|uid)\b|\buser\??\.id\b|\bsession\??\.user\b|\bctx\.user\b|\bcurrentUser\b/
const ID_RE = /\.\s*id\b|\bid\s*:|\bid\b\s*[,)}]|[A-Za-z]Id\b|_id\b/
const AUTH_TABLES = /^(?:users?|sessions?|accounts?|verifications?|verification_?tokens?|authenticators?|profiles?|passkeys?)$/i
const MONEY_NAME = /(?:price|amount|total|balance|cost|fee|salary|revenue|tax|discount|subtotal|payout|refund|charge)/i
const WRITE_CALL =
  /\b(?:db|tx|trx|prisma)\s*\.\s*(?:insert|update|delete)\s*\(|\b(?:db|tx|trx|prisma)\s*\.\s*[A-Za-z_$][\w$]*\s*\.\s*(?:create|createMany|createManyAndReturn|update|updateMany|updateManyAndReturn|upsert|delete|deleteMany)\s*\(/g
const DB_CALL = /\b(?:db|tx|trx|prisma|supabase)\s*\./

/* ------------------------------------------------- tables that have an owner */

const OWNER_COLUMNS = "userId|user_id|ownerId|owner_id|authorId|author_id|createdBy|created_by|organizationId|organization_id|orgId|org_id|workspaceId|tenantId|teamId|accountId|companyId|clerkId"
const ownerTables = new Set() // lower case: drizzle variable names and prisma model names

function collectOwnerTables(files) {
  for (const f of files) {
    let raw
    try {
      raw = readFileSync(f, "utf8")
    } catch {
      continue
    }
    if (f.endsWith("schema.prisma")) {
      for (const m of raw.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
        if (new RegExp(`^\\s*(?:${OWNER_COLUMNS})\\s+\\w+`, "m").test(m[2])) ownerTables.add(m[1].toLowerCase())
      }
      continue
    }
    if (!/\b(?:pgTable|mysqlTable|sqliteTable)\s*\(/.test(raw)) continue
    const { code } = maskSource(raw)
    for (const m of code.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(?:pg|mysql|sqlite)Table\s*\(/g)) {
      const open = code.indexOf("(", m.index + m[0].length - 1)
      const close = matchClose(code, open, "(", ")")
      if (close < 0) continue
      const args = code.slice(open + 1, close)
      const parts = splitTopLevel(args)
      if (!parts[1]) continue
      const cols = args.slice(parts[1][0], parts[1][1])
      if (new RegExp(`\\b(?:${OWNER_COLUMNS})\\s*:`).test(cols)) ownerTables.add(m[1].toLowerCase())
    }
  }
}

/* --------------------------------------------------------------- the scan */

function scanFile(file, issues, ignoresUsed) {
  const raw = readFileSync(file, "utf8")
  const rel = toPosix(relative(cwd, resolve(file)))
  const rawLines = raw.split("\n")
  const ignoreFileLine = rawLines.slice(0, 5).find((l) => l.includes("backend-check-ignore-file"))
  if (ignoreFileLine) {
    const reason = ignoreFileLine.split("backend-check-ignore-file")[1]?.replace(/^[\s:–-]+/, "").replace(/\*\/\s*$/, "").trim() ?? ""
    if (reason.length >= 3) {
      ignoresUsed.push({ file: rel, line: 1, rule: "all", reason })
      return
    }
    issues.push({ file: rel, line: 1, col: 1, level: "fail", id: "ignore-no-reason", text: "backend-check-ignore-file needs a reason" })
  }

  if (rel.endsWith("schema.prisma")) {
    scanPrismaSchema(raw, rel, rawLines, issues, ignoresUsed)
    return
  }

  const { code, kind, templates } = maskSource(raw)
  const starts = lineStartsOf(raw)
  const fns = findFunctions(code)
  const info = classify(rel, raw)
  const isClient = info.directive === "client"

  // ignore comments
  const ignoreAt = (lineIdx, id) => {
    const candidates = [lineIdx, lineIdx - 1]
    for (const li of candidates) {
      if (li < 0) continue
      const m = /backend-check-ignore(?!-file)(?:\s+([a-z][a-z0-9-]*(?:\s*,\s*[a-z][a-z0-9-]*)*))?\s*[:–-]?\s*(.*)$/i.exec(rawLines[li] ?? "")
      if (!m) continue
      const ids = m[1] ? m[1].split(",").map((r) => r.trim().toLowerCase()) : []
      // A missing or unknown rule id must not silence everything. It is a FAIL, and nothing is ignored.
      if (ids.length === 0 || !ids.every((r) => KNOWN_RULES.has(r))) return { bad: true, line: li + 1 }
      const reason = m[2].replace(/\*\/\s*}?\s*$/, "").trim()
      if (!ids.includes(id)) continue
      return { reason, line: li + 1 }
    }
    return null
  }

  const push = (idx, id, level, text, opts = {}) => {
    const lineIdx = lineIndexOf(starts, idx)
    const shown = (text ?? "").replace(/\s+/g, " ").trim().slice(0, 80)
    const checkLines = [lineIdx]
    if (opts.from !== undefined) checkLines.push(lineIndexOf(starts, opts.from))
    for (const f of fns) if (f.bodyStart <= idx && idx <= f.bodyEnd) checkLines.push(lineIndexOf(starts, f.start))
    for (const li of checkLines) {
      const hit = ignoreAt(li, id)
      if (hit?.bad) {
        if (!issues.some((i) => i.file === rel && i.line === hit.line && i.id === "ignore-bad-rule")) {
          issues.push({ file: rel, line: hit.line, col: 1, level: "fail", id: "ignore-bad-rule", text: "backend-check-ignore needs a known rule id" })
        }
        continue
      }
      if (hit) {
        if (hit.reason.length < 3) {
          issues.push({ file: rel, line: hit.line, col: 1, level: "fail", id: "ignore-no-reason", text: "backend-check-ignore without a reason" })
        } else {
          ignoresUsed.push({ file: rel, line: hit.line, rule: id, reason: hit.reason })
        }
        return
      }
    }
    if (issues.some((i) => i.file === rel && i.line === lineIdx + 1 && i.id === id)) return
    issues.push({ file: rel, line: lineIdx + 1, col: 1, level, id, text: shown })
  }

  const inCode = (idx) => kind[idx] === 0

  /* ---- 1. entry points: auth, validation, thin ---------------------------------- */
  scanEntryPoints({ rel, raw, code, info, push, fns, starts })

  /* ---- 2. database access --------------------------------------------------------- */
  if (!isClient) scanDatabase({ rel, raw, code, info, push, fns, inCode, templates })

  /* ---- 3. secrets and env ---------------------------------------------------------- */
  scanSecrets({ rel, raw, code, kind, info, push, isClient })

  /* ---- 4. crypto, errors and general security -------------------------------------- */
  if (!isClient) scanSecurity({ rel, raw, code, kind, info, push, fns, templates })
  scanClientSide({ rel, raw, code, kind, info, push })

  /* ---- 5. Next.js 15/16 traps ------------------------------------------------------- */
  scanNext({ rel, raw, code, info, push, fns })

  /* ---- 6. webhooks and abuse ---------------------------------------------------------- */
  scanWebhookAndAbuse({ rel, raw, code, info, push })
}

function classify(rel, raw) {
  const head = raw.replace(/^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*/, "")
  const dm = /^\s*["']use (client|server)["']/.exec(head)
  const isRoute = /(?:^|\/)app\/(?:.*\/)?route\.[cm]?[tj]sx?$/.test(rel) || /(?:^|\/)pages\/api\//.test(rel)
  return {
    directive: dm ? dm[1] : null,
    isRoute,
    isAuthLibRoute: isRoute && /\/api\/auth\/(?:.*\/)?\[\.\.\.[^\]]+\]\//.test(rel + "/"),
    isWebhook: isRoute && /webhook/i.test(rel),
    isServerDir: /(?:^|\/)server\//.test(rel),
    isEnvModule: /(?:^|\/)(?:server\/|lib\/)?env\.[cm]?[tj]s$/.test(rel) || /(?:^|\/)env\/index\.[tj]s$/.test(rel),
    isConfig: /(?:^|\/)[\w-]+\.config\.[cm]?[tj]s$/.test(rel) || /(?:^|\/)scripts\//.test(rel) || /(?:^|\/)seed\.[cm]?[tj]s$/.test(rel) || /\/prisma\/seed/.test(rel),
    isDbModule: /(?:^|\/)(?:db|database)\/index\.[cm]?[tj]s$/.test(rel) || /(?:^|\/)(?:lib|server|src)\/(?:db|prisma|database)\.[cm]?[tj]s$/.test(rel) || /(?:^|\/)(?:db|prisma|database)\.[cm]?[tj]s$/.test(rel),
    isSchemaFile: /(?:^|\/)schema(?:\.[\w-]+)?\.[cm]?[tj]s$/.test(rel) || /(?:^|\/)db\/schema\//.test(rel),
    isServerCode: false,
  }
}

/* --------------------------------------------------------- entry points ---- */

/** Does the text after `export const x =` start a function (or a call that returns one, such as a wrapper)? */
function isFunctionLike(initText) {
  const t = initText.trim()
  if (/^(?:z|zod|Object|Array|new|Symbol|JSON|Math|String|Number|Boolean|Date)\b/.test(t)) return false
  if (/^(?:["'`\[{\d-]|true\b|false\b|null\b|undefined\b)/.test(t)) return false
  return /^(?:async\b|function\b|\(|[A-Za-z_$][\w$.]*\s*(?:<[^>]*>)?\s*\()/.test(t)
}

function scanEntryPoints({ rel, raw, code, info, push, fns }) {
  const entries = []

  if (info.isRoute && !info.isAuthLibRoute) {
    for (const m of code.matchAll(new RegExp(`\\bexport\\s+(?:async\\s+)?function\\s+(${HTTP_METHODS})\\s*\\(`, "g"))) {
      const open = m.index + m[0].length - 1
      const close = matchClose(code, open, "(", ")")
      const brace = close < 0 ? -1 : code.indexOf("{", close)
      const end = brace < 0 ? -1 : matchClose(code, brace)
      if (end < 0) continue
      entries.push({ name: m[1], at: m.index, text: code.slice(open, end + 1), wrapper: null, kind: "route", hasParams: code.slice(open + 1, close).trim().length > 0 })
    }
    for (const m of code.matchAll(new RegExp(`\\bexport\\s+const\\s+(${HTTP_METHODS})\\s*(?::[^=]+)?=`, "g"))) {
      const after = m.index + m[0].length
      const next = code.slice(after).search(/\n\s*export\s/)
      const text = code.slice(after, next < 0 ? code.length : after + next)
      const w = new RegExp(`^\\s*(${[...ROUTE_WRAPPERS, ...customGuards].join("|")})\\b`).exec(text)
      entries.push({ name: m[1], at: m.index, text, wrapper: w ? w[1] : null, kind: "route", hasParams: true })
    }
    if (/(?:^|\/)pages\/api\//.test(rel)) {
      const m = /\bexport\s+default\s+(?:async\s+)?function\b[^(]*\(/.exec(code)
      if (m) {
        const open = m.index + m[0].length - 1
        const close = matchClose(code, open, "(", ")")
        const brace = close < 0 ? -1 : code.indexOf("{", close)
        const end = brace < 0 ? -1 : matchClose(code, brace)
        if (end > 0) entries.push({ name: "handler", at: m.index, text: code.slice(open, end + 1), wrapper: null, kind: "route", hasParams: true })
      }
    }
  }

  if (info.directive === "server") {
    for (const m of code.matchAll(/\bexport\s+async\s+function\s+([A-Za-z_$][\w$]*)\s*\(/g)) {
      const open = m.index + m[0].length - 1
      const close = matchClose(code, open, "(", ")")
      const brace = close < 0 ? -1 : code.indexOf("{", close)
      const end = brace < 0 ? -1 : matchClose(code, brace)
      if (end < 0) continue
      entries.push({ name: m[1], at: m.index, text: code.slice(open, end + 1), wrapper: null, kind: "action", hasParams: code.slice(open + 1, close).trim().length > 0 })
    }
    for (const m of code.matchAll(/\bexport\s+const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=/g)) {
      const after = m.index + m[0].length
      const next = code.slice(after).search(/\n\s*export\s/)
      const text = code.slice(after, next < 0 ? code.length : after + next)
      if (!isFunctionLike(text)) continue // constants and schemas are reported by export-in-use-server, they are not endpoints
      const w = new RegExp(`^\\s*(${[...ACTION_WRAPPERS, ...customGuards].join("|")})\\b`).exec(text)
      entries.push({ name: m[1], at: m.index, text, wrapper: w ? w[1] : null, kind: "action", hasParams: true })
    }
  } else if (info.directive !== "client") {
    // inline actions: async function save(formData) { "use server" ... }
    for (const m of raw.matchAll(/(?:async\s+function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)|(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*async\s*\(([^)]*)\)\s*=>)\s*\{\s*["']use server["']/g)) {
      const brace = raw.indexOf("{", m.index + m[0].length - 30)
      const open = code.indexOf("{", m.index)
      const end = open < 0 ? -1 : matchClose(code, open)
      if (end < 0) continue
      void brace
      entries.push({ name: m[1] ?? m[3], at: m.index, text: code.slice(open, end + 1), wrapper: null, kind: "action", hasParams: (m[2] ?? m[4] ?? "").trim().length > 0 })
    }
  }

  for (const e of entries) {
    const label = `${e.kind === "route" ? e.name : e.name + "()"}`
    const guarded = e.wrapper ? true : GUARD_RE.test(e.text) || (autoGuardRe !== null && autoGuardRe.test(e.text))
    const intentionallyPublic = e.wrapper && PUBLIC_WRAPPERS.includes(e.wrapper)
    if (!guarded && !intentionallyPublic && !info.isWebhook) {
      push(e.at, "entry-no-guard", "fail", `${label} does not check who is calling`)
    }
    // validation (only when we wrote it by hand)
    if (!e.wrapper) {
      const readsInput = /\bawait\s+(?:ctx\s*\.\s*)?params\b|\bparams\s*\.\s*[A-Za-z_$]|\b(?:request|req)\s*\.\s*(?:json|formData|text)\s*\(|\bsearchParams\s*\.\s*get\s*\(|\b(?:req|request)\s*\.\s*(?:query|body)\b|\bFormData\b|\bformData\s*\.\s*get\s*\(/.test(e.text)
      const validates = /\.(?:safeParse|parse|parseAsync|safeParseAsync)\s*\(|\bparseInput\s*\(|\bvalidate\w*\s*\(|\bz\./.test(e.text) || /\b(?:yup|valibot|superstruct|arktype|joi|ajv)\b/i.test(e.text)
      if ((readsInput || (e.kind === "action" && e.hasParams)) && !validates) {
        push(e.at, "entry-no-validation", "warn", `${label} uses input without a zod check`)
      }
      // the raw request body goes straight into the database
      const bodyVars = [
        ...[...e.text.matchAll(/\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*await\s+(?:request|req)\s*\.\s*json\s*\(\s*\)/g)].map((x) => x[1]),
        ...[...e.text.matchAll(/\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:req|request)\s*\.\s*body\b/g)].map((x) => x[1]),
      ]
      if (!validates) {
        for (const v of bodyVars) {
          if (new RegExp(`\\.(?:values|set)\\(\\s*\\[?\\s*${v}\\b|\\bdata\\s*:\\s*${v}\\b|\\.\\.\\.\\s*${v}\\b`).test(e.text)) {
            push(e.at, "mass-assignment", "fail", `${label}: the raw body \`${v}\` is written to the database`)
          }
        }
        if (/\.(?:values|set)\(\s*await\s+(?:request|req)\s*\.\s*json\s*\(/.test(e.text)) push(e.at, "mass-assignment", "fail", `${label}: the raw body is written to the database`)
      }
      // thin entry points
      if (/\b(?:db|prisma|tx)\s*\.\s*(?:select|insert|update|delete|query|execute|transaction|\$transaction|[A-Za-z_$][\w$]*\s*\.\s*(?:find\w*|create\w*|update\w*|delete\w*|upsert|count|aggregate|groupBy))\b/.test(e.text) && !info.isWebhook) {
        push(e.at, "fat-entry-point", "warn", `${label} talks to the database directly`)
      }
    }
  }

  // Wrapped handlers with inline database calls are also fat.
  for (const e of entries) {
    if (e.wrapper && /\b(?:db|prisma|tx)\s*\.\s*(?:select|insert|update|delete|query|execute|transaction|\$transaction|[A-Za-z_$][\w$]*\s*\.\s*(?:find\w*|create\w*|update\w*|delete\w*|upsert|count|aggregate|groupBy))\b/.test(e.text)) {
      push(e.at, "fat-entry-point", "warn", `${e.name} talks to the database directly`)
    }
  }

  // "use server" files may only export async functions
  if (info.directive === "server") {
    for (const m of code.matchAll(/\bexport\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*([^\n]*)/g)) {
      if (!isFunctionLike(m[2])) push(m.index, "export-in-use-server", "fail", `export ${m[1]} is not an async function`)
    }
    for (const m of code.matchAll(/\bexport\s+(?:function|class)\s+([A-Za-z_$][\w$]*)/g)) {
      if (/^export\s+async\b/.test(code.slice(m.index, m.index + 20))) continue
      if (/\bexport\s+function\b/.test(code.slice(m.index, m.index + 20))) push(m.index, "export-in-use-server", "fail", `export function ${m[1]} is not async`)
    }
    if (!/\b(?:revalidatePath|revalidateTag|updateTag|refresh|redirect)\s*\(/.test(code) && entries.some((e) => /^(?:create|update|delete|remove|add|save|submit|toggle|set|mark|invite|cancel|send|archive|publish)/i.test(e.name))) {
      push(0, "no-revalidate", "warn", "this actions file changes data but never refreshes it")
    }
  }
  void raw
}

/* ------------------------------------------------------------- database ---- */

function scanDatabase({ rel, raw, code, info, push, fns, inCode, templates }) {
  if (info.isConfig) return
  const isServiceish = !/\.tsx$/.test(rel) || info.isRoute

  // --- writes and reads by id without the owner
  const dbChains = []
  for (const m of code.matchAll(/\b(db|tx|trx|database)\s*\.\s*(update|delete)\s*\(\s*([A-Za-z_$][\w$.]*)\s*\)/g)) {
    const end = chainEnd(code, m.index + m[0].length)
    const chain = code.slice(m.index, end)
    dbChains.push({ idx: m.index, op: m[2], table: m[3].split(".").pop(), chain, type: "drizzle-write" })
  }
  for (const m of code.matchAll(/\b(db|tx|trx|database)\s*\.\s*select\s*\(/g)) {
    const open = m.index + m[0].length - 1
    const close = matchClose(code, open, "(", ")")
    if (close < 0) continue
    const end = chainEnd(code, close + 1)
    const chain = code.slice(m.index, end)
    const from = /\.\s*from\s*\(\s*([A-Za-z_$][\w$.]*)/.exec(chain)
    dbChains.push({ idx: m.index, op: "select", table: from ? from[1].split(".").pop() : "", chain, rawChain: raw.slice(m.index, end), type: "drizzle-read" })
  }
  for (const m of code.matchAll(/\b(db|tx|trx|prisma|client)\s*\.\s*([A-Za-z_$][\w$]*)\s*\.\s*(update|updateMany|delete|deleteMany|findUnique|findUniqueOrThrow|findFirst|findFirstOrThrow|findMany|upsert)\s*\(\s*\{/g)) {
    const open = m.index + m[0].length - 1
    const close = matchClose(code, open)
    if (close < 0) continue
    dbChains.push({ idx: m.index, op: m[3], table: m[2], chain: code.slice(m.index, close + 2), type: "prisma" })
  }
  for (const m of code.matchAll(/\b(db|tx|trx)\s*\.\s*query\s*\.\s*([A-Za-z_$][\w$]*)\s*\.\s*(findFirst|findMany)\s*\(\s*\{/g)) {
    const open = m.index + m[0].length - 1
    const close = matchClose(code, open)
    if (close < 0) continue
    dbChains.push({ idx: m.index, op: m[3], table: m[2], chain: code.slice(m.index, close + 2), type: "prisma" })
  }

  for (const c of dbChains) {
    const isWrite = c.type === "drizzle-write" || /^(?:update|updateMany|delete|deleteMany|upsert)$/.test(c.op)
    const isRead = !isWrite
    if (AUTH_TABLES.test(c.table)) continue
    let whereText = null
    if (c.type === "prisma") {
      const w = /\bwhere\s*:\s*\{/.exec(c.chain)
      if (w) {
        const open = c.chain.indexOf("{", w.index)
        const close = matchClose(c.chain, open)
        whereText = close < 0 ? c.chain.slice(open) : c.chain.slice(open, close + 1)
      } else if (/\bwhere\s*:/.test(c.chain) || /\bwhere\b\s*[,}]/.test(c.chain)) {
        whereText = null // where comes from a variable: unknown
        continue
      }
    } else {
      whereText = callArgs(code, ".where", c.chain)
      if (whereText === null) {
        const w2 = /\.where\s*\(/.exec(c.chain)
        if (w2) {
          const open = c.chain.indexOf("(", w2.index)
          const close = matchClose(c.chain, open, "(", ")")
          whereText = c.chain.slice(open + 1, close < 0 ? undefined : close)
        }
      }
    }

    const owned = ownerTables.has(c.table.toLowerCase())
    if (isWrite && whereText === null && !(c.type === "prisma" && c.op === "upsert")) {
      push(c.idx, "unscoped-write", "fail", `${c.op} on ${c.table} has no where (changes every row)`)
      continue
    }
    if (whereText === null) {
      if (isRead && owned && c.type !== "prisma-variable") push(c.idx, "unscoped-read", "warn", `${c.table} has an owner column, but this read is not filtered by it`)
      continue
    }
    // Drizzle: `.where(cond)` where cond is a variable, so the condition is built elsewhere and we cannot see it.
    // (A Prisma `{ id }` is a real filter, not a variable.)
    if (c.type !== "prisma" && /^\s*[A-Za-z_$][\w$]*\s*$/.test(whereText)) continue
    if (OWNER_RE.test(whereText)) continue
    const hasId = ID_RE.test(whereText)
    if (!hasId && !owned) continue
    if (isWrite) push(c.idx, "unscoped-write", "fail", hasId ? `${c.op} on ${c.table} filters by id but not by owner` : `${c.op} on ${c.table} is not limited to one owner`)
    else if (isRead && (c.op !== "findMany" || owned)) push(c.idx, "unscoped-read", "warn", hasId ? `read on ${c.table} by id without the owner` : `${c.table} has an owner column, but this read is not filtered by it`)
  }

  // --- unbounded lists
  for (const c of dbChains) {
    if (AUTH_TABLES.test(c.table)) continue
    if (c.type === "drizzle-read") {
      const text = c.rawChain ?? c.chain
      if (/\.\s*limit\s*\(/.test(c.chain)) continue
      if (/\b(?:count|sum|avg|min|max)\s*\(/i.test(text)) continue
      if (/\beq\s*\(\s*[\w$.]*\bid\b\s*,/.test(c.chain) || /\.\s*(?:for)\s*\(/.test(c.chain)) continue
      if (/\.\s*(?:groupBy)\s*\(/.test(c.chain)) continue
      push(c.idx, "unbounded-query", "warn", `select from ${c.table} without a limit`)
    } else if (c.type === "prisma" && c.op === "findMany") {
      if (/\btake\s*:/.test(c.chain)) continue
      push(c.idx, "unbounded-query", "warn", `findMany on ${c.table} without take`)
    }
  }

  // --- transactions: tx must be used inside; two writes need one
  for (const m of code.matchAll(/\.\s*\$?transaction\s*\(\s*(?:async\s*)?(?:function\s*)?\(?\s*([A-Za-z_$][\w$]*)\s*(?::[^)=]+)?\)?\s*(?:=>)?\s*\{/g)) {
    const open = code.indexOf("{", m.index + m[0].length - 1)
    const end = matchClose(code, open)
    if (end < 0) continue
    const body = code.slice(open, end + 1)
    const param = m[1]
    if (param !== "db" && param !== "prisma") {
      const bad = /\b(?:db|prisma)\s*\.\s*(?:select|insert|update|delete|execute|query|[A-Za-z_$][\w$]*\s*\.\s*(?:find\w*|create\w*|update\w*|delete\w*|upsert|count))/.exec(body)
      if (bad) push(open + bad.index, "tx-not-used", "fail", `${bad[0].slice(0, 40)} inside a transaction uses ${bad[0].startsWith("prisma") ? "prisma" : "db"}, not ${param}`)
    }
  }
  for (const f of fns) {
    // text of the function without nested functions
    let own = code.slice(f.bodyStart, f.bodyEnd + 1)
    for (const g of fns) {
      if (g === f) continue
      if (g.start > f.bodyStart && g.bodyEnd < f.bodyEnd) {
        const a = Math.max(g.bodyStart, f.bodyStart) - f.bodyStart
        const b = g.bodyEnd - f.bodyStart + 1
        own = own.slice(0, a) + " ".repeat(Math.max(0, b - a)) + own.slice(b)
      }
    }
    const writes = [...own.matchAll(WRITE_CALL)]
    if (writes.length < 2) continue
    if (/\.\s*\$?transaction\s*\(/.test(own)) continue
    const before = code.slice(Math.max(0, f.start - 90), f.start + 10)
    if (/\.\s*\$?transaction\s*\(\s*(?:async\s*)?\(?\s*$/.test(code.slice(Math.max(0, f.start - 90), f.start)) || /\.\s*\$?transaction\s*\(\s*(?:async\s*)?(?:function)?\s*\(?\s*[\w$]*\s*\)?\s*$/.test(before)) continue
    // the function that holds the writes is a transaction callback if the text right before it is `.transaction(`
    if (/\.\s*\$?transaction\s*\(\s*(?:async\s*)?\(?\s*[\w$]*\s*(?::[^)]*)?\)?\s*=?>?\s*$/.test(code.slice(Math.max(0, f.bodyStart - 120), f.bodyStart))) continue
    push(f.bodyStart + writes[0].index, "multi-write-no-transaction", "warn", `${writes.length} writes in ${f.name || "this function"} without a transaction`, { from: f.start })
  }

  // --- check, then insert (select by a unique-looking field, then insert, in the same function, without a transaction or conflict handling)
  for (const f of fns) {
    const body = code.slice(f.bodyStart, f.bodyEnd + 1)
    const sel = /\b(?:db|tx|prisma)\s*\.\s*(?:select\s*\(|query\s*\.\s*\w+\s*\.\s*find(?:First|Many)\s*\(|\w+\s*\.\s*find(?:First|Unique)\s*\()/.exec(body)
    const ins = /\b(?:db|tx|prisma)\s*\.\s*(?:insert\s*\(|\w+\s*\.\s*create\s*\()/.exec(body)
    if (!sel || !ins || sel.index > ins.index) continue
    if (/\bonConflict\w*|\bskipDuplicates\b|\bisUniqueViolation\b|\bP2002\b|\b23505\b|\.\s*\$?transaction\s*\(|\bupsert\b|\bFOR\s+UPDATE\b|\.\s*for\s*\(\s*["']update/i.test(raw.slice(f.bodyStart, f.bodyEnd + 1))) continue
    const between = body.slice(sel.index, ins.index)
    if (!/\b(?:if|throw|return)\b/.test(between)) continue
    if (!/\bemail\b|\bslug\b|\bname\b|\bnumber\b|\busername\b|\bcode\b|\bhandle\b|\bsku\b|\bkey\b/i.test(between)) continue
    push(f.bodyStart + ins.index, "check-then-insert", "warn", "look up, then insert: two requests at once can both pass", { from: f.start })
  }

  // --- N+1: await db call inside a loop
  const loops = []
  for (const m of code.matchAll(/\b(?:for\s*(?:await\s*)?\(|while\s*\()/g)) {
    const open = code.indexOf("(", m.index)
    const close = matchClose(code, open, "(", ")")
    if (close < 0) continue
    let j = close + 1
    while (/\s/.test(code[j] ?? "")) j++
    if (code[j] !== "{") continue
    const end = matchClose(code, j)
    if (end > 0) loops.push([j, end])
  }
  for (const m of code.matchAll(/\.\s*(?:map|forEach|flatMap)\s*\(\s*async\b/g)) {
    const f = fns.filter((g) => g.start >= m.index && g.start < m.index + 80).sort((a, b) => a.start - b.start)[0]
    if (f) loops.push([f.bodyStart, f.bodyEnd])
  }
  for (const [a, b] of loops) {
    const body = code.slice(a, b + 1)
    const hit = /\bawait\b[^;{}]*?\b(?:db|prisma|tx|trx|supabase)\s*\./.exec(body)
    if (hit && !/seed/i.test(rel)) push(a + hit.index, "n-plus-one", "warn", "a database query inside a loop")
  }

  // --- raw SQL built from strings
  for (const m of code.matchAll(/(?:\.\s*(?:query|execute|unsafe|raw)\s*\(|\$(?:query|execute)RawUnsafe\s*\(|\bsql\s*\.\s*raw\s*\()\s*(`|["']|[A-Za-z_$])/g)) {
    const argStart = m.index + m[0].length - 1
    const name = m[0]
    const unsafeFn = /RawUnsafe/.test(name)
    let bad = false
    if (m[1] === "`") {
      const t = templates.find((x) => x.start === argStart)
      const tagged = /[A-Za-z_$\])]\s*$/.test(code.slice(Math.max(0, argStart - 6), argStart).replace(/\(\s*$/, "")) && false
      bad = !!t && t.hasInterp && !tagged
    } else if (m[1] === '"' || m[1] === "'") {
      const afterStr = code.indexOf(m[1], argStart + 1)
      bad = /^\s*\+/.test(code.slice(afterStr + 1, afterStr + 12))
    }
    if (bad) push(m.index, "sql-injection", "fail", `${name.replace(/\s+/g, "").slice(0, 32)} with a built string`)
    else if (unsafeFn) push(m.index, "raw-sql-unsafe", "warn", `${name.replace(/\s+/g, "").slice(0, 32)}`)
  }
  for (const m of code.matchAll(/\bsql\s*\.\s*raw\s*\(\s*`/g)) {
    const t = templates.find((x) => x.start === m.index + m[0].length - 1)
    if (t?.hasInterp) push(m.index, "sql-injection", "fail", "sql.raw with ${} inside")
  }

  // --- a second database client
  if (!info.isDbModule && !info.isConfig) {
    for (const m of code.matchAll(/\bnew\s+(?:PrismaClient|Pool|Client)\s*\(/g)) {
      if (!/\b(?:PrismaClient|pg|postgres|mysql2)\b/.test(raw)) continue
      const indented = /^[ \t]+\S/.test(raw.slice(raw.lastIndexOf("\n", m.index) + 1, m.index + 1))
      if (indented || info.isRoute || /(?:^|\/)app\//.test(rel)) push(m.index, "db-client-in-handler", "warn", m[0].replace(/\s+/g, ""))
      else push(m.index, "db-client-in-handler", "warn", `${m[0].replace(/\s+/g, "")} outside the db module`)
    }
  }

  // --- schema checks (drizzle)
  if (info.isSchemaFile || /\b(?:pgTable|mysqlTable|sqliteTable)\s*\(/.test(code)) scanDrizzleSchema({ raw, code, push })

  // --- zod: lists need a max, strings need a max
  for (const m of code.matchAll(/\b(limit|pageSize|perPage|take|size)\s*:\s*z\s*\.\s*(?:coerce\s*\.\s*)?(?:number|int)\s*\(\s*\)/g)) {
    const end = chainEnd(code, m.index + m[0].length)
    if (!/\.\s*(?:max|lte)\s*\(/.test(code.slice(m.index, end))) push(m.index, "limit-no-max", "warn", `${m[1]} has no .max()`)
  }
  if (/\bz\s*\.\s*object\s*\(/.test(code) && !info.isEnvModule) {
    for (const m of code.matchAll(/\b([A-Za-z_$][\w$]*)\s*:\s*z\s*\.\s*string\s*\(\s*\)/g)) {
      const end = chainEnd(code, m.index + m[0].length)
      const chain = code.slice(m.index, end)
      if (/\.\s*(?:max|length|regex|email|url|uuid|guid|datetime|date|time|cuid2?|ulid|nanoid|ip|ipv4|ipv6|startsWith|endsWith|includes)\s*\(/.test(chain)) continue
      push(m.index, "string-no-max", "warn", `${m[1]}: z.string() has no .max()`)
    }
  }

  // --- zod money
  for (const m of code.matchAll(/\b([A-Za-z_$][\w$]*)\s*:\s*z\s*\.\s*(?:coerce\s*\.\s*)?number\s*\(\s*\)([^,\n}]*)/g)) {
    if (MONEY_NAME.test(m[1]) && !/(?:Cents|Minor|Pence)$/.test(m[1]) && !/\.\s*int\s*\(/.test(m[2])) push(m.index, "money-float", "warn", `${m[1]}: z.number() for money`)
  }
  void isServiceish
}

function splitTopLevel(text, sep = ",") {
  const parts = []
  let depth = 0
  let last = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if ("([{".includes(c)) depth++
    else if (")]}".includes(c)) depth--
    else if (c === sep && depth === 0) {
      parts.push([last, i])
      last = i + 1
    }
  }
  parts.push([last, text.length])
  return parts
}

function scanDrizzleSchema({ raw, code, push }) {
  for (const m of code.matchAll(/\b(?:pgTable|mysqlTable|sqliteTable)\s*\(/g)) {
    const open = m.index + m[0].length - 1
    const close = matchClose(code, open, "(", ")")
    if (close < 0) continue
    const args = code.slice(open + 1, close)
    const parts = splitTopLevel(args)
    if (parts.length < 2) continue
    const colsText = args.slice(parts[1][0], parts[1][1])
    const extra = parts[2] ? args.slice(parts[2][0], parts[2][1]) : ""
    const braceOpen = colsText.indexOf("{")
    const braceClose = matchClose(colsText, braceOpen)
    if (braceOpen < 0 || braceClose < 0) continue
    const inner = colsText.slice(braceOpen + 1, braceClose)
    const base = open + 1 + parts[1][0] + braceOpen + 1
    for (const [a, b] of splitTopLevel(inner)) {
      const col = inner.slice(a, b)
      const km = /^\s*([A-Za-z_$][\w$]*)\s*:/.exec(col)
      if (!km) continue
      const key = km[1]
      const abs = base + a
      const rawCol = raw.slice(abs, base + b)
      // money columns
      const type = /:\s*([A-Za-z]+)\s*\(/.exec(col)?.[1] ?? ""
      if (MONEY_NAME.test(key) && !/(?:Cents|Minor|Pence)$/.test(key)) {
        if (/^(?:real|doublePrecision|float|double)$/.test(type)) push(abs, "money-float", "fail", `${key}: ${type}() stores money as a float`)
        else if (/^(?:numeric|decimal)$/.test(type)) push(abs, "money-float", "warn", `${key}: ${type}() comes back as a string. Prefer integer cents`)
      }
      // foreign keys without an index
      if (/\.\s*references\s*\(/.test(col)) {
        const indexed = new RegExp(`\\.\\s*(?:on|using)\\s*\\([^)]*\\b[A-Za-z_$]*\\.${key}\\b`).test(extra) || /\.\s*(?:unique|primaryKey)\s*\(/.test(col) || new RegExp(`\\bprimaryKey\\s*\\([^)]*\\b${key}\\b`).test(extra)
        if (!indexed) push(abs, "fk-no-index", "warn", `${key} references another table but has no index`)
      }
      void rawCol
    }
  }
}

function scanPrismaSchema(raw, rel, rawLines, issues, ignoresUsed) {
  const models = [...raw.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)]
  const push = (lineNo, id, level, text) => {
    for (const li of [lineNo - 1, lineNo - 2]) {
      const m = /backend-check-ignore(?:\s+([a-z][a-z0-9,-]*))?\s*[:–-]?\s*(.*)$/i.exec(rawLines[li] ?? "")
      if (m && m[1] && m[1].split(",").map((r) => r.trim().toLowerCase()).includes(id)) {
        ignoresUsed.push({ file: rel, line: li + 1, rule: id, reason: (m[2] || m[1] || "").trim() })
        return
      }
    }
    issues.push({ file: rel, line: lineNo, col: 1, level, id, text: text.slice(0, 80) })
  }
  for (const m of models) {
    const bodyStart = raw.slice(0, m.index).split("\n").length
    const lines = m[2].split("\n")
    lines.forEach((line, i) => {
      const lineNo = bodyStart + i + 1
      const fm = /^\s*(\w+)\s+(Float|Decimal)\b/.exec(line)
      if (fm && MONEY_NAME.test(fm[1]) && !/(?:Cents|Minor|Pence)$/.test(fm[1])) {
        push(lineNo, "money-float", fm[2] === "Float" ? "fail" : "warn", `${fm[1]} ${fm[2]}: use Int cents`)
      }
      const rm = /@relation\s*\(\s*fields\s*:\s*\[([^\]]+)\]/.exec(line)
      if (rm) {
        const cols = rm[1].split(",").map((s) => s.trim())
        const lead = cols[0]
        const indexed = new RegExp(`@@(?:index|unique|id)\\s*\\(\\s*\\[\\s*${lead}\\b`).test(m[2]) || new RegExp(`^\\s*${lead}\\s+[^\\n]*@(?:unique|id)\\b`, "m").test(m[2])
        if (!indexed) push(lineNo, "fk-no-index", "warn", `${lead} is a foreign key without @@index([${lead}])`)
      }
    })
  }
}

/* -------------------------------------------------------------- secrets ---- */

function scanSecrets({ rel, raw, code, kind, info, push, isClient }) {
  // NEXT_PUBLIC_ names
  for (const m of raw.matchAll(/NEXT_PUBLIC_([A-Z0-9_]+)/g)) {
    if (kind[m.index] === 1) continue
    const name = m[1]
    if (/SECRET|PRIVATE|PASSWORD|PASSWD|SERVICE_ROLE|DATABASE|DB_URL|WEBHOOK|SIGNING|JWT|ENCRYPT|CLIENT_SECRET|ADMIN|SUPABASE_SERVICE/.test(name)) {
      push(m.index, "public-secret", "fail", `NEXT_PUBLIC_${name} is sent to every browser`)
    } else if (/KEY|TOKEN|AUTH/.test(name) && !/PUBLISHABLE|ANON|SITE_KEY|PUBLIC_KEY|CLIENT_ID|APP_ID|MEASUREMENT|SENTRY|POSTHOG|MAPBOX|MAPS|ALGOLIA|TURNSTILE|RECAPTCHA|VAPID/.test(name)) {
      push(m.index, "public-key-check", "warn", `NEXT_PUBLIC_${name}: is this key meant to be public?`)
    }
  }

  // hard-coded secrets (also inside strings)
  const patterns = [
    [/\b(?:sk|rk)_(?:live|test)_[0-9a-zA-Z]{16,}/g, "a Stripe secret key"],
    [/\bwhsec_[0-9a-zA-Z]{16,}/g, "a webhook signing secret"],
    [/\bAKIA[0-9A-Z]{16}\b/g, "an AWS access key"],
    [/\bgh[pousr]_[A-Za-z0-9]{30,}/g, "a GitHub token"],
    [/\bgithub_pat_[A-Za-z0-9_]{30,}/g, "a GitHub token"],
    [/\bxox[baprs]-[0-9A-Za-z-]{10,}/g, "a Slack token"],
    [/-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g, "a private key"],
    [/\bsk-[A-Za-z0-9_-]{32,}/g, "an API key (sk-...)"],
  ]
  for (const [re, label] of patterns) {
    for (const m of raw.matchAll(re)) {
      if (kind[m.index] === 1) continue
      push(m.index, "hardcoded-secret", "fail", `${label} is written in the code`)
    }
  }
  for (const m of raw.matchAll(/\bpostgres(?:ql)?:\/\/([^:\s"'`/]+):([^@\s"'`]{3,})@/g)) {
    if (kind[m.index] === 1) continue
    if (/^(?:password|pass|postgres|user|xxx+|\*+|<[^>]*>|\$\{.*|\[.*\]|secret|changeme|example)$/i.test(m[2])) continue
    push(m.index, "hardcoded-secret", "fail", "a database URL with a password is written in the code")
  }
  for (const m of raw.matchAll(/\beyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/g)) {
    if (kind[m.index] === 1) continue
    push(m.index, "hardcoded-secret", "fail", "a JWT (for example a Supabase key) is written in the code")
  }
  for (const m of raw.matchAll(/\b(?:secret|password|passwd|api[_-]?key|apikey|private[_-]?key|client[_-]?secret|auth[_-]?token|access[_-]?token)\w*\s*[:=]\s*(["'`])([^"'`\s${}]{16,})\1/gi)) {
    if (kind[m.index] === 1) continue
    const v = m[2]
    if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) continue
    if (/^(?:[a-z]+[-_.][a-z-_.]+)$/i.test(v) && !/\d/.test(v)) continue
    push(m.index, "hardcoded-secret", "fail", "a value that looks like a secret is written in the code")
  }

  // process.env outside server/env.ts
  if (!info.isEnvModule && !info.isConfig && !isClient) {
    for (const m of code.matchAll(/\bprocess\s*\.\s*env\s*(?:\.\s*([A-Z0-9_]+)|\[)/g)) {
      const name = m[1] ?? ""
      if (/^(?:NODE_ENV|NEXT_RUNTIME|CI|PORT|VERCEL\w*|NEXT_PHASE|NEXT_PUBLIC_\w+)$/.test(name)) continue
      if (rel.endsWith("instrumentation.ts")) continue
      push(m.index, "env-direct", "warn", `process.env.${name || "[...]"} outside server/env.ts`)
    }
  }
  void code
}

/* -------------------------------------------------------------- security ---- */

function scanSecurity({ rel, raw, code, kind, info, push, fns, templates }) {
  void templates
  // weak password hashing
  for (const m of raw.matchAll(/createHash\(\s*["'](md5|sha1|sha-1|sha256|sha-256)["']\s*\)/gi)) {
    if (kind[m.index] === 1) continue
    const around = raw.slice(Math.max(0, m.index - 200), m.index + 260)
    const algo = m[1].toLowerCase()
    if (/pass(?:word|wd)|pwd/i.test(around)) push(m.index, "weak-hash", "fail", `password hashed with ${algo}`)
    else if (/md5|sha-?1$/.test(algo) && /token|secret|session|key/i.test(around)) push(m.index, "weak-hash", "warn", `${algo} is not safe for secrets`)
  }
  // predictable tokens
  for (const m of code.matchAll(/Math\s*\.\s*random\s*\(\s*\)/g)) {
    const line = raw.slice(raw.lastIndexOf("\n", m.index) + 1, raw.indexOf("\n", m.index) === -1 ? raw.length : raw.indexOf("\n", m.index))
    if (/token|secret|password|session|otp|nonce|apikey|api_key|salt|reset|verif|invite|csrf|code/i.test(line)) push(m.index, "math-random-secret", "fail", "Math.random() used for a token or code")
  }
  // cookies without httpOnly
  for (const m of raw.matchAll(/(?:cookie\w*|cookies\(\)\)?|cookies)\s*\.\s*set\s*\(/gi)) {
    if (kind[m.index] === 1) continue
    const open = raw.indexOf("(", m.index + m[0].length - 1)
    const close = matchClose(code, open, "(", ")")
    if (close < 0) continue
    const args = raw.slice(open, close + 1)
    const nm = /^\(\s*["'`]([^"'`]+)["'`]/.exec(args) ?? /name\s*:\s*["'`]([^"'`]+)["'`]/.exec(args)
    if (nm && /session|token|auth|jwt|sid|refresh|access/i.test(nm[1]) && !/httpOnly\s*:\s*true/.test(args)) push(m.index, "cookie-no-httponly", "fail", `cookie "${nm[1]}" without httpOnly`)
  }
  // eval, new Function, shell
  for (const m of code.matchAll(/\beval\s*\(|\bnew\s+Function\s*\(/g)) push(m.index, "eval-use", "fail", m[0])
  for (const m of code.matchAll(/\b(?:exec|execSync)\s*\(\s*(`|[A-Za-z_$])/g)) {
    if (!/child_process|execa|exec/.test(raw)) continue
    const argStart = m.index + m[0].length - 1
    if (m[1] === "`") {
      const t = templates.find((x) => x.start === argStart)
      if (t?.hasInterp) push(m.index, "exec-injection", "fail", "a shell command built with ${}")
    } else if (/\bchild_process\b/.test(raw)) {
      push(m.index, "exec-injection", "warn", "a shell command from a variable")
    }
  }
  // error details sent to the client
  for (const m of code.matchAll(/\bcatch\s*(?:\(\s*([A-Za-z_$][\w$]*)\s*(?::[^)]*)?\))?\s*\{/g)) {
    const open = code.indexOf("{", m.index + m[0].length - 1)
    const end = matchClose(code, open)
    if (end < 0) continue
    const body = code.slice(open + 1, end)
    if (!body.trim()) {
      push(m.index, "empty-catch", "warn", "catch block is empty")
      continue
    }
    const v = m[1]
    if (!v) continue
    const bodyRaw = raw.slice(open + 1, end)
    const stmts = body.split(/;|\n/)
    let offset = 0
    for (const s of stmts) {
      const here = open + 1 + offset
      offset += s.length + 1
      if (!new RegExp(`\\b${v}\\s*\\??\\.\\s*(?:message|stack|cause)\\b|String\\(\\s*${v}\\s*\\)|JSON\\.stringify\\(\\s*${v}\\b|\\{\\s*${v}\\s*\\}`).test(s)) continue
      if (/\bconsole\s*\.|\blogError\b|\blogger\b|\blog\s*\.|Sentry|captureException/.test(s)) continue
      if (/\bjson\s*\(|\bResponse\b|\.send\s*\(|\.end\s*\(|\breturn\s*\{|\bNextResponse\b|\berror\s*:|\bmessage\s*:|\bstatus\s*\(/.test(s)) {
        if (/\bAppError\b|instanceof\s+AppError/.test(s)) continue
        push(here + s.search(/\S/), "error-leak", "fail", s.trim())
      }
    }
    void bodyRaw
  }
  // logging secrets
  for (const m of code.matchAll(/\bconsole\s*\.\s*(?:log|info|debug|warn|error)\s*\(/g)) {
    const open = m.index + m[0].length - 1
    const close = matchClose(code, open, "(", ")")
    if (close < 0) continue
    const args = code.slice(open, close + 1)
    if (/\b(?:password|passwd|secret|token|apiKey|api_key|authorization|cookie|cookies|bearer|credentials|privateKey)\b/i.test(args)) push(m.index, "console-secret", "fail", "console output mentions a secret")
  }
  // `any` and ts-ignore
  if (info.isServerDir || info.isRoute || info.directive === "server") {
    for (const m of code.matchAll(/:\s*any\b|\bas\s+any\b|<any>|\bany\[\]/g)) push(m.index, "any-in-server", "warn", m[0])
  }
  for (const m of raw.matchAll(/@ts-(?:ignore|nocheck|expect-error)\b([^\n]*)/g)) {
    if (kind[m.index] !== 1) continue
    if (m[0].startsWith("@ts-expect-error") && m[1].trim().length > 8) continue
    push(m.index, "ts-suppress", "warn", m[0])
  }
  // jwt
  for (const m of code.matchAll(/\bjwt\s*\.\s*decode\s*\(|\bjwtDecode\s*\(|\bdecodeJwt\s*\(/g)) push(m.index, "jwt-decode", "fail", m[0])
  // hand rolled auth
  if (info.isRoute && /(?:login|signin|sign-in|signup|sign-up|register)/i.test(rel) && !info.isAuthLibRoute) {
    const m = /\b(?:bcrypt\w*|argon2|jsonwebtoken|jwt\s*\.\s*sign|SignJWT|pbkdf2|scryptSync)\b/.exec(code)
    if (m) push(m.index, "hand-rolled-auth", "warn", m[0])
  }
  // CORS
  for (const m of raw.matchAll(/Access-Control-Allow-Origin["'`]?\s*[:,]\s*(?:["'`]\*["'`]|[^\n]*)/gi)) {
    if (kind[m.index] === 1) continue
    const line = m[0]
    if (/\*/.test(line) && /Allow-Credentials/i.test(raw)) push(m.index, "cors-wildcard", "fail", "Allow-Origin * with credentials")
    if (/headers\s*\.\s*get\s*\(\s*["']origin["']/i.test(line)) push(m.index, "cors-reflect", "fail", "Allow-Origin copies the request Origin")
  }
  // server files should be marked server-only
  if (info.isServerDir && info.directive === null && !/\.(?:test|spec)\./.test(rel) && !info.isConfig) {
    const touches = /@\/server\/(?:db|env|auth)\b|\bdrizzle-orm\b|@prisma\/client|@\/generated\/prisma|process\.env|\bnode:(?:fs|crypto|child_process)\b/.test(raw)
    if (touches && !/import\s+["']server-only["']/.test(raw) && !info.isEnvModule && !info.isSchemaFile) push(0, "missing-server-only", "warn", "server file without import \"server-only\"")
  }
  void fns
}

/* ------------------------------------------------------------ client side --- */

function scanClientSide({ rel, raw, code, kind, info, push }) {
  if (info.directive === "client") {
    for (const m of raw.matchAll(/^\s*(?:import|export)\s+(?:type\s+)?(?:[^;'"]*?\bfrom\s*)?["']([^"']+)["']/gm)) {
      if (kind[m.index + m[0].indexOf("import")] === 1) continue
      if (/^\s*import\s+type\b/.test(m[0]) || /^\s*export\s+type\b/.test(m[0])) continue
      const spec = m[1]
      const serverish =
        spec === "server-only" ||
        /^@\/server\/(?:db|auth|env|api|action|errors|log|rate-limit|webhook|validate)(?:\/|$)/.test(spec) ||
        /^@\/server\/.*\/service$/.test(spec) ||
        /^@\/(?:db|lib\/db|lib\/prisma|prisma)(?:\/|$)/.test(spec) ||
        /^@\/generated\/prisma/.test(spec) ||
        /^(?:drizzle-orm(?:\/.*)?|@prisma\/client|@prisma\/adapter-[\w-]+|pg|postgres|mysql2|better-sqlite3|bcrypt|bcryptjs|argon2|jsonwebtoken|nodemailer|stripe|fs|fs\/promises|child_process|node:[\w/]+)$/.test(spec)
      if (serverish) push(m.index + m[0].indexOf(spec), "client-imports-server", "fail", `client component imports ${spec}`)
    }
    for (const m of code.matchAll(/\bprocess\s*\.\s*env\s*\.\s*([A-Z0-9_]+)/g)) {
      if (/^(?:NODE_ENV|NEXT_PUBLIC_\w+)$/.test(m[1])) continue
      push(m.index, "client-env", "warn", `process.env.${m[1]} in a client component`)
    }
    for (const m of raw.matchAll(/localStorage\s*\.\s*setItem\s*\(\s*["'`]([^"'`]*(?:token|jwt|session|auth)[^"'`]*)["'`]/gi)) push(m.index, "token-in-storage", "warn", `localStorage "${m[1]}"`)
    for (const m of raw.matchAll(/document\s*\.\s*cookie\s*=\s*[`"']?[^;\n]*?(?:token|jwt|session|auth)/gi)) push(m.index, "cookie-no-httponly", "fail", "a token cookie written from the browser cannot be httpOnly")
  } else if (info.directive === null && /(?:^|\/)app\//.test(rel) && !info.isRoute && !/\/(?:loading|error|not-found|global-error)\.[tj]sx?$/.test(rel)) {
    // Server Components: do not fetch your own API
    for (const m of code.matchAll(/\bfetch\s*\(\s*(`|["'])/g)) {
      const start = m.index + m[0].length - 1
      const seg = raw.slice(start, start + 120)
      if (/^[`"'](?:\/api\/|https?:\/\/(?:localhost|127\.0\.0\.1)[^"'`]*\/api\/|\$\{[^}]*(?:BASE|URL|HOST|ORIGIN)[^}]*\}\/api\/)/i.test(seg)) push(m.index, "self-fetch", "warn", "fetch of this app's own /api route on the server")
    }
  }
}

/* ------------------------------------------------------------- next traps --- */

function scanNext({ rel, raw, code, info, push, fns }) {
  if (nextMajor >= 15) {
    const fromNextHeaders = new Set()
    for (const im of raw.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']next\/headers["']/g)) {
      for (const part of im[1].split(",")) {
        const [orig, alias] = part.trim().split(/\s+as\s+/)
        if (orig) fromNextHeaders.add((alias ?? orig).trim())
      }
    }
    for (const m of code.matchAll(/\b(cookies|headers|draftMode)\s*\(\s*\)/g)) {
      if (!fromNextHeaders.has(m[1])) continue // a function with the same name that is not Next.js
      const before = code.slice(Math.max(0, m.index - 30), m.index)
      if (/await\s*\(?\s*$/.test(before) || /\.\s*$/.test(before) || /function\s+$/.test(before) || /\bimport\b/.test(before)) continue
      if (/(?:^|[^\w$.])(?:cookies|headers|draftMode)\s*\(\s*\)\s*(?:\.|;|$|\))/.test(code.slice(m.index, m.index + 40)) || /=\s*$/.test(before)) {
        if (/^\s*[,)]\s*$/.test(code.slice(m.index + m[0].length, m.index + m[0].length + 3))) continue
        push(m.index, "sync-dynamic-api", "fail", `${m[1]}() without await`)
      }
    }
    for (const m of code.matchAll(/\b(params|searchParams)\s*:\s*\{/g)) {
      const before = code.slice(Math.max(0, m.index - 80), m.index)
      if (/\bPromise\s*<\s*$/.test(before)) continue
      // only function parameter types: the "{" belongs to a type annotation inside "( ... )" or "({ ... }: { ... })"
      const line = raw.slice(raw.lastIndexOf("\n", m.index) + 1, raw.indexOf("\n", m.index) === -1 ? raw.length : raw.indexOf("\n", m.index))
      if (/\binterface\b|\btype\s+\w+\s*=/.test(line) && !/params|searchParams/.test(line.split(":")[0] ?? "")) continue
      if (info.isRoute || /(?:^|\/)(?:page|layout|template|default|opengraph-image|icon|apple-icon|sitemap)\.[tj]sx?$/.test(rel) || /generateMetadata|generateStaticParams/.test(line) || /\}\s*:\s*\{\s*(?:params|searchParams)/.test(raw.slice(Math.max(0, m.index - 20), m.index + 40))) {
        push(m.index, "sync-params", "fail", `${m[1]} typed as a plain object`)
      }
    }
    for (const m of code.matchAll(/\brevalidateTag\s*\(\s*[^,()]+\)/g)) {
      if (nextMajor >= 16) push(m.index, "revalidate-tag-args", "fail", m[0].replace(/\s+/g, " "))
    }
  }
  if (nextMajor >= 16 && /(?:^|\/)middleware\.[cm]?[tj]s$/.test(rel) && !/runtime\s*[:=]\s*["']edge["']/.test(raw)) push(0, "middleware-renamed", "warn", "middleware.ts is proxy.ts in Next.js 16")

  // redirect()/notFound() swallowed by try/catch
  for (const m of code.matchAll(/\btry\s*\{/g)) {
    const open = code.indexOf("{", m.index)
    const end = matchClose(code, open)
    if (end < 0) continue
    const body = code.slice(open, end + 1)
    if (!/\b(?:redirect|permanentRedirect|notFound|forbidden|unauthorized)\s*\(/.test(body)) continue
    const after = code.slice(end + 1, end + 400)
    const cm = /^\s*catch\s*(?:\([^)]*\))?\s*\{/.exec(after)
    if (!cm) continue
    const cOpen = end + 1 + after.indexOf("{", cm[0].indexOf("catch"))
    const cEnd = matchClose(code, cOpen)
    const catchBody = cEnd < 0 ? after : code.slice(cOpen, cEnd + 1)
    if (/\bunstable_rethrow\b|\bisRedirectError\b|\bisNotFoundError\b|\bthrow\b/.test(catchBody)) continue
    const hit = /\b(?:redirect|permanentRedirect|notFound|forbidden|unauthorized)\s*\(/.exec(body)
    push(open + hit.index, "redirect-in-try", "fail", `${hit[0].replace(/\s*\($/, "")}() inside try/catch`)
  }
  void fns
}

/* ------------------------------------------------- webhooks and abuse ---- */

/**
 * The code of the project files that a file imports (one level: "@/..." and relative paths). A webhook route
 * is often thin and the signature check or the "once only" logic lives in a helper next to it.
 */
function localImportsText(raw, rel) {
  const roots = ["", "src/"]
  const exts = ["", ".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.js"]
  const out = []
  const seen = new Set()
  for (const m of raw.matchAll(/\bfrom\s+["'](@\/[^"']+|\.{1,2}\/[^"']+)["']/g)) {
    const spec = m[1]
    const bases = spec.startsWith("@/") ? roots.map((r) => join(cwd, r, spec.slice(2))) : [resolve(cwd, rel, "..", spec)]
    for (const b of bases) {
      const hit = exts.map((e) => b + e).find((f) => existsSync(f) && statSync(f).isFile())
      // The shared helpers file defines webhookRoute and verifySignature: importing it must not count as a check.
      if (hit && !/(?:^|\/)(?:server\/)?(?:api|action)\.[cm]?[tj]s$/.test(hit) && !seen.has(hit) && seen.size < 8) {
        seen.add(hit)
        try {
          out.push(maskSource(readFileSync(hit, "utf8")).code)
        } catch {}
        break
      }
    }
  }
  return out.join("\n")
}

function scanWebhookAndAbuse({ rel, raw, code, info, push }) {
  if (info.isWebhook) {
    const deep = code + "\n" + localImportsText(raw, rel) // the route and the helpers it imports
    const verifies = /\b(?:verifySignature|constructEvent|constructEventAsync|webhookRoute|timingSafeEqual|createHmac|verifyWebhook|validateEvent|safeEqual|svix|Webhook\s*\(|\.verify\s*\(|crypto\s*\.\s*subtle\s*\.\s*verify|verifyRequestSignature|verifyKey)\b/.test(deep)
    if (!verifies) push(0, "webhook-no-signature", "fail", "webhook route that never checks a signature")
    const usesJson = /\b(?:request|req)\s*\.\s*json\s*\(\s*\)/.test(code)
    const usesRaw = /\b(?:request|req)\s*\.\s*(?:text|arrayBuffer)\s*\(\s*\)|\bwebhookRoute\b|\breadTextLimited\b/.test(deep)
    if (usesJson && !usesRaw) push(code.search(/\.\s*json\s*\(\s*\)/), "webhook-json-body", "fail", "request.json() in a webhook")
    const idem = /\b(?:onConflictDoNothing|onConflictDoUpdate|skipDuplicates|upsert|processedEvents?|idempot\w*|eventId|event\.id|alreadyProcessed|webhookEvents?|unique)\b/i.test(deep)
    if (!idem) push(0, "webhook-no-idempotency", "warn", "no sign that repeated events are handled")
  }
  // rate limits on abuse-prone endpoints
  const abuseName = /(?:login|signin|sign-in|signup|sign-up|register|forgot|reset-?password|verify-?email|otp|contact|subscribe|newsletter|invite|password)/i
  const isEntryFile = info.isRoute || info.directive === "server"
  if (isEntryFile && !info.isAuthLibRoute && !info.isWebhook) {
    const nameHit = abuseName.test(rel) || [...code.matchAll(/\bexport\s+(?:async\s+function|const)\s+([A-Za-z_$][\w$]*)/g)].some((m) => abuseName.test(m[1]))
    if (nameHit && !/\brate[-_]?limit|\bRatelimit\b|\blimiter\b|\bthrottle\b/i.test(code)) {
      push(0, "no-rate-limit", "warn", "endpoint that attackers like to hammer has no rate limit")
    }
  }
  void raw
}

/* ---------------------------------------------------------- project level ---- */

function projectChecks(issues, ignoresUsed, files) {
  const push = (id, level, file, text) => issues.push({ file, line: 1, col: 1, level, id, text })
  // .gitignore
  let gi = null
  try {
    gi = readFileSync(join(cwd, ".gitignore"), "utf8")
  } catch {}
  const ignoresEnv = gi !== null && gi.split("\n").some((l) => /^\s*\.env(?:\*|\.\*|\.local)?\s*$/.test(l) || /^\s*\.env\*/.test(l))
  if (existsSync(join(cwd, "package.json")) && !ignoresEnv) push("gitignore-env", "fail", ".gitignore", gi === null ? "no .gitignore file" : ".env files are not ignored")
  // tracked env files
  try {
    const tracked = execFileSync("git", ["ls-files"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split("\n")
    for (const f of tracked) if (/(?:^|\/)\.env(?:\.[^/]*)?$/.test(f) && !/\.(?:example|sample|template)$/.test(f)) push("env-tracked", "fail", f, `${f} is committed to git`)
  } catch {}
  // .env.example
  if (existsSync(join(cwd, "server/env.ts")) || existsSync(join(cwd, "src/server/env.ts"))) {
    if (![".env.example", ".env.sample", ".env.template"].some((f) => existsSync(join(cwd, f)))) push("env-example-missing", "warn", ".env.example", "no .env.example")
  }
  // NEXT_PUBLIC_ in env files
  for (const f of readdirSync(cwd).filter((n) => /^\.env/.test(n))) {
    let text = ""
    try {
      text = readFileSync(join(cwd, f), "utf8")
    } catch {
      continue
    }
    text.split("\n").forEach((line, i) => {
      const m = /^\s*NEXT_PUBLIC_([A-Z0-9_]+)\s*=/.exec(line)
      if (!m) return
      if (/SECRET|PRIVATE|PASSWORD|PASSWD|SERVICE_ROLE|DATABASE|DB_URL|WEBHOOK|SIGNING|JWT|ENCRYPT|CLIENT_SECRET|ADMIN/.test(m[1])) {
        issues.push({ file: f, line: i + 1, col: 1, level: "fail", id: "public-secret", text: `NEXT_PUBLIC_${m[1]} is sent to every browser` })
      }
    })
  }
  // package.json scripts
  if (nextMajor >= 16 && /\bnext\s+lint\b/.test(JSON.stringify(pkg?.scripts ?? {}))) push("next-lint-script", "warn", "package.json", '"lint": "next lint" no longer exists in Next.js 16')
  // tests
  const hasServerCode = files.some((f) => /(?:^|\/)(?:server|services)\//.test(f) || /\/route\.[tj]s$/.test(f))
  if (hasServerCode) {
    let anyTest = false
    for (const f of walkAllTests()) {
      anyTest = true
      void f
      break
    }
    if (!anyTest) push("no-tests", "warn", "package.json", "there is backend code but no test files")
  }
  void ignoresUsed
}

function* walkAllTests() {
  const stack = [cwd]
  let count = 0
  while (stack.length && count < 20000) {
    const dir = stack.pop()
    let entries = []
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of entries) {
      count++
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === ".next" || e.name === ".git") continue
        stack.push(join(dir, e.name))
      } else if (/\.(?:test|spec)\.[cm]?[tj]sx?$/.test(e.name)) {
        yield join(dir, e.name)
      }
    }
  }
}

/** Schema files anywhere in the usual places, even when only one folder is being checked. */
function* allSchemaFiles() {
  for (const d of ["server", "src", "db", "prisma", "lib", "drizzle"]) {
    const full = join(cwd, d)
    if (existsSync(full) && statSync(full).isDirectory()) {
      for (const f of walk(full, 1)) if (/schema/.test(f)) yield f
    }
  }
}

/* ---------------------------------------- guard helpers of the project's own */

const autoGuards = new Map() // function name -> file where it is defined
let autoGuardRe = null

/** Every code file in the usual places, also when only one folder is being checked. */
function* allProjectFiles() {
  for (const d of ROOT_DIRS) {
    const full = join(cwd, d)
    if (existsSync(full) && statSync(full).isDirectory()) yield* walk(full, 1)
  }
  for (const f of ROOT_FILES) {
    const full = join(cwd, f)
    if (existsSync(full)) yield full
  }
}

/**
 * A helper that the project wrote itself counts as a guard when it checks the session AND refuses
 * the caller (401, "unauthorized", forbidden, a redirect). Then `export const GET = handle(async ...)`
 * is not reported as an open endpoint when `handle` does the sign-in check for everybody.
 * Route files, pages and "use server" files are skipped: their exports are endpoints, not helpers.
 */
function collectAutoGuards() {
  const known = new Set(DEFAULT_GUARDS)
  const decl = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)|^(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=\s*(?:async\b|function\b|\(|[A-Za-z_$][\w$]*\s*=>)/gm
  for (const f of allProjectFiles()) {
    const rel = toPosix(relative(cwd, f))
    if (f.endsWith("schema.prisma") || /(?:^|\/)app\/(?:.*\/)?(?:route|page|layout|loading|error|not-found)\.[cm]?[tj]sx?$/.test(rel) || /(?:^|\/)pages\//.test(rel)) continue
    let raw
    try {
      raw = readFileSync(f, "utf8")
    } catch {
      continue
    }
    if (!GUARD_RE.test(raw)) continue
    const { code } = maskSource(raw)
    if (/^\s*["']use server["']/.test(raw.replace(/^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*/, ""))) continue
    for (const m of code.matchAll(decl)) {
      const name = m[1] ?? m[2]
      if (!name || known.has(name) || autoGuards.has(name) || new RegExp(`^(?:${HTTP_METHODS})$`).test(name)) continue
      const rest = code.slice(m.index)
      const next = rest.slice(1).search(/\n(?=(?:export|const|let|var|function|async|class|type|interface|enum)\b)/)
      const end = m.index + (next < 0 ? rest.length : next + 1)
      if (GUARD_RE.test(code.slice(m.index, end)) && /\b401\b|\bunauthori[sz]ed\b|\bforbidden\b|\bredirect\s*\(|\bnotAuthenticated\b/i.test(raw.slice(m.index, end))) {
        autoGuards.set(name, rel)
      }
    }
  }
  if (autoGuards.size) autoGuardRe = new RegExp(`\\b(?:${[...autoGuards.keys()].map((n) => n.replace(/[$]/g, "\\$")).join("|")})\\s*(?:<[^>(]*>)?\\s*\\(`)
}

/* ------------------------------------------------------------------ setup --- */

function setupProblems() {
  const problems = []
  if (!pkg) return ["package.json not found. Run the check from the project root."]
  const has = (...paths) => paths.some((p) => existsSync(join(cwd, p)))
  const wrappers = has("server/api.ts", "src/server/api.ts") && has("server/action.ts", "src/server/action.ts")
  if (!wrappers && customGuards.length === 0) problems.push("server/api.ts and server/action.ts are missing (the safe wrappers are not installed).")
  if (!has("server/env.ts", "src/server/env.ts", "src/env.ts", "env.ts", "lib/env.ts")) problems.push("server/env.ts is missing (environment variables are not validated).")
  if (!deps.zod) problems.push("zod is not installed (npm install zod).")
  if (!deps["server-only"]) problems.push("server-only is not installed (npm install server-only).")
  return problems
}

/* ------------------------------------------------------------------- main --- */

const problems = flags.has("--skip-setup") ? [] : setupProblems()
const files = [...collectFiles()].sort()
collectOwnerTables(flags.has("--changed") || targets.length ? [...allSchemaFiles()] : files)
collectAutoGuards()
const issues = []
const ignoresUsed = []
for (const f of files) {
  try {
    scanFile(f, issues, ignoresUsed)
  } catch (err) {
    console.error(`Could not scan ${toPosix(relative(cwd, f))}: ${err?.message ?? err}`)
  }
}
if (!targets.length && !flags.has("--changed")) projectChecks(issues, ignoresUsed, files.map((f) => toPosix(relative(cwd, f))))

const fails = issues.filter((i) => i.level === "fail").length
const warns = issues.length - fails

/**
 * All output is built first and written once. The exit code is set with process.exitCode and the
 * process ends by itself. Calling process.exit() right after a large write to a pipe can cut the
 * output off, and a tool that reads this output through a pipe would then miss the last lines.
 */
function jsonReport() {
  const guards = [...autoGuards].map(([name, file]) => ({ name, file }))
  return JSON.stringify({ files: files.length, stack, setupProblems: problems, fails, warns, issues, ignores: ignoresUsed, guardsFound: guards }, null, 2) + "\n"
}

function textReport() {
  const out = []
  const say = (line = "") => out.push(line)

  say(`backend-solid check: ${files.length} file${files.length === 1 ? "" : "s"} scanned${stack.length ? ` (${stack.join(", ")})` : ""}`)

  if (autoGuards.size) {
    say(`Guards found in this project (they check the session and refuse with 401 or a redirect): ${[...autoGuards].map(([n, f]) => `${n} (${f})`).join(", ")}`)
  }

  if (problems.length) {
    say("\nSETUP NEEDED. Do references/setup.md first:")
    for (const p of problems) say(`  - ${p}`)
  }

  let printed = 0
  const byFile = new Map()
  for (const i of issues) {
    if (!byFile.has(i.file)) byFile.set(i.file, [])
    byFile.get(i.file).push(i)
  }
  for (const [file, list] of byFile) {
    if (printed >= MAX_TOTAL) break
    list.sort((a, b) => a.line - b.line || (a.level === b.level ? 0 : a.level === "fail" ? -1 : 1))
    say(`\n${file}`)
    for (const i of list.slice(0, MAX_PER_FILE)) {
      if (printed >= MAX_TOTAL) break
      say(`  ${String(i.line).padEnd(5)} ${i.level.toUpperCase().padEnd(4)}  ${i.id.padEnd(26)} ${i.text}`)
      printed++
    }
    if (list.length > MAX_PER_FILE) say(`  ... and ${list.length - MAX_PER_FILE} more in this file`)
  }
  if (issues.length > printed) say(`\n(${issues.length - printed} more issues not shown. Fix these and run again.)`)

  if (issues.length) {
    say("\nHow to fix:")
    for (const id of [...new Set(issues.map((i) => i.id))]) say(`  ${id}: ${FIX[id] ?? ""}`)
  }

  if (ignoresUsed.length) {
    say(`\nIgnored on purpose (${ignoresUsed.length}). Mention each one in your report:`)
    for (const g of ignoresUsed) say(`  ${g.file}:${g.line}  ${g.rule}  ${g.reason}`)
  }

  say("")
  if (fails) {
    say(`FAIL: ${fails} to fix, ${warns} warning${warns === 1 ? "" : "s"}. Fix every FAIL and run the check again.`)
  } else if (warns) {
    say(`PASS with ${warns} warning${warns === 1 ? "" : "s"}. Fix them unless you have a clear reason not to.`)
  } else if (!problems.length) {
    say("PASS: no problems found.")
  }
  say("This check finds known patterns only. It cannot tell you if the logic is right. Test and review as well.")
  return out.join("\n") + "\n"
}

process.stdout.write(flags.has("--json") ? jsonReport() : textReport())
process.exitCode = problems.length ? 2 : fails ? 1 : 0
