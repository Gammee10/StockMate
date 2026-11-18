// src/components/analytics/chart-utils.ts
import type { ProductVelocityMetrics, StockVelocityStatus } from '@/server/analytics/types';

export type RunwayUrgencyLevel =
  | 'out_of_stock'
  | 'critical'
  | 'warning'
  | 'moderate'
  | 'healthy'
  | 'no_risk';

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

/**
 * Calculates responsive width percentage for horizontal velocity bars.
 * Ensures a minimum of 5% for visible non-zero values so even small sales are visible.
 */
export function calculateVelocityBarWidth(velocity: number, maxVelocity: number): number {
  if (velocity <= 0 || maxVelocity <= 0) {
    return 0;
  }
  const ratio = (velocity / maxVelocity) * 100;
  return Math.max(5, Math.min(100, Math.round(ratio)));
}

/**
 * Categorizes stockout runway into urgency levels for visual progress meters and colors.
 */
export function getRunwayUrgencyLevel(daysOfStockRemaining: number | null): RunwayUrgencyLevel {
  if (daysOfStockRemaining === null) {
    return 'no_risk';
  }
  if (daysOfStockRemaining <= 0) {
    return 'out_of_stock';
  }
  if (daysOfStockRemaining <= 2) {
    return 'critical';
  }
  if (daysOfStockRemaining <= 5) {
    return 'warning';
  }
  if (daysOfStockRemaining <= 14) {
    return 'moderate';
  }
  return 'healthy';
}

/**
 * Aggregates count and percentage breakdowns across the 5 inventory health categories.
 */
export function calculateInventoryDistribution(
  products: ProductVelocityMetrics[]
): InventoryDistribution {
  const total = products.length;

  const countByStatus: Record<StockVelocityStatus, number> = {
    OUT_OF_STOCK: 0,
    CRITICAL_LOW: 0,
    LOW_STOCK: 0,
    HEALTHY: 0,
    DEAD_STOCK: 0,
  };

  for (const p of products) {
    countByStatus[p.stockStatus] = (countByStatus[p.stockStatus] || 0) + 1;
  }

  const getPercentage = (count: number) => (total > 0 ? Math.round((count / total) * 100) : 0);

  return {
    totalCount: total,
    outOfStock: {
      status: 'OUT_OF_STOCK',
      label: 'Out of stock',
      count: countByStatus.OUT_OF_STOCK,
      percentage: getPercentage(countByStatus.OUT_OF_STOCK),
      colorClass: 'bg-destructive',
      badgeVariant: 'destructive',
    },
    criticalLow: {
      status: 'CRITICAL_LOW',
      label: 'Critical low (≤ 2d)',
      count: countByStatus.CRITICAL_LOW,
      percentage: getPercentage(countByStatus.CRITICAL_LOW),
      colorClass: 'bg-destructive/80',
      badgeVariant: 'destructive',
    },
    lowStock: {
      status: 'LOW_STOCK',
      label: 'Low stock (≤ 5d)',
      count: countByStatus.LOW_STOCK,
      percentage: getPercentage(countByStatus.LOW_STOCK),
      colorClass: 'bg-warning',
      badgeVariant: 'warning',
    },
    healthy: {
      status: 'HEALTHY',
      label: 'Healthy stock',
      count: countByStatus.HEALTHY,
      percentage: getPercentage(countByStatus.HEALTHY),
      colorClass: 'bg-primary',
      badgeVariant: 'success',
    },
    deadStock: {
      status: 'DEAD_STOCK',
      label: 'Dead stock (0 sales)',
      count: countByStatus.DEAD_STOCK,
      percentage: getPercentage(countByStatus.DEAD_STOCK),
      colorClass: 'bg-muted-foreground/40',
      badgeVariant: 'secondary',
    },
  };
}

/**
 * Formats runway into a readable label for merchant display.
 */
export function formatRunwayLabel(daysOfStockRemaining: number | null): string {
  if (daysOfStockRemaining === null) {
    return 'No sales / idle';
  }
  if (daysOfStockRemaining <= 0) {
    return 'Depleted today';
  }
  if (daysOfStockRemaining === 1.0) {
    return '1.0 day left';
  }
  if (Number.isInteger(daysOfStockRemaining)) {
    return `${daysOfStockRemaining} days left`;
  }
  return `${daysOfStockRemaining.toFixed(1)} days left`;
}

/**
 * Returns top N products ordered by sales velocity descending.
 */
export function getTopVelocityProducts(
  products: ProductVelocityMetrics[],
  limit = 5
): ProductVelocityMetrics[] {
  return [...products]
    .sort((a, b) => b.salesVelocityPerDay - a.salesVelocityPerDay)
    .slice(0, limit);
}

/**
 * Returns products with runway <= maxDays ordered by runway ascending (most urgent first).
 */
export function getAtRiskRunwayProducts(
  products: ProductVelocityMetrics[],
  maxDays = 14
): ProductVelocityMetrics[] {
  return products
    .filter((p) => p.daysOfStockRemaining !== null && p.daysOfStockRemaining <= maxDays)
    .sort((a, b) => (a.daysOfStockRemaining ?? 0) - (b.daysOfStockRemaining ?? 0));
}
