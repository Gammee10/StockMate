// src/server/analytics/in-stock-days.ts
import 'server-only';

export interface ZeroCrossingRow {
  createdAt: Date;
  stockBefore: number;
  stockAfter: number;
}

export interface ComputeOutOfStockMsOptions {
  windowStart: Date;
  now: Date;
  currentStock: number;
  rows: ZeroCrossingRow[];
}

/**
 * Computes milliseconds a product was out of stock within a given time window (Task 1.6).
 * Analyzes zero-crossing stock movements (stockBefore === 0 or stockAfter === 0).
 */
export function computeOutOfStockMs({
  windowStart,
  now,
  currentStock,
  rows,
}: ComputeOutOfStockMsOptions): number {
  const windowDurationMs = Math.max(0, now.getTime() - windowStart.getTime());
  if (windowDurationMs === 0) return 0;

  // No rows: if currently out of stock, assume out for the entire window; else 0
  if (rows.length === 0) {
    return currentStock === 0 ? windowDurationMs : 0;
  }

  let outMs = 0;
  // If the earliest event in the window started at stockBefore === 0,
  // it was out of stock from windowStart until that event.
  let outSince: number | null =
    rows[0].stockBefore === 0 ? windowStart.getTime() : null;

  for (const row of rows) {
    const rowTime = row.createdAt.getTime();

    // If stock returned from 0 (stockBefore === 0) and we were in an out-of-stock interval
    if (row.stockBefore === 0 && outSince !== null) {
      outMs += Math.max(0, rowTime - outSince);
      outSince = null;
    }

    // If stock reached 0 (stockAfter === 0), start new out-of-stock interval
    if (row.stockAfter === 0) {
      outSince = rowTime;
    }
  }

  // After loop, if still out of stock, count time up to now
  if (outSince !== null) {
    outMs += Math.max(0, now.getTime() - outSince);
  }

  // Clamp output within [0, windowDurationMs]
  return Math.min(Math.max(outMs, 0), windowDurationMs);
}
