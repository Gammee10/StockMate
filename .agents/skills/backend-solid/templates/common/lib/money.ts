// lib/money.ts
// Money is stored and sent as whole cents (integers). Never as a float.
// These helpers are safe on the server and in the browser. They assume currencies with 2 decimals (USD, EUR, GBP).

/** "12.34" -> 1234. Returns null when the text is not a valid amount. Never multiplies floats. */
export function toCents(input: string): number | null {
  // A comma is only a thousands separator ("1,234.50"). "12,34" (a decimal comma) is refused, not guessed.
  const text = input.trim()
  const grouped = /^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(text)
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(grouped ? text.replace(/,/g, "") : text)
  if (!match) return null
  const whole = Number(match[1])
  const fraction = Number((match[2] ?? "").padEnd(2, "0"))
  return whole * 100 + fraction
}

/** 123450 -> "$1,234.50" */
export function formatMoney(cents: number, currency = "USD", locale = "en-US"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100)
}
