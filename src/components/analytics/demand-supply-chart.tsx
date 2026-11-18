// src/components/analytics/demand-supply-chart.tsx
'use client';

import { useMemo } from 'react';
import { Package } from 'lucide-react';
import type { ProductVelocityMetrics } from '@/server/analytics/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface DemandSupplyChartProps {
  products: ProductVelocityMetrics[];
  selectedProductId: string | null;
  onSelectProduct: (id: string | null) => void;
  limit?: number;
}

export function DemandSupplyChart({
  products,
  selectedProductId,
  onSelectProduct,
  limit = 6,
}: DemandSupplyChartProps) {
  // Sort by demand (units sold descending)
  const topProducts = useMemo(() => {
    return [...products].sort((a, b) => b.unitsSold - a.unitsSold).slice(0, limit);
  }, [products, limit]);

  // Find max value across both sold and stock for proportional scaling
  const maxScaleValue = useMemo(() => {
    if (topProducts.length === 0) return 10;
    const max = Math.max(
      ...topProducts.map((p) => Math.max(p.unitsSold, p.currentStock))
    );
    return Math.max(max, 1);
  }, [topProducts]);

  if (topProducts.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center rounded-lg border border-dashed border-border p-6 text-center">
        <Package className="size-8 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium text-foreground">
          No sales data available
        </p>
        <p className="text-xs text-muted-foreground">
          Sell items through the counter to visualize demand versus supply.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Legend & Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="size-3 rounded-sm bg-primary" />
            <span>Demand (Units Sold)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="bg-muted-foreground/30 size-3 rounded-sm" />
            <span>Supply (Current Stock)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="size-3 rounded-sm bg-destructive" />
            <span>Stock Deficit (Demand &gt; Stock)</span>
          </div>
        </div>
        <span>Tap item to inspect</span>
      </div>

      {/* Chart Canvas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {topProducts.map((product) => {
          const isSelected = selectedProductId === product.productId;
          const isStockDeficit = product.currentStock < product.unitsSold;
          const soldHeightPercent = Math.max(
            8,
            Math.round((product.unitsSold / maxScaleValue) * 100)
          );
          const stockHeightPercent = Math.max(
            product.currentStock > 0 ? 8 : 4,
            Math.round((product.currentStock / maxScaleValue) * 100)
          );

          return (
            <Button
              key={product.productId}
              type="button"
              variant={isSelected ? 'secondary' : 'outline'}
              onClick={() => onSelectProduct(isSelected ? null : product.productId)}
              className={`group flex h-auto min-h-56 flex-col justify-between p-3 text-left transition-colors ${
                isSelected
                  ? 'ring-primary/20 bg-primary/10 border-primary ring-2'
                  : 'hover:border-primary/50 bg-card'
              }`}
              style={{ touchAction: 'manipulation' }}
            >
              {/* Header: Product Name & Deficit Badge */}
              <div className="w-full space-y-1">
                <div className="flex items-start justify-between gap-1">
                  <span className="line-clamp-2 text-xs font-semibold leading-tight text-foreground group-hover:text-primary">
                    {product.productName}
                  </span>
                  {isStockDeficit && (
                    <Badge variant="destructive" className="shrink-0 px-1 py-0 text-xs">
                      Risk
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {product.salesVelocityPerDay}/day
                </p>
              </div>

              {/* Dual Vertical Bar Visualization */}
              <div className="border-border/60 my-3 flex h-28 w-full items-end justify-center gap-2 border-b pb-1">
                {/* Demand Bar (Units Sold) */}
                <div className="flex flex-1 flex-col items-center">
                  <span className="mb-1 text-xs font-semibold tabular-nums text-foreground">
                    {product.unitsSold}
                  </span>
                  <div
                    className="w-full max-w-6 rounded-t bg-primary transition-colors duration-300"
                    style={{ height: `${soldHeightPercent}%` }}
                    title={`Units sold: ${product.unitsSold}`}
                  />
                  <span className="mt-1 text-xs text-muted-foreground">Sold</span>
                </div>

                {/* Supply Bar (Current Stock) */}
                <div className="flex flex-1 flex-col items-center">
                  <span className="mb-1 text-xs font-semibold tabular-nums text-foreground">
                    {product.currentStock}
                  </span>
                  <div
                    className={`w-full max-w-6 rounded-t transition-colors duration-300 ${
                      product.currentStock === 0
                        ? 'bg-destructive'
                        : isStockDeficit
                          ? 'bg-destructive/80'
                          : 'bg-muted-foreground/40'
                    }`}
                    style={{ height: `${stockHeightPercent}%` }}
                    title={`Stock remaining: ${product.currentStock}`}
                  />
                  <span className="mt-1 text-xs text-muted-foreground">Stock</span>
                </div>
              </div>

              {/* Footer Runway / Restock Advice */}
              <div className="w-full pt-1 text-center">
                {product.daysOfStockRemaining !== null ? (
                  <span
                    className={`text-xs font-medium ${
                      product.daysOfStockRemaining <= 3
                        ? 'text-destructive'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {product.daysOfStockRemaining <= 0
                      ? 'Out of stock'
                      : `${product.daysOfStockRemaining}d runway`}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Steady</span>
                )}
              </div>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
