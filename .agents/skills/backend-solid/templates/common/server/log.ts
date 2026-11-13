// server/log.ts
import "server-only"

/**
 * Log an error on the server only. Never send this to the client.
 * Drizzle puts the SQL and the parameter values in the error message, so we log the
 * underlying driver error (`cause`) and leave the parameters out.
 */
export function logError(message: string, err: unknown, context: Record<string, unknown> = {}) {
  const error = err instanceof Error ? err : new Error(String(err))
  const root = error.cause instanceof Error ? error.cause : error
  console.error(
    JSON.stringify({
      level: "error",
      message,
      error: root.message,
      code: (root as { code?: unknown }).code,
      // The outer error message can hold SQL and parameter values. Log the stack of the root error only.
      stack: root.stack,
      ...context,
    }),
  )
}
