// lib/errors.ts
// Safe to import anywhere. No secrets and no server-only code in this file.

export type ErrorCode =
  | "VALIDATION"
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNPROCESSABLE"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "RATE_LIMITED"
  | "INTERNAL"

const STATUS: Record<ErrorCode, number> = {
  VALIDATION: 400,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  RATE_LIMITED: 429,
  INTERNAL: 500,
}

/**
 * An error we expect, with a message that is safe to show to the user.
 * Anything that is not an AppError is a bug. It is logged and the user sees a generic message.
 */
export class AppError extends Error {
  readonly status: number
  readonly fields?: Record<string, string[]>
  readonly retryAfter?: number

  constructor(
    readonly code: ErrorCode,
    message: string,
    options: { fields?: Record<string, string[]>; retryAfter?: number } = {},
  ) {
    super(message)
    this.name = "AppError"
    this.status = STATUS[code]
    this.fields = options.fields
    this.retryAfter = options.retryAfter
  }
}

export const notFound = (what = "Item") => new AppError("NOT_FOUND", `${what} not found.`)
export const conflict = (message: string) => new AppError("CONFLICT", message)
export const forbidden = (message = "You do not have access to this.") => new AppError("FORBIDDEN", message)
/** The request is well formed, but a business rule says no (for example: the amount does not match the invoice). */
export const unprocessable = (message: string) => new AppError("UNPROCESSABLE", message)

/** What a client sees when something fails. */
export type PublicError = { code: ErrorCode; message: string; fields?: Record<string, string[]> }

/** What every server action returns. */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: PublicError }
