// src/server/errors.ts
import 'server-only';
import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { logError } from '@/server/log';

function dbCode(err: unknown): string | undefined {
  const e = err as { code?: unknown; cause?: { code?: unknown } } | null;
  const code = e?.code ?? e?.cause?.code;
  return typeof code === 'string' ? code : undefined;
}

export const isUniqueViolation = (err: unknown) =>
  ['23505', 'P2002', 'SQLITE_CONSTRAINT_UNIQUE'].includes(dbCode(err) ?? '');

export const isRecordNotFound = (err: unknown) => dbCode(err) === 'P2025';

export const isForeignKeyViolation = (err: unknown) =>
  ['23503', '23001', 'P2003', 'SQLITE_CONSTRAINT_FOREIGNKEY'].includes(dbCode(err) ?? '');

export function validationError(error: z.ZodError) {
  return new AppError(
    'VALIDATION_ERROR',
    error.issues[0]?.message || 'Some fields are not valid.',
    {
      fields: error.flatten().fieldErrors as Record<string, string[]>,
    }
  );
}

export function toAppError(
  err: unknown,
  context: Record<string, unknown> = {}
): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof z.ZodError) return validationError(err);
  if (isUniqueViolation(err)) return new AppError('CONFLICT', 'This already exists.');
  if (isForeignKeyViolation(err))
    return new AppError('CONFLICT', 'This change conflicts with related data.');
  logError('Unhandled error', err, context);
  return new AppError('INTERNAL', 'Something went wrong. Please try again.');
}
