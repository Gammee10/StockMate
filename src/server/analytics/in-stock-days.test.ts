// src/server/analytics/in-stock-days.test.ts
import { describe, it, expect } from 'vitest';
import { computeOutOfStockMs } from './in-stock-days';

describe('computeOutOfStockMs (Task 1.6)', () => {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const now = new Date('2026-03-08T12:00:00Z');
  const windowStart = new Date(now.getTime() - 7 * ONE_DAY_MS); // 7-day window
  const fullWindowMs = 7 * ONE_DAY_MS;

  it('scenario 1: returns 0 ms out of stock when there are no movement rows and stock > 0', () => {
    const outMs = computeOutOfStockMs({
      windowStart,
      now,
      currentStock: 10,
      rows: [],
    });

    expect(outMs).toBe(0);
  });

  it('scenario 2: returns full window duration when there are no movement rows and stock is 0', () => {
    const outMs = computeOutOfStockMs({
      windowStart,
      now,
      currentStock: 0,
      rows: [],
    });

    expect(outMs).toBe(fullWindowMs);
  });

  it('scenario 3: computes out-of-stock duration for one opening row mid-window (sells out halfway)', () => {
    // Sells out at exactly 3.5 days into the 7-day window
    const ranOutTime = new Date(windowStart.getTime() + 3.5 * ONE_DAY_MS);
    const rows = [
      {
        createdAt: ranOutTime,
        stockBefore: 1,
        stockAfter: 0,
      },
    ];

    const outMs = computeOutOfStockMs({
      windowStart,
      now,
      currentStock: 0,
      rows,
    });

    // Out from 3.5 days to 7 days = 3.5 days
    expect(outMs).toBe(3.5 * ONE_DAY_MS);
  });

  it('scenario 4: computes out-of-stock duration for one closing row (restock mid-window)', () => {
    // Was out since windowStart, restocked at 3.5 days into the window
    const restockTime = new Date(windowStart.getTime() + 3.5 * ONE_DAY_MS);
    const rows = [
      {
        createdAt: restockTime,
        stockBefore: 0,
        stockAfter: 15,
      },
    ];

    const outMs = computeOutOfStockMs({
      windowStart,
      now,
      currentStock: 15,
      rows,
    });

    // Out from windowStart to 3.5 days = 3.5 days
    expect(outMs).toBe(3.5 * ONE_DAY_MS);
  });

  it('scenario 5: computes out-of-stock duration for an INITIAL row created mid-window', () => {
    // Product didn't exist before 4 days into window; created with stock 20
    const createdTime = new Date(windowStart.getTime() + 4 * ONE_DAY_MS);
    const rows = [
      {
        createdAt: createdTime,
        stockBefore: 0,
        stockAfter: 20,
      },
    ];

    const outMs = computeOutOfStockMs({
      windowStart,
      now,
      currentStock: 20,
      rows,
    });

    // Out before creation: windowStart to 4 days = 4 days
    expect(outMs).toBe(4 * ONE_DAY_MS);
  });

  it('scenario 6: computes out-of-stock duration across two full out-of-stock cycles', () => {
    // Day 1: ran out (out from Day 1 to Day 2 = 1 day)
    // Day 2: restocked
    // Day 4: ran out again (out from Day 4 to Day 6 = 2 days)
    // Day 6: restocked
    // Day 7: now (remained in stock)
    const tDay1 = new Date(windowStart.getTime() + 1 * ONE_DAY_MS);
    const tDay2 = new Date(windowStart.getTime() + 2 * ONE_DAY_MS);
    const tDay4 = new Date(windowStart.getTime() + 4 * ONE_DAY_MS);
    const tDay6 = new Date(windowStart.getTime() + 6 * ONE_DAY_MS);

    const rows = [
      { createdAt: tDay1, stockBefore: 2, stockAfter: 0 },
      { createdAt: tDay2, stockBefore: 0, stockAfter: 10 },
      { createdAt: tDay4, stockBefore: 3, stockAfter: 0 },
      { createdAt: tDay6, stockBefore: 0, stockAfter: 8 },
    ];

    const outMs = computeOutOfStockMs({
      windowStart,
      now,
      currentStock: 8,
      rows,
    });

    // (2 - 1) + (6 - 4) = 1 + 2 = 3 days
    expect(outMs).toBe(3 * ONE_DAY_MS);
  });

  it('scenario 7: returns full window duration when all out for the whole window', () => {
    // Stock remained 0 throughout with zero-crossing rows recording 0 to 0
    const tMid = new Date(windowStart.getTime() + 3 * ONE_DAY_MS);
    const rows = [
      {
        createdAt: tMid,
        stockBefore: 0,
        stockAfter: 0,
      },
    ];

    const outMs = computeOutOfStockMs({
      windowStart,
      now,
      currentStock: 0,
      rows,
    });

    expect(outMs).toBe(fullWindowMs);
  });
});
