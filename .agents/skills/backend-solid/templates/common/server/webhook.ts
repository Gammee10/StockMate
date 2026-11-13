// server/webhook.ts
import "server-only"
import { createHash, createHmac, timingSafeEqual } from "node:crypto"

/**
 * Check a webhook signature header of the form "t=<unix seconds>,v1=<hex>".
 * This is the format Stripe uses (the header is called Stripe-Signature). v1 is HMAC-SHA256 of `${t}.${rawBody}` with the shared secret.
 * - Uses the RAW body text. If you parse the JSON first and re-stringify it, the signature will not match.
 * - Compares in constant time.
 * - Rejects old timestamps, so a captured request cannot be replayed later.
 * - Accepts several v1 values. A provider sends one per active secret while a secret is being rotated.
 * If the provider has an SDK (for example Stripe's `webhooks.constructEvent`), using that is fine too.
 */
export function verifySignature(args: {
  rawBody: string
  header: string | null
  secret: string
  toleranceSeconds?: number
  nowMs?: number
}): boolean {
  const { rawBody, header, secret, toleranceSeconds = 300, nowMs = Date.now() } = args
  if (!header) return false
  let t = Number.NaN
  const signatures: string[] = []
  for (const piece of header.split(",")) {
    const i = piece.indexOf("=")
    if (i <= 0) continue
    const key = piece.slice(0, i).trim()
    const value = piece.slice(i + 1).trim()
    if (key === "t") t = Number(value)
    else if (key === "v1") signatures.push(value) // other schemes (v0 ...) are ignored on purpose
  }
  // An empty key is a valid HMAC key: anyone could sign their own body. Fail closed.
  if (!secret || secret.length < 16) throw new Error("The webhook secret is missing or too short (at least 16 characters).")
  if (!Number.isInteger(t) || signatures.length === 0) return false
  if (Math.abs(nowMs / 1000 - t) > toleranceSeconds) return false
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest()
  return signatures.some((given) => {
    const actual = Buffer.from(given, "hex")
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  })
}

/** Compare two secret strings in constant time. Use it for tokens and secrets. Never compare them with === . */
export function safeEqual(a: string, b: string): boolean {
  // Hash both first: the two buffers then always have the same length, and the length of the secret is not leaked.
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest())
}
