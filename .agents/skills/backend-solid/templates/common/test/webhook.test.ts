// test/webhook.test.ts
import { createHmac } from "node:crypto"
import { describe, expect, it } from "vitest"
import { safeEqual, verifySignature } from "@/server/webhook"

const SECRET = "whsec_test_0123456789"
const body = '{"id":"evt_1","type":"payment.succeeded"}'
const now = 1_800_000_000_000 // ms
const t = now / 1000

const v1 = (secret = SECRET, ts = t, raw = body) => createHmac("sha256", secret).update(`${ts}.${raw}`).digest("hex")
const check = (header: string | null, extra: Partial<Parameters<typeof verifySignature>[0]> = {}) =>
  verifySignature({ rawBody: body, header, secret: SECRET, nowMs: now, ...extra })

describe("verifySignature", () => {
  it("accepts a correct signature", () => {
    expect(check(`t=${t},v1=${v1()}`)).toBe(true)
  })

  it("accepts the Stripe header shape, with an extra v0 value that is ignored", () => {
    expect(check(`t=${t},v1=${v1()},v0=${"0".repeat(64)}`)).toBe(true)
  })

  it("accepts any matching v1 when a secret is being rotated", () => {
    const old = v1("whsec_old_secret_0000000000")
    expect(check(`t=${t},v1=${old},v1=${v1()}`)).toBe(true)
    expect(check(`t=${t},v1=${v1()},v1=${old}`)).toBe(true)
  })

  it.each([
    ["no header", null],
    ["an empty header", ""],
    ["no timestamp", `v1=${v1()}`],
    ["a timestamp that is not a number", `t=abc,v1=${v1()}`],
    ["a fractional timestamp", `t=${t}.5,v1=${v1()}`],
    ["no v1 value", `t=${t}`],
    ["only a v0 value", `t=${t},v0=${v1()}`],
    ["a wrong secret", `t=${t},v1=${v1("another-secret-0000000000")}`],
    ["a signature of another body", `t=${t},v1=${v1(SECRET, t, body + " ")}`],
    ["a signature for another timestamp", `t=${t + 1},v1=${v1()}`],
    ["a v1 that is not hex", `t=${t},v1=${"z".repeat(64)}`],
    ["a v1 that is too short", `t=${t},v1=abcd`],
    ["a v1 of odd length", `t=${t},v1=${v1().slice(0, 63)}`],
  ])("rejects %s", (_name, header) => {
    expect(check(header)).toBe(false)
  })

  it("rejects an old timestamp and one far in the future, and honors the tolerance", () => {
    const old = t - 301
    const future = t + 301
    expect(check(`t=${old},v1=${v1(SECRET, old)}`)).toBe(false)
    expect(check(`t=${future},v1=${v1(SECRET, future)}`)).toBe(false)
    expect(check(`t=${old},v1=${v1(SECRET, old)}`, { toleranceSeconds: 600 })).toBe(true)
    const edge = t - 300
    expect(check(`t=${edge},v1=${v1(SECRET, edge)}`)).toBe(true)
  })
})

describe("safeEqual", () => {
  it("is true only for equal strings, whatever the lengths", () => {
    expect(safeEqual("Bearer abc", "Bearer abc")).toBe(true)
    expect(safeEqual("Bearer abc", "Bearer abd")).toBe(false)
    expect(safeEqual("short", "a much longer string than the first one")).toBe(false)
    expect(safeEqual("", "x")).toBe(false)
    expect(safeEqual("", "")).toBe(true)
  })
})
