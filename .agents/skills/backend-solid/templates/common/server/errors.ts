// server/errors.ts
import "server-only"
import { z } from "zod"
import { AppError } from "@/lib/errors"
import { logError } from "@/server/log"

/** Database error code. Drizzle puts it on `err.cause.code`. Prisma and node-postgres put it on `err.code`. */
function dbCode(err: unknown): string | undefined {
  const e = err as { code?: unknown; cause?: { code?: unknown } } | null
  const code = e?.code ?? e?.cause?.code
  return typeof code === "string" ? code : undefined
}

export const isUniqueViolation = (err: unknown) =>
  ["23505", "P2002", "SQLITE_CONSTRAINT_UNIQUE"].includes(dbCode(err) ?? "")

/** Prisma only: update() and delete() throw P2025 when no row matches the where clause. */
export const isRecordNotFound = (err: unknown) => dbCode(err) === "P2025"

// Postgres has two codes for "a foreign key stops this": 23503 (NO ACTION, the default) and 23001 (ON DELETE RESTRICT).
export const isForeignKeyViolation = (err: unknown) =>
  ["23503", "23001", "P2003", "SQLITE_CONSTRAINT_FOREIGNKEY"].includes(dbCode(err) ?? "")

export function validationError(error: z.ZodError) {
  return new AppError("VALIDATION", "Some fields are not valid.", {
    fields: z.flattenError(error).fieldErrors as Record<string, string[]>,
  })
}

/** Turn anything that was thrown into an error that is safe to show. Unknown errors are logged and hidden. */
export function toAppError(err: unknown, context: Record<string, unknown> = {}): AppError {
  if (err instanceof AppError) return err
  if (err instanceof z.ZodError) return validationError(err)
  if (isUniqueViolation(err)) return new AppError("CONFLICT", "This already exists.")
  if (isForeignKeyViolation(err)) return new AppError("CONFLICT", "This change conflicts with related data.")
  logError("Unhandled error", err, context)
  return new AppError("INTERNAL", "Something went wrong. Please try again.")
}
