// src/components/analytics/chart-utils.test.ts
import { describe, it, expect } from 'vitest';
import {
  calculateVelocityBarWidth,
  getRunwayUrgencyLevel,
  calculateInventoryDistribution,
  formatRunwayLabel,
  getTopVelocityProducts,
  getAtRiskRunwayProducts,
  calculateDonutSegments,
  classifyProductQuadrant,
  groupProductsByQuadrant,
  paginateProducts,
  sortProducts,
} from './chart-utils';
import type { ProductVelocityMetrics } from '@/server/analytics/types';

describe('Chart Utilities for Interactive Analytics', () => {
  const sampleProducts: ProductVelocityMetrics[] = [
    {
      productId: 'p1',
      productName: 'Cooking Oil 1L',
      currentStock: 3,
      unitsSold: 21,
      salesVelocityPerDay: 3.0,
      inStockDays: 7,
      daysOfStockRemaining: 1.0,
      stockStatus: 'CRITICAL_LOW',
      recommendedReorderQty: 18,
      priceCents: 25000,
      priceEtb: '250.00',
      lowStockThreshold: 5,
      revenueCents: 525000,
      revenueEtb: '5250.00',
      costCents: null,
      costIsEstimated: true,
      estimatedReorderCostCents: 450000,
      estimatedReorderCostEtb: '4500.00',
    },
    {
      productId: 'p2',
      productName: 'Laundry Soap',
      currentStock: 8,
      unitsSold: 14,
      salesVelocityPerDay: 2.0,
      inStockDays: 7,
      daysOfStockRemaining: 4.0,
      stockStatus: 'LOW_STOCK',
      recommendedReorderQty: 6,
      priceCents: 5000,
      priceEtb: '50.00',
      lowStockThreshold: 5,
      revenueCents: 70000,
      revenueEtb: '700.00',
      costCents: null,
      costIsEstimated: true,
      estimatedReorderCostCents: 30000,
      estimatedReorderCostEtb: '300.00',
    },
    {
      productId: 'p3',
      productName: 'Mineral Water 500ml',
      currentStock: 0,
      unitsSold: 7,
      salesVelocityPerDay: 1.0,
      inStockDays: 7,
      daysOfStockRemaining: 0,
      stockStatus: 'OUT_OF_STOCK',
      recommendedReorderQty: 7,
      priceCents: 2500,
      priceEtb: '25.00',
      lowStockThreshold: 5,
      revenueCents: 17500,
      revenueEtb: '175.00',
      costCents: null,
      costIsEstimated: true,
      estimatedReorderCostCents: 17500,
      estimatedReorderCostEtb: '175.00',
    },
    {
      productId: 'p4',
      productName: 'Shiro Powder 500g',
      currentStock: 50,
      unitsSold: 7,
      salesVelocityPerDay: 1.0,
      inStockDays: 7,
      daysOfStockRemaining: 50.0,
      stockStatus: 'HEALTHY',
      recommendedReorderQty: 0,
      priceCents: 6500,
      priceEtb: '65.00',
      lowStockThreshold: 5,
      revenueCents: 45500,
      revenueEtb: '455.00',
      costCents: null,
      costIsEstimated: true,
      estimatedReorderCostCents: 0,
      estimatedReorderCostEtb: '0.00',
    },
    {
      productId: 'p5',
      productName: 'Old Batteries AA',
      currentStock: 12,
      unitsSold: 0,
      salesVelocityPerDay: 0,
      inStockDays: 7,
      daysOfStockRemaining: null,
      stockStatus: 'DEAD_STOCK',
      recommendedReorderQty: 0,
      priceCents: 4000,
      priceEtb: '40.00',
      lowStockThreshold: 5,
      revenueCents: 0,
      revenueEtb: '0.00',
      costCents: null,
      costIsEstimated: true,
      estimatedReorderCostCents: 0,
      estimatedReorderCostEtb: '0.00',
    },
  ];

  describe('calculateVelocityBarWidth', () => {
    it('returns min 5% for non-zero velocity and scales up to 100%', () => {
      expect(calculateVelocityBarWidth(3.0, 3.0)).toBe(100);
      expect(calculateVelocityBarWidth(1.5, 3.0)).toBe(50);
      expect(calculateVelocityBarWidth(0.01, 3.0)).toBeGreaterThanOrEqual(5);
    });

    it('returns 0% for 0 velocity', () => {
      expect(calculateVelocityBarWidth(0, 3.0)).toBe(0);
    });

    it('handles zero maxVelocity safely without NaN', () => {
      expect(calculateVelocityBarWidth(0, 0)).toBe(0);
    });
  });

  describe('getRunwayUrgencyLevel', () => {
    it('classifies stockout risk urgency accurately', () => {
      expect(getRunwayUrgencyLevel(0)).toBe('out_of_stock');
      expect(getRunwayUrgencyLevel(1.5)).toBe('critical'); // <= 2 days
      expect(getRunwayUrgencyLevel(4.0)).toBe('warning'); // <= 5 days
      expect(getRunwayUrgencyLevel(10.0)).toBe('moderate'); // <= 14 days
      expect(getRunwayUrgencyLevel(20.0)).toBe('healthy');
      expect(getRunwayUrgencyLevel(null)).toBe('no_risk');
    });
  });

  describe('calculateInventoryDistribution', () => {
    it('aggregates count and percentages for all 5 stock statuses', () => {
      const dist = calculateInventoryDistribution(sampleProducts);
      expect(dist.totalCount).toBe(5);
      expect(dist.outOfStock.count).toBe(1);
      expect(dist.criticalLow.count).toBe(1);
      expect(dist.lowStock.count).toBe(1);
      expect(dist.healthy.count).toBe(1);
      expect(dist.deadStock.count).toBe(1);

      // Percentages (each is 1/5 = 20%)
      expect(dist.outOfStock.percentage).toBe(20);
      expect(dist.criticalLow.percentage).toBe(20);
      expect(dist.lowStock.percentage).toBe(20);
      expect(dist.healthy.percentage).toBe(20);
      expect(dist.deadStock.percentage).toBe(20);
    });

    it('handles empty product list without division by zero', () => {
      const dist = calculateInventoryDistribution([]);
      expect(dist.totalCount).toBe(0);
      expect(dist.outOfStock.percentage).toBe(0);
      expect(dist.healthy.percentage).toBe(0);
    });
  });

  describe('formatRunwayLabel', () => {
    it('formats days remaining in user-friendly strings', () => {
      expect(formatRunwayLabel(0)).toBe('Depleted today');
      expect(formatRunwayLabel(1.0)).toBe('1.0 day left');
      expect(formatRunwayLabel(2.5)).toBe('2.5 days left');
      expect(formatRunwayLabel(14.0)).toBe('14 days left');
      expect(formatRunwayLabel(null)).toBe('No sales / idle');
    });
  });

  describe('getTopVelocityProducts', () => {
    it('sorts products by daily velocity descending and limits to top N', () => {
      const top = getTopVelocityProducts(sampleProducts, 3);
      expect(top).toHaveLength(3);
      expect(top[0].productId).toBe('p1'); // 3.0/day
      expect(top[1].productId).toBe('p2'); // 2.0/day
      expect(top[2].salesVelocityPerDay).toBe(1.0);
    });
  });

  describe('getAtRiskRunwayProducts', () => {
    it('filters products with runway <= 14 days and sorts by runway ascending', () => {
      const atRisk = getAtRiskRunwayProducts(sampleProducts, 14);
      // p3 has 0 days, p1 has 1.0 day, p2 has 4.0 days
      expect(atRisk.map((p) => p.productId)).toEqual(['p3', 'p1', 'p2']);
    });
  });

  describe('calculateDonutSegments', () => {
    it('computes svg stroke-dasharray and offsets for donut slices', () => {
      const dist = calculateInventoryDistribution(sampleProducts);
      const radius = 40;
      const segments = calculateDonutSegments(dist, radius);

      expect(segments).toHaveLength(5);
      const totalCircumference = 2 * Math.PI * radius;
      expect(segments[0].circumference).toBeCloseTo(totalCircumference, 1);
      // Verify all segments have strokeDasharray string
      for (const seg of segments) {
        expect(seg.strokeDasharray).toBeDefined();
        expect(typeof seg.strokeDashoffset).toBe('number');
      }
    });

    it('handles empty catalog with zero-length segments without crashing', () => {
      const dist = calculateInventoryDistribution([]);
      const segments = calculateDonutSegments(dist, 40);
      expect(segments).toHaveLength(5);
      expect(segments.every((s) => s.percentage === 0)).toBe(true);
    });
  });

  describe('classifyProductQuadrant', () => {
    it('accurately classifies products into the 4 retail quadrants', () => {
      // p1: 3.0/day (High velocity), 3 stock with 1.0d runway (Low stock) -> urgent_restock
      expect(classifyProductQuadrant(sampleProducts[0])).toBe('urgent_restock');

      // p4: 1.0/day (High velocity), 50 stock with 50d runway (High stock) -> star_performer
      expect(classifyProductQuadrant(sampleProducts[3])).toBe('star_performer');

      // p5: 0/day (Zero velocity), 12 stock (High stock) -> dead_capital
      expect(classifyProductQuadrant(sampleProducts[4])).toBe('dead_capital');
    });
  });

  describe('groupProductsByQuadrant', () => {
    it('groups all products into the 4 strategic matrix quadrants', () => {
      const grouped = groupProductsByQuadrant(sampleProducts);
      expect(grouped.urgent_restock.products.length).toBeGreaterThanOrEqual(1);
      expect(grouped.star_performer.products.length).toBeGreaterThanOrEqual(1);
      expect(grouped.dead_capital.products.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('paginateProducts', () => {
    it('slices products into pages correctly', () => {
      const page1 = paginateProducts(sampleProducts, 1, 2);
      expect(page1.items).toHaveLength(2);
      expect(page1.currentPage).toBe(1);
      expect(page1.totalPages).toBe(3);
      expect(page1.totalItems).toBe(5);

      const page3 = paginateProducts(sampleProducts, 3, 2);
      expect(page3.items).toHaveLength(1);
      expect(page3.currentPage).toBe(3);
    });

    it('clamps page number to valid bounds', () => {
      const clamped = paginateProducts(sampleProducts, 999, 2);
      expect(clamped.currentPage).toBe(3);
    });
  });

  describe('sortProducts', () => {
    it('sorts by velocity descending', () => {
      const sorted = sortProducts(sampleProducts, 'velocity_desc');
      expect(sorted[0].productId).toBe('p1'); // 3.0/day
      expect(sorted[1].productId).toBe('p2'); // 2.0/day
    });

    it('sorts by runway ascending (most urgent first)', () => {
      const sorted = sortProducts(sampleProducts, 'runway_asc');
      expect(sorted[0].productId).toBe('p3'); // 0 days
      expect(sorted[1].productId).toBe('p1'); // 1.0 day
    });

    it('sorts by revenue descending', () => {
      const sorted = sortProducts(sampleProducts, 'revenue_desc');
      expect(sorted[0].productId).toBe('p1'); // 5250.00 ETB
    });

    it('sorts by name ascending', () => {
      const sorted = sortProducts(sampleProducts, 'name_asc');
      expect(sorted[0].productName).toBe('Cooking Oil 1L');
    });
  });
});
