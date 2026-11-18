import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateProductVelocity,
  determineStockStatus,
  calculateRecommendedOrder,
  computeStockVelocityReport,
} from './service';
import { db } from '@/server/db';
import { logger } from '@/lib/logger';

vi.mock('@/server/db', () => ({
  db: {
    product: {
      findMany: vi.fn(),
    },
    saleItem: {
      groupBy: vi.fn(),
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
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
      expect(metrics.costCents).toBeNull();
      expect(metrics.costIsEstimated).toBe(true);
      expect(metrics.estimatedReorderCostCents).toBe(200000); // 8 * 25000 (selling price fallback)
      expect(metrics.estimatedReorderCostEtb).toBe('2000.00');
    });

    it('calculates estimated reorder cost using costCents when available', () => {
      const product = {
        id: 'prod_oil',
        name: 'Cooking Oil 1L',
        priceCents: 25000,
        costCents: 19500, // 195.00 ETB cost
        stock: 6,
        lowStockThreshold: 5,
      };

      const saleItems = [
        { quantity: 8, unitPriceCents: 25000 },
        { quantity: 6, unitPriceCents: 25000 },
      ];

      const metrics = calculateProductVelocity(product, saleItems, 7, 7);

      expect(metrics.costCents).toBe(19500);
      expect(metrics.costIsEstimated).toBe(false);
      expect(metrics.recommendedReorderQty).toBe(8);
      expect(metrics.estimatedReorderCostCents).toBe(156000); // 8 * 19500
      expect(metrics.estimatedReorderCostEtb).toBe('1560.00');
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
    it('queries products for storeId and computes aggregate report summary using saleItem.groupBy', async () => {
      const mockProducts = [
        {
          id: 'p1',
          name: 'Fast Item',
          priceCents: 10000,
          costCents: 8000,
          stock: 2,
          lowStockThreshold: 5,
        },
        {
          id: 'p2',
          name: 'Dead Item',
          priceCents: 5000,
          costCents: null,
          stock: 20,
          lowStockThreshold: 5,
        },
      ];

      (db.product.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockProducts
      );

      (db.saleItem.groupBy as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        {
          productId: 'p1',
          unitPriceCents: 10000,
          _sum: { quantity: 14 },
        },
      ]);

      const report = await computeStockVelocityReport('store_123', '7d');

      expect(db.product.findMany).toHaveBeenCalledWith({
        where: {
          storeId: 'store_123',
          isArchived: false,
        },
        orderBy: { id: 'asc' },
        take: 100,
        select: {
          id: true,
          name: true,
          priceCents: true,
          costCents: true,
          stock: true,
          lowStockThreshold: true,
        },
      });

      expect(db.saleItem.groupBy).toHaveBeenCalledWith({
        by: ['productId', 'unitPriceCents'],
        where: {
          sale: {
            storeId: 'store_123',
            status: 'COMPLETED',
            createdAt: {
              gte: expect.any(Date),
            },
          },
        },
        _sum: {
          quantity: true,
        },
      });

      expect(report.range).toBe('7d');
      expect(report.windowDays).toBe(7);
      expect(report.summary.totalUnitsSold).toBe(14);
      expect(report.summary.totalRevenueCents).toBe(140000);
      expect(report.summary.totalRevenueEtb).toBe('1400.00');
      expect(report.summary.deadStockCount).toBe(1);
      expect(report.summary.criticalLowCount).toBe(1);
      expect(report.summary.itemsWithoutCost).toBe(1); // p2 has no cost
      expect(report.products).toHaveLength(2);
    });

    it('paginates products in batches of 100 to support 250+ products without dropping any', async () => {
      // Generate 250 products: batch 1 (100), batch 2 (100), batch 3 (50)
      const batch1 = Array.from({ length: 100 }, (_, i) => ({
        id: `prod_${String(i).padStart(3, '0')}`,
        name: `Product ${i}`,
        priceCents: 1000,
        costCents: 800,
        stock: 10,
        lowStockThreshold: 5,
      }));

      const batch2 = Array.from({ length: 100 }, (_, i) => ({
        id: `prod_${String(i + 100).padStart(3, '0')}`,
        name: `Product ${i + 100}`,
        priceCents: 2000,
        costCents: 1500,
        stock: 5,
        lowStockThreshold: 5,
      }));

      const batch3 = Array.from({ length: 50 }, (_, i) => ({
        id: `prod_${String(i + 200).padStart(3, '0')}`,
        name: `Product ${i + 200}`,
        priceCents: 3000,
        costCents: 2000,
        stock: 0,
        lowStockThreshold: 5,
      }));

      (db.product.findMany as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(batch1)
        .mockResolvedValueOnce(batch2)
        .mockResolvedValueOnce(batch3);

      // Grouped sales for a product in batch 1, batch 2, and batch 3
      (db.saleItem.groupBy as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        {
          productId: 'prod_005',
          unitPriceCents: 1000,
          _sum: { quantity: 10 },
        },
        {
          productId: 'prod_150',
          unitPriceCents: 2000,
          _sum: { quantity: 5 },
        },
        {
          productId: 'prod_249',
          unitPriceCents: 3000,
          _sum: { quantity: 2 },
        },
      ]);

      const report = await computeStockVelocityReport('store_456', '30d');

      expect(db.product.findMany).toHaveBeenCalledTimes(3);

      // Verify cursor chaining
      expect(db.product.findMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          take: 100,
        })
      );
      expect(db.product.findMany).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          cursor: { id: 'prod_099' },
          skip: 1,
          take: 100,
        })
      );
      expect(db.product.findMany).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          cursor: { id: 'prod_199' },
          skip: 1,
          take: 100,
        })
      );

      // All 250 products must be present in report
      expect(report.products).toHaveLength(250);
      expect(report.summary.totalUnitsSold).toBe(17); // 10 + 5 + 2
      expect(report.summary.totalRevenueCents).toBe(26000); // 10*1000 + 5*2000 + 2*3000 = 10000 + 10000 + 6000
      expect(report.summary.totalRevenueEtb).toBe('260.00');
    });

    it('warns and caps at 1000 products when ceiling is reached', async () => {
      // 10 batches of 100 products = 1000 products
      for (let b = 0; b < 10; b++) {
        const batch = Array.from({ length: 100 }, (_, i) => ({
          id: `p_${b * 100 + i}`,
          name: `Item ${b * 100 + i}`,
          priceCents: 1000,
          costCents: null,
          stock: 10,
          lowStockThreshold: 5,
        }));
        (db.product.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce(batch);
      }

      (db.saleItem.groupBy as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

      const report = await computeStockVelocityReport('store_large', '7d');

      expect(db.product.findMany).toHaveBeenCalledTimes(10);
      expect(report.products).toHaveLength(1000);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('1000'),
        expect.objectContaining({ storeId: 'store_large', count: 1000 })
      );
    });
  });
});
