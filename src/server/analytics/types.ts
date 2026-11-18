// src/server/analytics/types.ts
export type StockVelocityRange = '7d' | '30d' | 'today';

export type StockVelocityStatus =
  | 'OUT_OF_STOCK' // stock === 0
  | 'CRITICAL_LOW' // daysOfStockRemaining <= 2
  | 'LOW_STOCK' // stock <= threshold or daysOfStockRemaining <= 5
  | 'HEALTHY' // daysOfStockRemaining > 5
  | 'DEAD_STOCK'; // unitsSold === 0 and stock > 0

export interface ProductVelocityMetrics {
  productId: string;
  productName: string;
  priceCents: number;
  priceEtb: string;
  currentStock: number;
  lowStockThreshold: number;
  unitsSold: number;
  revenueCents: number;
  revenueEtb: string;
  salesVelocityPerDay: number;
  daysOfStockRemaining: number | null;
  stockStatus: StockVelocityStatus;
  recommendedReorderQty: number;
  estimatedReorderCostCents: number;
  estimatedReorderCostEtb: string;
}

export interface StockVelocitySummary {
  totalRevenueCents: number;
  totalRevenueEtb: string;
  totalUnitsSold: number;
  fastMovingCount: number;
  lowStockCount: number;
  criticalLowCount: number;
  outOfStockCount: number;
  deadStockCount: number;
  totalEstimatedRestockCostCents: number;
  totalEstimatedRestockCostEtb: string;
}

export interface StockVelocityReport {
  range: StockVelocityRange;
  windowDays: number;
  summary: StockVelocitySummary;
  products: ProductVelocityMetrics[];
}
