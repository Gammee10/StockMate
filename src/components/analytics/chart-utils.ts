// src/components/analytics/chart-utils.ts
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
export function getRunwayUrgencyLevel(
  daysOfStockRemaining: number | null
): RunwayUrgencyLevel {
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

  const getPercentage = (count: number) =>
    total > 0 ? Math.round((count / total) * 100) : 0;

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

/**
 * Calculates SVG stroke-dasharray and stroke-dashoffset parameters for an interactive Donut chart.
 */
export function calculateDonutSegments(
  distribution: InventoryDistribution,
  radius = 40
): DonutSegment[] {
  const circumference = 2 * Math.PI * radius;
  const categories: StatusDistributionCategory[] = [
    distribution.outOfStock,
    distribution.criticalLow,
    distribution.lowStock,
    distribution.healthy,
    distribution.deadStock,
  ];

  const svgColors: Record<StockVelocityStatus, string> = {
    OUT_OF_STOCK: 'hsl(var(--destructive))',
    CRITICAL_LOW: 'hsl(var(--destructive) / 0.8)',
    LOW_STOCK: 'hsl(var(--warning))',
    HEALTHY: 'hsl(var(--primary))',
    DEAD_STOCK: 'hsl(var(--muted-foreground) / 0.4)',
  };

  let accumulatedPercentage = 0;

  return categories.map((cat) => {
    const strokeDashoffset = -((accumulatedPercentage / 100) * circumference);
    const dashLength = (cat.percentage / 100) * circumference;
    const strokeDasharray = `${dashLength} ${circumference - dashLength}`;
    accumulatedPercentage += cat.percentage;

    return {
      status: cat.status,
      label: cat.label,
      count: cat.count,
      percentage: cat.percentage,
      colorClass: cat.colorClass,
      svgColor: svgColors[cat.status],
      circumference,
      strokeDasharray,
      strokeDashoffset,
    };
  });
}

/**
 * Classifies a product into one of the 4 retail inventory matrix quadrants.
 */
export function classifyProductQuadrant(
  product: ProductVelocityMetrics
): ProductQuadrant {
  const isHighVelocity = product.salesVelocityPerDay >= 1.0;
  const isLowStock =
    product.currentStock <= product.lowStockThreshold ||
    (product.daysOfStockRemaining !== null && product.daysOfStockRemaining <= 5);

  if (isHighVelocity && isLowStock) {
    return 'urgent_restock';
  }
  if (isHighVelocity && !isLowStock) {
    return 'star_performer';
  }
  if (!isHighVelocity && !isLowStock) {
    return 'dead_capital';
  }
  return 'slow_mover';
}

/**
 * Groups products into 4 strategic retail quadrants for high-level business intelligence.
 */
export function groupProductsByQuadrant(
  products: ProductVelocityMetrics[]
): Record<ProductQuadrant, QuadrantData> {
  const grouped: Record<ProductQuadrant, QuadrantData> = {
    urgent_restock: {
      quadrant: 'urgent_restock',
      title: 'Urgent Restock',
      subtitle: 'High demand, stockout imminent within 5 days',
      badgeVariant: 'destructive',
      actionPrompt: 'Order now from wholesale importer to prevent lost revenue',
      products: [],
      totalStockUnits: 0,
      totalRevenueCents: 0,
    },
    star_performer: {
      quadrant: 'star_performer',
      title: 'Star Performers',
      subtitle: 'High demand, healthy stock runway',
      badgeVariant: 'success',
      actionPrompt: 'Core cash flow drivers, maintain reliable supply buffer',
      products: [],
      totalStockUnits: 0,
      totalRevenueCents: 0,
    },
    slow_mover: {
      quadrant: 'slow_mover',
      title: 'Slow Movers',
      subtitle: 'Low demand, low inventory footprint',
      badgeVariant: 'secondary',
      actionPrompt: 'Reorder only in small minimum wholesale packs',
      products: [],
      totalStockUnits: 0,
      totalRevenueCents: 0,
    },
    dead_capital: {
      quadrant: 'dead_capital',
      title: 'Dead Capital Traps',
      subtitle: 'Low/zero demand, high shelf inventory',
      badgeVariant: 'warning',
      actionPrompt: 'Capital tied up on shelves. Run bundle clearance discounts',
      products: [],
      totalStockUnits: 0,
      totalRevenueCents: 0,
    },
  };

  for (const p of products) {
    const q = classifyProductQuadrant(p);
    grouped[q].products.push(p);
    grouped[q].totalStockUnits += p.currentStock;
    grouped[q].totalRevenueCents += p.revenueCents;
  }

  return grouped;
}

/**
 * Sorts products by chosen business metric.
 */
export function sortProducts(
  products: ProductVelocityMetrics[],
  sortBy: ProductSortKey
): ProductVelocityMetrics[] {
  const copy = [...products];

  switch (sortBy) {
    case 'velocity_desc':
      return copy.sort((a, b) => b.salesVelocityPerDay - a.salesVelocityPerDay);
    case 'runway_asc':
      return copy.sort((a, b) => {
        const rA = a.daysOfStockRemaining ?? 999999;
        const rB = b.daysOfStockRemaining ?? 999999;
        return rA - rB;
      });
    case 'stock_asc':
      return copy.sort((a, b) => a.currentStock - b.currentStock);
    case 'revenue_desc':
      return copy.sort((a, b) => b.revenueCents - a.revenueCents);
    case 'name_asc':
      return copy.sort((a, b) => a.productName.localeCompare(b.productName));
  }
}

/**
 * Paginate an array of items for scalable, low-memory touch rendering.
 */
export function paginateProducts<T>(
  items: T[],
  page: number,
  pageSize = 10
): PaginationResult<T> {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const pageItems = items.slice(startIndex, startIndex + pageSize);

  return {
    items: pageItems,
    totalItems,
    totalPages,
    currentPage,
    pageSize,
  };
}
