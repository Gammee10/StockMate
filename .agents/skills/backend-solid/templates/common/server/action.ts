// server/action.ts
import "server-only"
import { headers } from "next/headers"
import { unstable_rethrow } from "next/navigation"
import { z } from "zod"
import type { ActionResult } from "@/lib/errors"
import { requireAdmin, requireUser, type SessionUser } from "@/server/auth"
import { toAppError } from "@/server/errors"
import { clientIp, rateLimit } from "@/server/rate-limit"
import { parseInput } from "@/server/validate"

/**
 * Every server action is a public POST endpoint. Anyone can call it, with any input.
 * Build actions with these helpers so the checks cannot be forgotten:
 *   1. who is calling (session)   2. is the input valid (zod)   3. unexpected errors are hidden.
 * Put the real work in a service function. Keep the action itself small.
 */

type Args<S extends z.ZodType, U> = { input: z.infer<S>; user: U }
/** `key` names the limit, for example "contact.send". Counts per signed-in user, or per IP address for visitors. */
type Options = { rateLimit?: { key: string; limit: number; windowSeconds: number } }

async function limit(options: Options, user: SessionUser | null) {
  if (!options.rateLimit) return
  const who = user ? user.id : clientIp(await headers())
  await rateLimit(`${options.rateLimit.key}:${who}`, options.rateLimit)
}

async function run<R>(work: () => Promise<R>): Promise<ActionResult<R>> {
  try {
    return { ok: true, data: await work() }
  } catch (err) {
    unstable_rethrow(err) // lets redirect() and notFound() inside an action keep working
    const e = toAppError(err)
    return { ok: false, error: { code: e.code, message: e.message, fields: e.fields } }
  }
}

/** For signed-in users. */
export function userAction<S extends z.ZodType, R>(schema: S, handler: (args: Args<S, SessionUser>) => Promise<R>, options: Options = {}) {
  return async (raw: z.input<S> | FormData): Promise<ActionResult<R>> =>
    run(async () => {
      const user = await requireUser()
      await limit(options, user)
      return handler({ input: parseInput(schema, raw), user })
    })
}

/** For admins only. */
export function adminAction<S extends z.ZodType, R>(schema: S, handler: (args: Args<S, SessionUser>) => Promise<R>, options: Options = {}) {
  return async (raw: z.input<S> | FormData): Promise<ActionResult<R>> =>
    run(async () => {
      const user = await requireAdmin()
      await limit(options, user)
      return handler({ input: parseInput(schema, raw), user })
    })
}

/** For anyone, including signed-out visitors (sign-up form, contact form). Always pass a rateLimit option. */
export function publicAction<S extends z.ZodType, R>(schema: S, handler: (args: Args<S, null>) => Promise<R>, options: Options = {}) {
  return async (raw: z.input<S> | FormData): Promise<ActionResult<R>> =>
    run(async () => {
      await limit(options, null)
      return handler({ input: parseInput(schema, raw), user: null })
    })
}
