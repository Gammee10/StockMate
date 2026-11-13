// server/api.ts
import "server-only"
import { unstable_rethrow } from "next/navigation"
import type { NextRequest } from "next/server"
import { z } from "zod"
import { AppError } from "@/lib/errors"
import { requireAdmin, requireUser, type SessionUser } from "@/server/auth"
import { toAppError } from "@/server/errors"
import { clientIp, rateLimit } from "@/server/rate-limit"
import { parseInput, readJson, readTextLimited } from "@/server/validate"
import { safeEqual, verifySignature } from "@/server/webhook"

/**
 * Every route handler is a public HTTP endpoint. Build them with these helpers:
 *   export const POST = userRoute({ body: createInvoiceBody }, async ({ body, user }) => ...)
 * The helper checks who is calling, validates params, query and body with zod, limits the body size,
 * refuses cross-site browser requests, hides internal errors, and returns one JSON shape:
 *   success: { data }      failure: { error: { code, message, fields? } }
 */

type RouteCtx = { params: Promise<Record<string, string | string[] | undefined>> }
type Schemas = { params?: z.ZodType; query?: z.ZodType; body?: z.ZodType }
type Parsed<S extends Schemas, K extends keyof Schemas> = S[K] extends z.ZodType ? z.infer<S[K]> : undefined
type Args<S extends Schemas, U> = {
  params: Parsed<S, "params">
  query: Parsed<S, "query">
  body: Parsed<S, "body">
  user: U
  request: NextRequest
}
/** `key` names the limit, for example "invoices.create". Do not build it from the URL: ids in the path would create a new limit for every id. */
type Options = { rateLimit?: { key: string; limit: number; windowSeconds: number } }

const JSON_HEADERS = { "Cache-Control": "private, no-store" }

export function ok<T>(data: T, status = 200) {
  return Response.json({ data }, { status, headers: JSON_HEADERS })
}
export const created = <T>(data: T) => ok(data, 201)
export const noContent = () => new Response(null, { status: 204, headers: JSON_HEADERS })

function errorResponse(e: AppError) {
  const headers: Record<string, string> = { ...JSON_HEADERS }
  if (e.retryAfter) headers["Retry-After"] = String(e.retryAfter)
  return Response.json({ error: { code: e.code, message: e.message, fields: e.fields } }, { status: e.status, headers })
}

/**
 * Browsers attach cookies to cross-site requests. If a request comes with cookies and an Origin
 * that is not our own host, refuse it (CSRF). Requests without cookies (API clients) are not affected.
 */
function assertSameOrigin(request: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return
  if (!request.headers.has("cookie")) return
  const origin = request.headers.get("origin")
  if (!origin) return
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  if (hostOf(origin) !== host) throw new AppError("FORBIDDEN", "Cross-site requests are not allowed.")
}

function hostOf(origin: string): string | null {
  try {
    return new URL(origin).host
  } catch {
    return null // an Origin that is not a URL can never match our host
  }
}

function build<S extends Schemas, U>(
  authenticate: () => Promise<U>,
  schemas: S,
  handler: (args: Args<S, U>) => Promise<unknown>,
  options: Options,
) {
  return async (request: NextRequest, ctx?: RouteCtx): Promise<Response> => {
    try {
      assertSameOrigin(request)
      const user = await authenticate()
      if (options.rateLimit) {
        const who = user && typeof user === "object" && "id" in user ? String(user.id) : clientIp(request.headers)
        await rateLimit(`${options.rateLimit.key}:${who}`, options.rateLimit)
      }
      const params = schemas.params ? parseInput(schemas.params, await ctx?.params) : undefined
      const query = schemas.query
        ? parseInput(schemas.query, Object.fromEntries(request.nextUrl.searchParams))
        : undefined
      const body = schemas.body ? parseInput(schemas.body, await readJson(request)) : undefined
      const result = await handler({ params, query, body, user, request } as Args<S, U>)
      return result instanceof Response ? result : ok(result)
    } catch (err) {
      unstable_rethrow(err)
      return errorResponse(toAppError(err, { route: request.nextUrl.pathname, method: request.method }))
    }
  }
}

type Handler<S extends Schemas, U> = (args: Args<S, U>) => Promise<unknown>

/** Signed-in users only. */
export function userRoute<const S extends Schemas>(schemas: S, handler: Handler<S, SessionUser>, options: Options = {}) {
  return build(requireUser, schemas, handler, options)
}

/** Admins only. */
export function adminRoute<const S extends Schemas>(schemas: S, handler: Handler<S, SessionUser>, options: Options = {}) {
  return build(requireAdmin, schemas, handler, options)
}

/** Anyone, including signed-out visitors. Add a rateLimit option for anything that writes or is expensive. */
export function publicRoute<const S extends Schemas>(schemas: S, handler: Handler<S, null>, options: Options = {}) {
  return build(async () => null, schemas, handler, options)
}

/**
 * A webhook from another service. There is no user. The caller proves who it is with a signature
 * over the raw body. The body is only parsed after the signature is correct.
 */
export function webhookRoute<S extends z.ZodType>(
  options: { secret: () => string; signatureHeader?: string; body: S; maxBytes?: number },
  handler: (args: { event: z.infer<S> }) => Promise<unknown>,
) {
  return async (request: NextRequest): Promise<Response> => {
    try {
      const rawBody = await readTextLimited(request, options.maxBytes ?? 256_000)
      const valid = verifySignature({
        rawBody,
        header: request.headers.get(options.signatureHeader ?? "x-signature"),
        secret: options.secret(),
      })
      if (!valid) throw new AppError("UNAUTHORIZED", "Invalid signature.")
      let json: unknown
      try {
        json = JSON.parse(rawBody)
      } catch {
        throw new AppError("BAD_REQUEST", "The request body is not valid JSON.")
      }
      const event = parseInput(options.body, json)
      return ok(await handler({ event }))
    } catch (err) {
      unstable_rethrow(err)
      return errorResponse(toAppError(err, { route: request.nextUrl.pathname, method: request.method }))
    }
  }
}

/**
 * A scheduled job (Vercel Cron, GitHub Actions, any scheduler). There is no user.
 * The scheduler proves who it is with "Authorization: Bearer <secret>". Vercel sends this header by itself
 * when the project has an environment variable named CRON_SECRET. Without this check, anyone on the
 * internet can run the job. Schedulers can run a job twice or miss a run, so make the job safe to repeat.
 */
export function cronRoute(options: { secret: () => string | undefined }, handler: () => Promise<unknown>) {
  return async (request: NextRequest): Promise<Response> => {
    try {
      const secret = options.secret()
      // No secret configured: fail closed. The caller gets a plain 500 and the details go to the log.
      if (!secret) throw new Error("The cron secret is not set.")
      if (!safeEqual(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
        throw new AppError("UNAUTHORIZED", "Invalid token.")
      }
      return ok(await handler())
    } catch (err) {
      unstable_rethrow(err)
      return errorResponse(toAppError(err, { route: request.nextUrl.pathname, method: request.method }))
    }
  }
}
