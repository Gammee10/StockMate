// server/rate-limit.ts
import "server-only"
import { AppError } from "@/lib/errors"
import { env } from "@/server/env"

// A simple in-memory limiter. It is correct for ONE server process.
// On serverless hosts (Vercel, Lambda) or with several instances, every instance counts on its own,
// so the limit is not real. Then replace the body of rateLimit() with a shared store:
// Upstash Redis (@upstash/ratelimit) or a database table. Keep the same function signature.

type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()
const MAX_BUCKETS = 10_000 // hard cap, so a script with many keys cannot fill the memory

export async function rateLimit(key: string, { limit, windowSeconds }: { limit: number; windowSeconds: number }) {
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k)
      // Still full: drop the oldest entries (Map keeps insertion order) so memory stays bounded.
      for (const k of buckets.keys()) {
        if (buckets.size < MAX_BUCKETS) break
        buckets.delete(k)
      }
    }
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 })
    return
  }
  bucket.count++
  if (bucket.count > limit) {
    throw new AppError("RATE_LIMITED", "Too many requests. Please try again later.", {
      retryAfter: Math.ceil((bucket.resetAt - now) / 1000),
    })
  }
}

/**
 * Best-effort client address. Only trust a header that YOUR host sets or overwrites.
 * Vercel overwrites x-forwarded-for. Behind nginx, a load balancer or Cloudflare the first x-forwarded-for
 * entry can be set by the client: then read the header your proxy owns (set TRUST_PROXY_HEADER, for example
 * "cf-connecting-ip") or take the LAST entry. This limiter is a speed bump for public forms, not strong abuse control.
 */
export function clientIp(headers: Headers): string {
  const custom = env.TRUST_PROXY_HEADER
  const value = custom ? headers.get(custom) : (headers.get("x-forwarded-for")?.split(",")[0] ?? headers.get("x-real-ip"))
  return value?.trim() || "unknown"
}
