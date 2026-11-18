import { describe, expect, it } from 'vitest';
import { generateDemoData } from './demo-data';

describe('Realistic Demo Data Generator (Pure)', () => {
  const fixedNow = new Date('2026-11-19T00:00:00.000Z');

  it('generates deterministic data with identical seed and timestamp', () => {
    const run1 = generateDemoData({ seed: 42, now: fixedNow });
    const run2 = generateDemoData({ seed: 42, now: fixedNow });

    expect(run1).toEqual(run2);
  });

  it('generates different data with different seeds', () => {
    const run1 = generateDemoData({ seed: 42, now: fixedNow });
    const run2 = generateDemoData({ seed: 99, now: fixedNow });

    expect(run1.products[0].stock).not.toBe(run2.products[0].stock);
    expect(run1.sales.length).not.toBe(run2.sales.length);
  });

  it('produces about 40 products with generic names, valid prices, and 70-90% cost prices', () => {
    const { products } = generateDemoData({ seed: 42, now: fixedNow });

    expect(products.length).toBeGreaterThanOrEqual(35);
    expect(products.length).toBeLessThanOrEqual(45);

    for (const product of products) {
      expect(product.id).toBeDefined();
      expect(product.name).toBeTruthy();
      expect(Number.isInteger(product.priceCents)).toBe(true);
      expect(Number.isInteger(product.costCents)).toBe(true);
      expect(product.priceCents).toBeGreaterThan(0);
      expect(product.costCents).toBeGreaterThan(0);

      // Cost price is between 70% and 90% of selling price
      const costRatio = product.costCents / product.priceCents;
      expect(costRatio).toBeGreaterThanOrEqual(0.69);
      expect(costRatio).toBeLessThanOrEqual(0.91);

      expect(product.lowStockThreshold).toBeGreaterThan(0);
      expect(product.stock).toBeGreaterThanOrEqual(0);
      expect(product.isArchived).toBe(false);
    }
  });

  it('ensures stock never goes below 0 at any point in movement history', () => {
    const { stockMovements } = generateDemoData({ seed: 42, now: fixedNow });

    expect(stockMovements.length).toBeGreaterThan(0);

    for (const m of stockMovements) {
      expect(m.stockBefore).toBeGreaterThanOrEqual(0);
      expect(m.stockAfter).toBeGreaterThanOrEqual(0);
      expect(m.stockBefore + m.quantityDelta).toBe(m.stockAfter);
    }
  });

  it('conserves inventory: final product stock equals the sum of its movement deltas', () => {
    const { products, stockMovements } = generateDemoData({ seed: 42, now: fixedNow });

    for (const product of products) {
      const productMovements = stockMovements.filter((m) => m.productId === product.id);
      expect(productMovements.length).toBeGreaterThan(0);

      const netDelta = productMovements.reduce((sum, m) => sum + m.quantityDelta, 0);
      expect(product.stock).toBe(netDelta);
    }
  });

  it('ensures every sale total exactly equals the sum of its item lines', () => {
    const { sales } = generateDemoData({ seed: 42, now: fixedNow });

    expect(sales.length).toBeGreaterThan(0);

    for (const sale of sales) {
      expect(sale.items.length).toBeGreaterThanOrEqual(1);
      expect(sale.items.length).toBeLessThanOrEqual(4);

      const computedTotal = sale.items.reduce(
        (sum, item) => sum + item.quantity * item.unitPriceCents,
        0
      );

      expect(sale.totalAmountCents).toBe(computedTotal);
      expect(sale.status).toBe('COMPLETED');
    }
  });

  it('approximates payment distribution of ~60% cash and ~40% digital', () => {
    const { sales } = generateDemoData({ seed: 42, now: fixedNow });

    const cashSales = sales.filter((s) => s.paymentMethod === 'CASH').length;
    const cashRatio = cashSales / sales.length;

    // Between 50% and 70% cash
    expect(cashRatio).toBeGreaterThan(0.5);
    expect(cashRatio).toBeLessThan(0.7);
  });

  it('generates higher transaction volume on weekends compared to weekdays', () => {
    const { sales } = generateDemoData({ seed: 42, now: fixedNow });

    let weekendSales = 0;
    let weekdaySales = 0;
    let weekendDays = 0;
    let weekdayDays = 0;

    const salesByDay = new Map<string, number>();
    for (const sale of sales) {
      const dateKey = sale.createdAt.toISOString().slice(0, 10);
      salesByDay.set(dateKey, (salesByDay.get(dateKey) ?? 0) + 1);
    }

    for (let d = 0; d < 30; d++) {
      const dayDate = new Date(fixedNow.getTime() - (29 - d) * 86_400_000);
      const dateKey = dayDate.toISOString().slice(0, 10);
      const count = salesByDay.get(dateKey) ?? 0;
      const dayOfWeek = dayDate.getUTCDay(); // 0 is Sunday, 6 is Saturday

      if (dayOfWeek === 0 || dayOfWeek === 6) {
        weekendSales += count;
        weekendDays++;
      } else {
        weekdaySales += count;
        weekdayDays++;
      }
    }

    const avgWeekend = weekendSales / weekendDays;
    const avgWeekday = weekdaySales / weekdayDays;

    expect(avgWeekend).toBeGreaterThan(avgWeekday);
  });

  it('satisfies dashboard shape requirements (fast sellers, dead stock, stockout episodes, low stock)', () => {
    const data = generateDemoData({ seed: 42, now: fixedNow });
    const { products, sales, stockMovements } = data;

    // 1. Calculate sales count per product
    const unitsSoldByProduct = new Map<string, number>();
    for (const sale of sales) {
      for (const item of sale.items) {
        unitsSoldByProduct.set(
          item.productId,
          (unitsSoldByProduct.get(item.productId) ?? 0) + item.quantity
        );
      }
    }

    // Fast sellers: at least 4 products with substantial sales (e.g. >= 60 units in 30 days)
    const fastSellers = products.filter((p) => (unitsSoldByProduct.get(p.id) ?? 0) >= 60);
    expect(fastSellers.length).toBeGreaterThanOrEqual(4);

    // Dead stock: at least 4 products with 0 sales
    const deadStock = products.filter((p) => (unitsSoldByProduct.get(p.id) ?? 0) === 0);
    expect(deadStock.length).toBeGreaterThanOrEqual(4);

    // Low stock right now: at least 3 products with 0 < currentStock <= lowStockThreshold
    const lowStockCurrent = products.filter(
      (p) => p.stock > 0 && p.stock <= p.lowStockThreshold
    );
    expect(lowStockCurrent.length).toBeGreaterThanOrEqual(3);

    // Stockout duration: at least 3 products that ran out of stock for 1 to 3 days (24h to 72h)
    // Find products that hit stock 0, and then had a subsequent movement between 24h and 72h later restoring stock
    const outOfStockDurationsByProduct = new Map<string, number[]>();
    for (const product of products) {
      const pMovements = stockMovements
        .filter((m) => m.productId === product.id)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      let zeroSince: number | null = null;
      for (const m of pMovements) {
        if (m.stockAfter === 0 && zeroSince === null) {
          zeroSince = m.createdAt.getTime();
        } else if (m.stockBefore === 0 && m.stockAfter > 0 && zeroSince !== null) {
          const durationDays = (m.createdAt.getTime() - zeroSince) / 86_400_000;
          if (!outOfStockDurationsByProduct.has(product.id)) {
            outOfStockDurationsByProduct.set(product.id, []);
          }
          outOfStockDurationsByProduct.get(product.id)!.push(durationDays);
          zeroSince = null;
        }
      }
      // Also check if it's currently at 0 at window end
      if (zeroSince !== null) {
        const durationDays = (fixedNow.getTime() - zeroSince) / 86_400_000;
        if (!outOfStockDurationsByProduct.has(product.id)) {
          outOfStockDurationsByProduct.set(product.id, []);
        }
        outOfStockDurationsByProduct.get(product.id)!.push(durationDays);
      }
    }

    const productsWith1To3DaysStockout = Array.from(
      outOfStockDurationsByProduct.entries()
    ).filter(([_, durations]) => durations.some((d) => d >= 1.0 && d <= 3.5));

    expect(productsWith1To3DaysStockout.length).toBeGreaterThanOrEqual(3);
  });

  it('maintains all core distribution invariants across multiple distinct seeds', () => {
    for (const seed of [1, 42, 100, 777]) {
      const data = generateDemoData({ seed, now: fixedNow });
      expect(data.summary.productCount).toBe(40);
      expect(data.summary.fastSellerCount).toBeGreaterThanOrEqual(4);
      expect(data.summary.deadStockCount).toBeGreaterThanOrEqual(4);
      expect(data.summary.stockoutRecoveredCount).toBeGreaterThanOrEqual(3);
      expect(data.summary.lowStockCurrentCount).toBeGreaterThanOrEqual(3);

      for (const p of data.products) {
        expect(p.stock).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
