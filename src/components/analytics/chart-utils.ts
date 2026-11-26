import type {
  DonutSegment,
  InventoryDistribution,
  PaginationResult,
  ProductQuadrant,
  ProductSortOption,
  ProductVelocityMetrics,
  QuadrantData,
  RunwayUrgencyLevel,
  StockVelocityStatus,
} from '@/types/analytics';

export function calculateVelocityBarWidth(velocity: number, maxVelocity: number): number {
  if (maxVelocity <= 0 || velocity <= 0) return 0;
  return Math.min(100, Math.max(4, Math.round((velocity / maxVelocity) * 100)));
}

export function getRunwayUrgencyLevel(
  stockStatus: StockVelocityStatus,
  daysOfStockRemaining: number | null
): RunwayUrgencyLevel {
  if (stockStatus === 'OUT_OF_STOCK') return 'out_of_stock';
  if (stockStatus === 'DEAD_STOCK' || daysOfStockRemaining === null) return 'no_risk';
  if (daysOfStockRemaining <= 2) return 'critical';
  if (daysOfStockRemaining <= 5) return 'warning';
  if (daysOfStockRemaining <= 14) return 'moderate';
  return 'healthy';
}

export function formatRunwayLabel(
  daysOfStockRemaining: number | null,
  currentStock: number
): string {
  if (currentStock === 0) return '0d (Out)';
  if (daysOfStockRemaining === null) return 'No velocity';
  if (daysOfStockRemaining < 1) return '<1d left';
  return `${daysOfStockRemaining.toFixed(1)}d left`;
}

export function calculateInventoryDistribution(
  products: ProductVelocityMetrics[]
): InventoryDistribution {
  const totalCount = products.length;
  const countOf = (status: StockVelocityStatus) =>
    products.filter((p) => p.stockStatus === status).length;
  const pct = (count: number) =>
    totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;

  const outCount = countOf('OUT_OF_STOCK');
  const critCount = countOf('CRITICAL_LOW');
  const lowCount = countOf('LOW_STOCK');
  const healthyCount = countOf('HEALTHY');
  const deadCount = countOf('DEAD_STOCK');

  return {
    totalCount,
    outOfStock: {
      status: 'OUT_OF_STOCK',
      label: 'Out of stock',
      count: outCount,
      percentage: pct(outCount),
      colorClass: 'bg-destructive',
      badgeVariant: 'destructive',
    },
    criticalLow: {
      status: 'CRITICAL_LOW',
      label: 'Critical (≤2d)',
      count: critCount,
      percentage: pct(critCount),
      colorClass: 'bg-warning',
      badgeVariant: 'destructive',
    },
    lowStock: {
      status: 'LOW_STOCK',
      label: 'Low stock',
      count: lowCount,
      percentage: pct(lowCount),
      colorClass: 'bg-warning',
      badgeVariant: 'warning',
    },
    healthy: {
      status: 'HEALTHY',
      label: 'Healthy',
      count: healthyCount,
      percentage: pct(healthyCount),
      colorClass: 'bg-primary',
      badgeVariant: 'success',
    },
    deadStock: {
      status: 'DEAD_STOCK',
      label: 'Dead stock',
      count: deadCount,
      percentage: pct(deadCount),
      colorClass: 'bg-muted-foreground',
      badgeVariant: 'secondary',
    },
  };
}

export function calculateDonutSegments(
  distribution: InventoryDistribution
): DonutSegment[] {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const total = distribution.totalCount;

  const entries: Array<{
    cat: InventoryDistribution[keyof Omit<InventoryDistribution, 'totalCount'>];
    svgColor: string;
  }> = [
    { cat: distribution.outOfStock, svgColor: 'rgb(var(--destructive-rgb))' },
    { cat: distribution.criticalLow, svgColor: 'rgb(var(--warning-rgb))' },
    { cat: distribution.lowStock, svgColor: 'rgb(var(--warning-rgb) / 0.72)' },
    { cat: distribution.healthy, svgColor: 'rgb(var(--chart-1))' },
    { cat: distribution.deadStock, svgColor: 'rgb(var(--chart-5))' },
  ];

  let accumulated = 0;

  return entries.map(({ cat, svgColor }) => {
    const fraction = total > 0 ? cat.count / total : 0;
    const arcLength = fraction * circumference;
    const segment: DonutSegment = {
      status: cat.status,
      label: cat.label,
      count: cat.count,
      percentage: cat.percentage,
      colorClass: cat.colorClass,
      svgColor,
      circumference,
      strokeDasharray: `${arcLength} ${circumference}`,
      strokeDashoffset: -accumulated,
    };
    accumulated += arcLength;
    return segment;
  });
}

