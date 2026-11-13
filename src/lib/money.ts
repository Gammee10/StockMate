// src/lib/money.ts
// Money is stored and sent as whole cents (integers). Never as a float.
// These helpers are safe on the server and in the browser. 50.00 ETB = 5000 cents.

/** "12.34" -> 1234. Returns null when the text is not a valid amount. Never multiplies floats. */
export function toCents(input: string): number | null {
  const text = input.trim();
  const grouped = /^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(text);
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(
    grouped ? text.replace(/,/g, '') : text
  );
  if (!match) return null;
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? '').padEnd(2, '0'));
  return whole * 100 + fraction;
}

/** 5000 -> "50.00 ETB" or formatted currency */
export function formatMoney(cents: number, currency = 'ETB', locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(
    cents / 100
  );
}

/** 5000 -> "50.00" */
export function formatBirrAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}
