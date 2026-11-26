// src/components/analytics/interactive-charts.tsx
'use client';

import { useState, useMemo } from 'react';
import {
  BarChart3,
  PieChart,
  Grid2X2,
  Columns3,
  X,
  TrendingUp,
  Check,
  Copy,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type {
  ChartViewTab,
  ProductQuadrant,
  ProductVelocityMetrics,
  StockVelocityStatus,
} from '@/types/analytics';
import {
  calculateVelocityBarWidth,
  calculateInventoryDistribution,
  formatRunwayLabel,
  getTopVelocityProducts,
  getAtRiskRunwayProducts,
  getRunwayUrgencyLevel,
} from './chart-utils';
import { InteractiveDonutChart } from './interactive-donut-chart';
import { VelocityMatrix } from './velocity-matrix';
import { DemandSupplyChart } from './demand-supply-chart';
import { formatMoney } from '@/lib/money';

export type { ChartViewTab };

interface InteractiveChartsProps {
  products: ProductVelocityMetrics[];
  windowDays: number;
  loading?: boolean;
  selectedProductId: string | null;
  onSelectProduct: (productId: string | null) => void;
  selectedStatus?: StockVelocityStatus | null;
  onFilterStatus?: (status: StockVelocityStatus | null) => void;
  selectedQuadrant?: ProductQuadrant | null;
  onSelectQuadrant?: (quadrant: ProductQuadrant | null) => void;
}

export function InteractiveCharts({
  products,
  windowDays,
  loading = false,
  selectedProductId,
  onSelectProduct,
  selectedStatus = null,
  onFilterStatus,
  selectedQuadrant = null,
  onSelectQuadrant,
}: InteractiveChartsProps) {
  const [activeTab, setActiveTab] = useState<ChartViewTab>('donut');
  const [copiedInsight, setCopiedInsight] = useState(false);

  // Top products by velocity
  const topVelocityProducts = useMemo(
    () => getTopVelocityProducts(products, 6),
    [products]
  );

  // Maximum velocity among products for percentage scaling
  const maxVelocity = useMemo(() => {
    if (topVelocityProducts.length === 0) return 1;
    return Math.max(...topVelocityProducts.map((p) => p.salesVelocityPerDay), 1);
  }, [topVelocityProducts]);

  // At-risk products (runway <= 14 days)
  const atRiskProducts = useMemo(() => getAtRiskRunwayProducts(products, 14), [products]);

  // Inventory distribution across 5 statuses
  const distribution = useMemo(
    () => calculateInventoryDistribution(products),
    [products]
  );

  // Currently selected product for detailed inspection
  const selectedProduct = useMemo(
    () => products.find((p) => p.productId === selectedProductId) || null,
    [products, selectedProductId]
  );

  const getStatusBadge = (status: StockVelocityStatus) => {
    switch (status) {
      case 'OUT_OF_STOCK':
        return <Badge variant="destructive">Out of stock</Badge>;
      case 'CRITICAL_LOW':
        return <Badge variant="destructive">Critical (≤ 2d)</Badge>;
      case 'LOW_STOCK':
        return <Badge variant="warning">Low stock</Badge>;
      case 'DEAD_STOCK':
        return <Badge variant="secondary">Dead stock</Badge>;
      case 'HEALTHY':
        return <Badge variant="success">Healthy stock</Badge>;
    }
  };

  const handleCopyInsight = (product: ProductVelocityMetrics) => {
    const text = `Restock Order: ${product.productName} - Need: +${product.recommendedReorderQty} units (Current stock: ${product.currentStock}, Velocity: ${product.salesVelocityPerDay}/day, Est: ${(product.estimatedReorderCostCents / 100).toFixed(2)} ETB)`;
    navigator.clipboard.writeText(text);
    setCopiedInsight(true);
    setTimeout(() => setCopiedInsight(false), 2000);
  };

  return (
    <Card className="border border-border bg-card shadow-sm">
      <CardHeader className="space-y-3 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-foreground">
              Interactive visual intelligence
            </CardTitle>
            <CardDescription className="mt-1 text-xs text-muted-foreground">
              Compare sales velocity, track stockout runways, and balance inventory
              capital.
            </CardDescription>
          </div>

          {/* 4 Interactive Visual Views */}
          <div
            role="tablist"
            aria-label="Analytics visual chart types"
            className="bg-muted/50 flex flex-wrap items-center rounded-lg border border-border p-1"
          >
            <Button
              role="tab"
              aria-selected={activeTab === 'donut' || activeTab === 'distribution'}
              variant={
                activeTab === 'donut' || activeTab === 'distribution'
                  ? 'secondary'
                  : 'ghost'
              }
              size="sm"
              onClick={() => setActiveTab('donut')}
              className="h-8 gap-1.5 px-3 text-xs font-medium"
              style={{ touchAction: 'manipulation' }}
            >
              <PieChart className="size-3.5" />
              <span>Health Donut</span>
            </Button>

            <Button
              role="tab"
              aria-selected={activeTab === 'matrix'}
              variant={activeTab === 'matrix' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('matrix')}
              className="h-8 gap-1.5 px-3 text-xs font-medium"
              style={{ touchAction: 'manipulation' }}
            >
              <Grid2X2 className="size-3.5" />
              <span>2×2 Strategy</span>
            </Button>

            <Button
              role="tab"
              aria-selected={activeTab === 'demand_supply'}
              variant={activeTab === 'demand_supply' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('demand_supply')}
              className="h-8 gap-1.5 px-3 text-xs font-medium"
              style={{ touchAction: 'manipulation' }}
            >
              <Columns3 className="size-3.5" />
              <span>Demand vs Stock</span>
            </Button>

            <Button
              role="tab"
              aria-selected={activeTab === 'velocity' || activeTab === 'runway'}
              variant={
                activeTab === 'velocity' || activeTab === 'runway' ? 'secondary' : 'ghost'
              }
              size="sm"
              onClick={() => setActiveTab('velocity')}
              className="h-8 gap-1.5 px-3 text-xs font-medium"
              style={{ touchAction: 'manipulation' }}
            >
              <BarChart3 className="size-3.5" />
              <span>Velocity & Runway</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-0">
        {loading ? (
          <div className="space-y-3 pt-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="mb-2 flex size-10 items-center justify-center rounded-lg border border-border bg-muted">
              <TrendingUp className="size-5 text-muted-foreground" />
            </div>
            <h4 className="text-sm font-semibold text-foreground">
              No transaction data yet
            </h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Record sales at the counter to populate interactive demand and stockout
              charts.
            </p>
          </div>
        ) : (
          <>
            {/* VIEW 1: HEALTH DONUT */}
            {(activeTab === 'donut' || activeTab === 'distribution') && (
              <InteractiveDonutChart
                distribution={distribution}
                selectedStatus={selectedStatus}
                onSelectStatus={(status) => onFilterStatus?.(status)}
              />
            )}

            {/* VIEW 2: 2x2 STRATEGY MATRIX */}
            {activeTab === 'matrix' && (
              <VelocityMatrix
                products={products}
                selectedQuadrant={selectedQuadrant}
                onSelectQuadrant={(quadrant) => onSelectQuadrant?.(quadrant)}
              />
            )}

            {/* VIEW 3: DEMAND VS SUPPLY DUAL-COLUMNS */}
            {activeTab === 'demand_supply' && (
              <DemandSupplyChart
                products={products}
                selectedProductId={selectedProductId}
                onSelectProduct={onSelectProduct}
                limit={6}
              />
            )}

            {/* VIEW 4: VELOCITY & RUNWAY METERS */}
            {(activeTab === 'velocity' || activeTab === 'runway') && (
              <div className="space-y-6">
                {/* Top Velocity Bars */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Top products ranked by sales velocity (units/day)</span>
                    <span>Tap to inspect</span>
                  </div>

                  <div className="space-y-2.5">
                    {topVelocityProducts.map((p) => {
                      const isSelected = selectedProductId === p.productId;
                      const barWidth = calculateVelocityBarWidth(
                        p.salesVelocityPerDay,
                        maxVelocity
                      );

                      return (
                        <div
                          key={p.productId}
                          onClick={() => onSelectProduct(isSelected ? null : p.productId)}
                          className={`group cursor-pointer rounded-lg border p-3 transition-colors ${
                            isSelected
                              ? 'bg-primary/5 border-primary'
                              : 'hover:bg-muted/40 border-border bg-card'
                          }`}
                          style={{ touchAction: 'manipulation' }}
                        >
                          <div className="mb-1.5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground">
                                {p.productName}
                              </span>
                              {getStatusBadge(p.stockStatus)}
                            </div>
                            <div className="flex items-center gap-2 text-right">
                              <span className="text-sm font-semibold tabular-nums text-foreground">
                                {p.salesVelocityPerDay}/day
                              </span>
                              <span className="text-xs tabular-nums text-muted-foreground">
                                ({p.unitsSold} sold in {windowDays}d)
                              </span>
                            </div>
                          </div>

                          {/* Progress Bar Container */}
                          <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className={`h-full transition-colors duration-300 ${
                                p.salesVelocityPerDay >= 2.0
                                  ? 'bg-primary'
                                  : p.salesVelocityPerDay > 0
                                    ? 'bg-primary/70'
                                    : 'bg-muted-foreground/30'
                              }`}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>

                          {/* Subtext info */}
                          <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                            <span>Current stock: {p.currentStock} units</span>
                            <span>
                              {p.daysOfStockRemaining !== null
                                ? `${formatRunwayLabel(p.daysOfStockRemaining)}`
                                : 'No depletion risk'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Urgent Stockout Runway Meters */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Critical runway items (≤ 14 days)</span>
                    <span>Reorder advice</span>
                  </div>

                  {atRiskProducts.length === 0 ? (
                    <div className="bg-muted/30 flex flex-col items-center justify-center rounded-lg border border-border p-6 text-center">
                      <Check className="mb-2 size-6 text-primary" />
                      <h4 className="text-sm font-semibold text-foreground">
                        No immediate stockout risks
                      </h4>
                      <p className="mt-1 text-xs text-muted-foreground">
                        All products currently have ample stock runway above 14 days.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {atRiskProducts.map((p) => {
                        const isSelected = selectedProductId === p.productId;
                        const urgency = getRunwayUrgencyLevel(p.daysOfStockRemaining);
                        const maxRunway = 14;
                        const remaining = p.daysOfStockRemaining ?? 0;
                        const barPercentage = Math.min(
                          100,
                          Math.max(5, (remaining / maxRunway) * 100)
                        );

                        return (
                          <div
                            key={p.productId}
                            onClick={() =>
                              onSelectProduct(isSelected ? null : p.productId)
                            }
                            className={`group cursor-pointer rounded-lg border p-3 transition-colors ${
                              isSelected
                                ? 'bg-primary/5 border-primary'
                                : 'hover:bg-muted/40 border-border bg-card'
                            }`}
                            style={{ touchAction: 'manipulation' }}
                          >
                            <div className="mb-1.5 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-foreground">
                                  {p.productName}
                                </span>
                                {urgency === 'out_of_stock' && (
                                  <Badge variant="destructive">Depleted</Badge>
                                )}
                                {urgency === 'critical' && (
                                  <Badge variant="destructive">Critical</Badge>
                                )}
                                {urgency === 'warning' && (
                                  <Badge variant="warning">Low buffer</Badge>
                                )}
                              </div>
                              <span
                                className={`text-sm font-semibold tabular-nums ${
                                  urgency === 'out_of_stock' || urgency === 'critical'
                                    ? 'text-destructive'
                                    : urgency === 'warning'
                                      ? 'text-warning'
                                      : 'text-foreground'
                                }`}
                              >
                                {formatRunwayLabel(p.daysOfStockRemaining)}
                              </span>
                            </div>

                            {/* Runway Progress Track */}
                            <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className={`h-full transition-colors duration-300 ${
                                  urgency === 'out_of_stock' || urgency === 'critical'
                                    ? 'bg-destructive'
                                    : urgency === 'warning'
                                      ? 'bg-warning'
                                      : 'bg-primary'
                                }`}
                                style={{ width: `${barPercentage}%` }}
                              />
                            </div>

                            <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                              <span>In stock: {p.currentStock} units</span>
                              <span className="font-medium text-primary">
                                Reorder: +{p.recommendedReorderQty} units
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* INTERACTIVE INSPECTOR CARD (PINNED PRODUCT) */}
            {selectedProduct && (
              <div className="border-primary/30 bg-primary/5 relative rounded-lg border p-4 transition-colors">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSelectProduct(null)}
                  className="absolute right-2 top-2 size-7 p-0 text-muted-foreground hover:text-foreground"
                  aria-label="Close insight"
                >
                  <X className="size-4" />
                </Button>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-foreground">
                        {selectedProduct.productName}
                      </h4>
                      {getStatusBadge(selectedProduct.stockStatus)}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Price: {formatMoney(selectedProduct.priceCents)} &bull; Revenue:{' '}
                      {formatMoney(selectedProduct.revenueCents)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyInsight(selectedProduct)}
                      className="gap-1.5 text-xs"
                      style={{ touchAction: 'manipulation' }}
                    >
                      {copiedInsight ? (
                        <>
                          <Check className="size-3.5 text-primary" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-3.5" />
                          <span>Copy order info</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* 4 Mini Stat Blocks */}
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-md border border-border bg-card p-2">
                    <div className="text-xs text-muted-foreground">Current stock</div>
                    <div className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                      {selectedProduct.currentStock} units
                    </div>
                  </div>

                  <div className="rounded-md border border-border bg-card p-2">
                    <div className="text-xs text-muted-foreground">
                      Sold ({windowDays}d)
                    </div>
                    <div className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                      {selectedProduct.unitsSold} units
                    </div>
                  </div>

                  <div className="rounded-md border border-border bg-card p-2">
                    <div className="text-xs text-muted-foreground">Daily velocity</div>
                    <div className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                      {selectedProduct.salesVelocityPerDay}/day
                    </div>
                  </div>

                  <div className="rounded-md border border-border bg-card p-2">
                    <div className="text-xs text-muted-foreground">Stock runway</div>
                    <div className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                      {formatRunwayLabel(selectedProduct.daysOfStockRemaining)}
                    </div>
                  </div>
                </div>

                {selectedProduct.recommendedReorderQty > 0 && (
                  <div className="mt-3 flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-xs">
                    <span className="text-muted-foreground">
                      Recommended wholesale reorder:{' '}
                      <strong className="text-primary">
                        +{selectedProduct.recommendedReorderQty} units
                      </strong>
                    </span>
                    <span className="text-muted-foreground">
                      Est. cost:{' '}
                      <strong className="text-foreground">
                        {formatMoney(selectedProduct.estimatedReorderCostCents)}
                      </strong>
                    </span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