export function getTopVelocityProducts(
  products: ProductVelocityMetrics[],
  limit = 6
): ProductVelocityMetrics[] {
  return [...products]
    .filter((p) => p.unitsSold > 0)
    .sort(
      (a, b) =>
        b.salesVelocityPerDay - a.salesVelocityPerDay || b.revenueCents - a.revenueCents
    )
    .slice(0, limit);
}

export function getAtRiskRunwayProducts(
  products: ProductVelocityMetrics[],
  maxDays = 14
): ProductVelocityMetrics[] {
  return [...products]
    .filter(
      (p) =>
        p.stockStatus === 'OUT_OF_STOCK' ||
        p.stockStatus === 'CRITICAL_LOW' ||
        p.stockStatus === 'LOW_STOCK' ||
        (p.daysOfStockRemaining !== null && p.daysOfStockRemaining <= maxDays)
    )
    .sort((a, b) => {
      const aDays = a.currentStock === 0 ? -1 : (a.daysOfStockRemaining ?? 999);
      const bDays = b.currentStock === 0 ? -1 : (b.daysOfStockRemaining ?? 999);
      return aDays - bDays;
    })
    .slice(0, 8);
}

export function classifyProductQuadrant(
  product: ProductVelocityMetrics
): ProductQuadrant {
  if (
    product.stockStatus === 'OUT_OF_STOCK' ||
    product.stockStatus === 'CRITICAL_LOW' ||
    product.stockStatus === 'LOW_STOCK'
  ) {
    return 'urgent_restock';
  }
  if (product.stockStatus === 'DEAD_STOCK' || product.unitsSold === 0) {
    return 'dead_capital';
  }
  if (product.salesVelocityPerDay >= 1.0) {
    return 'star_performer';
  }
  return 'slow_mover';
}

export function groupProductsByQuadrant(
  products: ProductVelocityMetrics[]
): Record<ProductQuadrant, QuadrantData> {
  const buckets: Record<ProductQuadrant, ProductVelocityMetrics[]> = {
    urgent_restock: [],
    star_performer: [],
    slow_mover: [],
    dead_capital: [],
  };

  for (const product of products) {
    buckets[classifyProductQuadrant(product)].push(product);
  }

  const build = (
    quadrant: ProductQuadrant,
    title: string,
    subtitle: string,
    badgeVariant: QuadrantData['badgeVariant'],
    actionPrompt: string
  ): QuadrantData => {
    const items = buckets[quadrant];
    return {
      quadrant,
      title,
      subtitle,
      badgeVariant,
      actionPrompt,
      products: items,
      totalStockUnits: items.reduce((sum, p) => sum + p.currentStock, 0),
      totalRevenueCents: items.reduce((sum, p) => sum + p.revenueCents, 0),
    };
  };

  return {
    urgent_restock: build(
      'urgent_restock',
      'Urgent restock',
      'Low, critical, or out of stock',
      'destructive',
      'Prioritize wholesale replenishment'
    ),
    star_performer: build(
      'star_performer',
      'Star performers',
      'High velocity (≥1/day) and healthy stock',
      'success',
      'Keep stocked ahead of weekend peaks'
    ),
    slow_mover: build(
      'slow_mover',
      'Steady movers',
      'Consistent demand with healthy runway',
      'warning',
      'Maintain standard reorder threshold'
    ),
    dead_capital: build(
      'dead_capital',
      'Dead capital',
      'Zero units sold in window with shelf stock',
      'secondary',
      'Hold reorders or bundle to free cash'
    ),
  };
}

export function sortProducts(
  products: ProductVelocityMetrics[],
  sortBy: ProductSortOption
): ProductVelocityMetrics[] {
  const copy = [...products];
  switch (sortBy) {
    case 'velocity_desc':
      return copy.sort((a, b) => b.salesVelocityPerDay - a.salesVelocityPerDay);
    case 'runway_asc':
      return copy.sort((a, b) => {
        const aDays = a.currentStock === 0 ? -1 : (a.daysOfStockRemaining ?? 9999);
        const bDays = b.currentStock === 0 ? -1 : (b.daysOfStockRemaining ?? 9999);
        return aDays - bDays;
      });
    case 'stock_asc':
      return copy.sort((a, b) => a.currentStock - b.currentStock);
    case 'revenue_desc':
      return copy.sort((a, b) => b.revenueCents - a.revenueCents);
    case 'name_asc':
      return copy.sort((a, b) => a.productName.localeCompare(b.productName));
  }
}

export function paginateProducts<T>(
  items: T[],
  currentPage: number,
  pageSize = 10
): PaginationResult<T> {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    totalItems,
    totalPages,
    currentPage: safePage,
    pageSize,
  };
}
