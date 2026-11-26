// src/types/analytics.ts
export type {
  StockVelocityRange,
  StockVelocityStatus,
  ProductVelocityMetrics,
  StockVelocitySummary,
  StockVelocityReport,
} from '@/server/analytics/types';

import type {
  ProductVelocityMetrics,
  StockVelocityStatus,
} from '@/server/analytics/types';

export type RunwayUrgencyLevel =
  'out_of_stock' | 'critical' | 'warning' | 'moderate' | 'healthy' | 'no_risk';

export interface StatusDistributionCategory {
  status: StockVelocityStatus;
  label: string;
  count: number;
  percentage: number;
  colorClass: string;
  badgeVariant: 'destructive' | 'warning' | 'success' | 'secondary' | 'outline';
}

export interface InventoryDistribution {
  totalCount: number;
  outOfStock: StatusDistributionCategory;
  criticalLow: StatusDistributionCategory;
  lowStock: StatusDistributionCategory;
  healthy: StatusDistributionCategory;
  deadStock: StatusDistributionCategory;
}

export interface DonutSegment {
  status: StockVelocityStatus;
  label: string;
  count: number;
  percentage: number;
  colorClass: string;
  svgColor: string;
  circumference: number;
  strokeDasharray: string;
  strokeDashoffset: number;
}

export type ProductQuadrant =
  'urgent_restock' | 'star_performer' | 'slow_mover' | 'dead_capital';

export interface QuadrantData {
  quadrant: ProductQuadrant;
  title: string;
  subtitle: string;
  badgeVariant: 'destructive' | 'warning' | 'success' | 'secondary';
  actionPrompt: string;
  products: ProductVelocityMetrics[];
  totalStockUnits: number;
  totalRevenueCents: number;
}

export type ProductSortKey =
  'velocity_desc' | 'runway_asc' | 'stock_asc' | 'revenue_desc' | 'name_asc';

export type ProductSortOption = ProductSortKey;

export interface PaginationResult<T> {
  items: T[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

export type ChartViewTab =
  'donut' | 'matrix' | 'demand_supply' | 'velocity' | 'runway' | 'distribution';

export type AnalyticsFilterTab = 'all' | 'restock' | 'fast' | 'dead';
