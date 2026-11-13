// src/server/webhook.ts
import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export function verifySignature(args: {
  rawBody: string;
  header: string | null;
  secret: string;
  toleranceSeconds?: number;
  nowMs?: number;
}): boolean {
  const { rawBody, header, secret, toleranceSeconds = 300, nowMs = Date.now() } = args;
  if (!header) return false;
  let t = Number.NaN;
  const signatures: string[] = [];
  for (const piece of header.split(',')) {
    const i = piece.indexOf('=');
    if (i <= 0) continue;
    const key = piece.slice(0, i).trim();
    const value = piece.slice(i + 1).trim();
    if (key === 't') t = Number(value);
    else if (key === 'v1') signatures.push(value);
  }
  if (!secret || secret.length < 16)
    throw new Error(
      'The webhook secret is missing or too short (at least 16 characters).'
    );
  if (!Number.isInteger(t) || signatures.length === 0) return false;
  if (Math.abs(nowMs / 1000 - t) > toleranceSeconds) return false;
  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest();
  return signatures.some((given) => {
    const actual = Buffer.from(given, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
}

export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(
    createHash('sha256').update(a).digest(),
    createHash('sha256').update(b).digest()
  );
}
