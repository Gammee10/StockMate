// src/server/rate-limit.ts
import 'server-only';
import { AppError } from '@/lib/errors';
import { env } from '@/server/env';

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

export async function rateLimit(
  key: string,
  { limit, windowSeconds }: { limit: number; windowSeconds: number }
) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
      for (const k of buckets.keys()) {
        if (buckets.size < MAX_BUCKETS) break;
        buckets.delete(k);
      }
    }
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return;
  }
  bucket.count++;
  if (bucket.count > limit) {
    throw new AppError('RATE_LIMITED', 'Too many requests. Please try again later.', {
      retryAfter: Math.ceil((bucket.resetAt - now) / 1000),
    });
  }
}

export function clientIp(headers: Headers): string {
  const custom = env.TRUST_PROXY_HEADER;
  const value = custom
    ? headers.get(custom)
    : (headers.get('x-forwarded-for')?.split(',')[0] ?? headers.get('x-real-ip'));
  return value?.trim() || 'unknown';
}
