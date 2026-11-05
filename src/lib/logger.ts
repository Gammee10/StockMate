type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'pin',
  'pinhash',
  'token',
  'secret',
  'authorization',
  'cookie',
  'jwt',
  'apikey',
  'idempotencykey',
]);

/**
 * Recursively deep-redacts sensitive fields in logging context.
 */
export function sanitizeContext(data: unknown, seen = new WeakSet()): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data !== 'object') {
    return data;
  }

  // Handle cyclic references
  if (seen.has(data as object)) {
    return '[CIRCULAR]';
  }
  seen.add(data as object);

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeContext(item, seen));
  }

  if (data instanceof Error) {
    return {
      name: data.name,
      message: data.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : data.stack,
    };
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const normalizedKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(normalizedKey)) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = sanitizeContext(value, seen);
    }
  }

  return sanitized;
}

class Logger {
  private log(level: LogLevel, message: string, context?: Record<string, unknown>) {
    const isProduction = process.env.NODE_ENV === 'production';
    const sanitizedContext = context
      ? (sanitizeContext(context) as Record<string, unknown>)
      : undefined;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(sanitizedContext ? { context: sanitizedContext } : {}),
    };

    if (isProduction) {
      const output = JSON.stringify(entry);
      if (level === 'error') {
        console.error(output);
      } else if (level === 'warn') {
        console.warn(output);
      } else {
        console.info(output);
      }
    } else {
      const prefix = `[${entry.timestamp}] [${level.toUpperCase()}] ${message}`;
      if (level === 'error') {
        console.error(prefix, sanitizedContext ?? '');
      } else if (level === 'warn') {
        console.warn(prefix, sanitizedContext ?? '');
      } else {
        console.info(prefix, sanitizedContext ?? '');
      }
    }
  }

  debug(message: string, context?: Record<string, unknown>) {
    if (process.env.NODE_ENV !== 'production') {
      this.log('debug', message, context);
    }
  }

  info(message: string, context?: Record<string, unknown>) {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.log('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>) {
    this.log('error', message, context);
  }
}

export const logger = new Logger();
