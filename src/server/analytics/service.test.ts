import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateProductVelocity,
  determineStockStatus,
  calculateRecommendedOrder,
  computeStockVelocityReport,
} from './service';
import { db } from '@/server/db';

vi.mock('@/server/db', () => ({
  db: {
    product: {
      findMany: vi.fn(),
    },
  },
}));

describe('Stock Velocity Analytics Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('determineStockStatus', () => {
    it('returns OUT_OF_STOCK when stock is 0', () => {
      expect(determineStockStatus(0, 5, 10, 0)).toBe('OUT_OF_STOCK');
      expect(determineStockStatus(0, 5, 0, null)).toBe('OUT_OF_STOCK');
    });

    it('returns CRITICAL_LOW when runway is 2 days or less', () => {
      expect(determineStockStatus(4, 5, 14, 2.0)).toBe('CRITICAL_LOW');
      expect(determineStockStatus(1, 5, 7, 1.0)).toBe('CRITICAL_LOW');
    });

    it('returns LOW_STOCK when runway is <= 5 days or stock <= threshold', () => {
      // Runway is 4 days (<= 5)
      expect(determineStockStatus(8, 2, 14, 4.0)).toBe('LOW_STOCK');
      // Stock is 5 (<= threshold 5) even if runway is 10 days
      expect(determineStockStatus(5, 5, 7, 10.0)).toBe('LOW_STOCK');
    });

    it('returns DEAD_STOCK when 0 units sold and stock > 0', () => {
      expect(determineStockStatus(15, 5, 0, null)).toBe('DEAD_STOCK');
    });

    it('returns HEALTHY when runway > 5 days and stock > threshold', () => {
      expect(determineStockStatus(20, 5, 14, 10.0)).toBe('HEALTHY');
    });
  });

  describe('calculateRecommendedOrder', () => {
    it('calculates replenishment to reach target 7-day velocity supply', () => {
      // Velocity is 2 units/day. Target 7 days = 14 units. Current stock is 4. Reorder = 10 units.
      expect(calculateRecommendedOrder(4, 5, 2.0, 7)).toBe(10);
    });

    it('returns 0 when current stock already covers target supply', () => {
      // Velocity is 2 units/day. Target 7 days = 14 units. Current stock is 20. Reorder = 0.
      expect(calculateRecommendedOrder(20, 5, 2.0, 7)).toBe(0);
    });

    it('recommends threshold baseline when out of stock with 0 velocity in window', () => {
      expect(calculateRecommendedOrder(0, 10, 0, 7)).toBe(10);
    });

    it('recommends 0 for dead stock with inventory on hand', () => {
      expect(calculateRecommendedOrder(15, 5, 0, 7)).toBe(0);
    });
  });

  describe('calculateProductVelocity', () => {
    it('aggregates sale items correctly and computes daily velocity and runway', () => {
      const product = {
        id: 'prod_oil',
        name: 'Cooking Oil 1L',
        priceCents: 25000,
        stock: 6,
        lowStockThreshold: 5,
      };

      const saleItems = [
        { quantity: 8, unitPriceCents: 25000 },
        { quantity: 6, unitPriceCents: 25000 },
      ];

      const metrics = calculateProductVelocity(product, saleItems, 7, 7);

      expect(metrics.productId).toBe('prod_oil');
      expect(metrics.productName).toBe('Cooking Oil 1L');
      expect(metrics.unitsSold).toBe(14);
      expect(metrics.revenueCents).toBe(350000); // 14 * 25000
      expect(metrics.revenueEtb).toBe('3500.00');
      expect(metrics.salesVelocityPerDay).toBe(2.0); // 14 / 7
      expect(metrics.daysOfStockRemaining).toBe(3.0); // 6 / 2.0
      expect(metrics.stockStatus).toBe('LOW_STOCK'); // runway 3 days <= 5
      expect(metrics.recommendedReorderQty).toBe(8); // ceil(2 * 7) - 6 = 8
      expect(metrics.estimatedReorderCostCents).toBe(200000); // 8 * 25000
      expect(metrics.estimatedReorderCostEtb).toBe('2000.00');
    });

    it('handles product with zero sales gracefully', () => {
      const product = {
        id: 'prod_tea',
        name: 'Black Tea 100g',
        priceCents: 8000,
        stock: 12,
        lowStockThreshold: 4,
      };

      const metrics = calculateProductVelocity(product, [], 7, 7);

      expect(metrics.unitsSold).toBe(0);
      expect(metrics.revenueCents).toBe(0);
      expect(metrics.salesVelocityPerDay).toBe(0);
      expect(metrics.daysOfStockRemaining).toBeNull();
      expect(metrics.stockStatus).toBe('DEAD_STOCK');
      expect(metrics.recommendedReorderQty).toBe(0);
    });
  });

  describe('computeStockVelocityReport', () => {
    it('queries products for storeId and computes aggregate report summary', async () => {
      const mockProducts = [
        {
          id: 'p1',
          name: 'Fast Item',
          priceCents: 10000,
          stock: 2,
          lowStockThreshold: 5,
          saleItems: [{ quantity: 14, unitPriceCents: 10000 }],
        },
        {
          id: 'p2',
          name: 'Dead Item',
          priceCents: 5000,
          stock: 20,
          lowStockThreshold: 5,
          saleItems: [],
        },
      ];

      (db.product.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockProducts
      );

      const report = await computeStockVelocityReport('store_123', '7d');

      expect(db.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            storeId: 'store_123',
            isArchived: false,
          }),
          take: 100,
        })
      );

      expect(report.range).toBe('7d');
      expect(report.windowDays).toBe(7);
      expect(report.summary.totalUnitsSold).toBe(14);
      expect(report.summary.totalRevenueCents).toBe(140000);
      expect(report.summary.totalRevenueEtb).toBe('1400.00');
      expect(report.summary.deadStockCount).toBe(1);
      expect(report.summary.criticalLowCount).toBe(1);
      expect(report.products).toHaveLength(2);
    });
  });
});
