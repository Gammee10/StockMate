// src/server/analytics/service.ts
import 'server-only';
import { db } from '@/server/db';
import type {
  StockVelocityRange,
  StockVelocityStatus,
  ProductVelocityMetrics,
  StockVelocityReport,
  StockVelocitySummary,
} from './types';

interface ProductInput {
  id: string;
  name: string;
  priceCents: number;
  stock: number;
  lowStockThreshold: number;
}

interface SaleItemInput {
  quantity: number;
  unitPriceCents: number;
}

export function determineStockStatus(
  stock: number,
  lowStockThreshold: number,
  unitsSold: number,
  daysOfStockRemaining: number | null
): StockVelocityStatus {
  if (stock === 0) {
    return 'OUT_OF_STOCK';
  }

  if (daysOfStockRemaining !== null && daysOfStockRemaining <= 2) {
    return 'CRITICAL_LOW';
  }

  if (
    stock <= lowStockThreshold ||
    (daysOfStockRemaining !== null && daysOfStockRemaining <= 5)
  ) {
    return 'LOW_STOCK';
  }

  if (unitsSold === 0 && stock > 0) {
    return 'DEAD_STOCK';
  }

  return 'HEALTHY';
}

export function calculateRecommendedOrder(
  stock: number,
  lowStockThreshold: number,
  velocityPerDay: number,
  targetDays: number
): number {
  if (velocityPerDay > 0) {
    const targetStock = Math.ceil(velocityPerDay * targetDays);
    return Math.max(0, targetStock - stock);
  }

  if (stock === 0) {
    // If out of stock with 0 sales in window, recommend baseline threshold
    return lowStockThreshold;
  }

  // Dead stock with units on shelf requires 0 reorder
  return 0;
}

export function calculateProductVelocity(
  product: ProductInput,
  saleItems: SaleItemInput[],
  windowDays: number,
  targetSupplyDays = 7
): ProductVelocityMetrics {
  const unitsSold = saleItems.reduce((sum, item) => sum + item.quantity, 0);
  const revenueCents = saleItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPriceCents,
    0
  );

  const rawVelocity = windowDays > 0 ? unitsSold / windowDays : 0;
  const salesVelocityPerDay = Number(rawVelocity.toFixed(2));

  const daysOfStockRemaining =
    salesVelocityPerDay > 0
      ? Number((product.stock / salesVelocityPerDay).toFixed(1))
      : null;

  const stockStatus = determineStockStatus(
    product.stock,
    product.lowStockThreshold,
    unitsSold,
    daysOfStockRemaining
  );

  const recommendedReorderQty = calculateRecommendedOrder(
    product.stock,
    product.lowStockThreshold,
    salesVelocityPerDay,
    targetSupplyDays
  );

  const estimatedReorderCostCents = recommendedReorderQty * product.priceCents;

  return {
    productId: product.id,
    productName: product.name,
    priceCents: product.priceCents,
    priceEtb: (product.priceCents / 100).toFixed(2),
    currentStock: product.stock,
    lowStockThreshold: product.lowStockThreshold,
    unitsSold,
    revenueCents,
    revenueEtb: (revenueCents / 100).toFixed(2),
    salesVelocityPerDay,
    daysOfStockRemaining,
    stockStatus,
    recommendedReorderQty,
    estimatedReorderCostCents,
    estimatedReorderCostEtb: (estimatedReorderCostCents / 100).toFixed(2),
  };
}

export async function computeStockVelocityReport(
  storeId: string,
  range: StockVelocityRange = '7d'
): Promise<StockVelocityReport> {
  const now = new Date();
  let windowDays = 7;
  let startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  if (range === 'today') {
    windowDays = 1;
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (range === '30d') {
    windowDays = 30;
    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  // Bounded query scoped by tenant storeId (Invariant #3)
  const products = await db.product.findMany({
    where: {
      storeId,
      isArchived: false,
    },
    take: 100,
    include: {
      saleItems: {
        where: {
          sale: {
            storeId,
            status: 'COMPLETED',
            createdAt: {
              gte: startDate,
            },
          },
        },
        select: {
          quantity: true,
          unitPriceCents: true,
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
  });

  const productMetrics: ProductVelocityMetrics[] = products.map((product) =>
    calculateProductVelocity(product, product.saleItems, windowDays, 7)
  );

  // Sort: prioritize urgency (OUT_OF_STOCK -> CRITICAL_LOW -> LOW_STOCK -> velocity descending)
  const statusPriority: Record<StockVelocityStatus, number> = {
    OUT_OF_STOCK: 1,
    CRITICAL_LOW: 2,
    LOW_STOCK: 3,
    HEALTHY: 4,
    DEAD_STOCK: 5,
  };

  productMetrics.sort((a, b) => {
    const priorityDiff = statusPriority[a.stockStatus] - statusPriority[b.stockStatus];
    if (priorityDiff !== 0) return priorityDiff;
    return b.salesVelocityPerDay - a.salesVelocityPerDay;
  });

  const totalRevenueCents = productMetrics.reduce(
    (sum, p) => sum + p.revenueCents,
    0
  );
  const totalUnitsSold = productMetrics.reduce((sum, p) => sum + p.unitsSold, 0);
  const totalEstimatedRestockCostCents = productMetrics.reduce(
    (sum, p) => sum + p.estimatedReorderCostCents,
    0
  );

  const summary: StockVelocitySummary = {
    totalRevenueCents,
    totalRevenueEtb: (totalRevenueCents / 100).toFixed(2),
    totalUnitsSold,
    fastMovingCount: productMetrics.filter((p) => p.salesVelocityPerDay >= 1.0).length,
    lowStockCount: productMetrics.filter((p) => p.stockStatus === 'LOW_STOCK').length,
    criticalLowCount: productMetrics.filter((p) => p.stockStatus === 'CRITICAL_LOW').length,
    outOfStockCount: productMetrics.filter((p) => p.stockStatus === 'OUT_OF_STOCK').length,
    deadStockCount: productMetrics.filter((p) => p.stockStatus === 'DEAD_STOCK').length,
    totalEstimatedRestockCostCents,
    totalEstimatedRestockCostEtb: (totalEstimatedRestockCostCents / 100).toFixed(2),
  };

  return {
    range,
    windowDays,
    summary,
    products: productMetrics,
  };
}
