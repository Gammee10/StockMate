// src/server/validate.ts
import 'server-only';
import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { validationError } from '@/server/errors';

export function parseInput<S extends z.ZodType>(schema: S, raw: unknown): z.infer<S> {
  const value = raw instanceof FormData ? Object.fromEntries(raw.entries()) : raw;
  const result = schema.safeParse(value);
  if (!result.success) throw validationError(result.error);
  return result.data;
}

export async function readTextLimited(
  request: Request,
  maxBytes = 1_000_000
): Promise<string> {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > maxBytes)
    throw new AppError('PAYLOAD_TOO_LARGE', 'The request body is too large.');
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new AppError('PAYLOAD_TOO_LARGE', 'The request body is too large.');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function readJson(request: Request, maxBytes = 1_000_000): Promise<unknown> {
  const type = request.headers.get('content-type') ?? '';
  if (!type.toLowerCase().startsWith('application/json')) {
    throw new AppError(
      'UNSUPPORTED_MEDIA_TYPE',
      'Send JSON with the header Content-Type: application/json.'
    );
  }
  const text = await readTextLimited(request, maxBytes);
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError('BAD_REQUEST', 'The request body is not valid JSON.');
  }
}
