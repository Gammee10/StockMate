// src/server/log.ts
import 'server-only';

/**
 * Log an error on the server only. Never send this to the client.
 * Leaves SQL query parameters and sensitive credentials out of logs.
 */
export function logError(
  message: string,
  err: unknown,
  context: Record<string, unknown> = {}
) {
  const error = err instanceof Error ? err : new Error(String(err));
  const root = error.cause instanceof Error ? error.cause : error;
  console.error(
    JSON.stringify({
      level: 'error',
      message,
      error: root.message,
      code: (root as { code?: unknown }).code,
      stack: root.stack,
      ...context,
    })
  );
}
