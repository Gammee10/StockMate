// test/money.test.ts
import { describe, expect, it } from "vitest"
import { formatMoney, toCents } from "@/lib/money"

describe("toCents", () => {
  it.each([
    ["12.34", 1234],
    ["12", 1200],
    ["12.5", 1250],
    ["0.07", 7],
    ["1,234.50", 123_450],
    ["  19.99 ", 1999],
    ["1.005", null], // three decimals: refuse instead of guessing a rounding
    ["-5", null],
    ["abc", null],
    ["", null],
    ["1e3", null],
  ])("%j -> %j", (input, expected) => {
    expect(toCents(input)).toBe(expected)
  })

  it("is exact where float math is not", () => {
    expect(toCents("1.15")).toBe(115) // 1.15 * 100 === 114.99999999999999 in floating point
    expect(toCents("8.20")).toBe(820)
  })
})

describe("formatMoney", () => {
  it("formats cents for display", () => {
    expect(formatMoney(123_450)).toBe("$1,234.50")
    expect(formatMoney(5, "EUR")).toContain("0.05")
  })
})
