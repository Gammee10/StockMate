// src/components/analytics/interactive-charts.tsx
'use client';

import { useState, useMemo } from 'react';
import { BarChart3, Clock, PieChart, X, TrendingUp, Check, Copy } from 'lucide-react';
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
  ProductVelocityMetrics,
  StockVelocityStatus,
} from '@/server/analytics/types';
import {
  calculateVelocityBarWidth,
  calculateInventoryDistribution,
  formatRunwayLabel,
  getTopVelocityProducts,
  getAtRiskRunwayProducts,
  getRunwayUrgencyLevel,
} from './chart-utils';

export type ChartViewTab = 'velocity' | 'runway' | 'distribution';

interface InteractiveChartsProps {
  products: ProductVelocityMetrics[];
  windowDays: number;
  loading?: boolean;
  selectedProductId: string | null;
  onSelectProduct: (productId: string | null) => void;
  onFilterStatus?: (status: StockVelocityStatus) => void;
}

export function InteractiveCharts({
  products,
  windowDays,
  loading = false,
  selectedProductId,
  onSelectProduct,
  onFilterStatus,
}: InteractiveChartsProps) {
  const [activeTab, setActiveTab] = useState<ChartViewTab>('velocity');
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
    const text = `Restock Order: ${product.productName} - Need: +${product.recommendedReorderQty} units (Current stock: ${product.currentStock}, Velocity: ${product.salesVelocityPerDay}/day)`;
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

          {/* Interactive Chart Type Switcher */}
          <div
            role="tablist"
            aria-label="Analytics visual chart types"
            className="bg-muted/50 flex items-center rounded-lg border border-border p-1"
          >
            <Button
              role="tab"
              aria-selected={activeTab === 'velocity'}
              variant={activeTab === 'velocity' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('velocity')}
              className="h-8 gap-1.5 px-3 text-xs font-medium"
              style={{ touchAction: 'manipulation' }}
            >
              <BarChart3 className="size-3.5" />
              <span>Velocity</span>
            </Button>

            <Button
              role="tab"
              aria-selected={activeTab === 'runway'}
              variant={activeTab === 'runway' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('runway')}
              className="h-8 gap-1.5 px-3 text-xs font-medium"
              style={{ touchAction: 'manipulation' }}
            >
              <Clock className="size-3.5" />
              <span>Runway</span>
            </Button>

            <Button
              role="tab"
              aria-selected={activeTab === 'distribution'}
              variant={activeTab === 'distribution' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('distribution')}
              className="h-8 gap-1.5 px-3 text-xs font-medium"
              style={{ touchAction: 'manipulation' }}
            >
              <PieChart className="size-3.5" />
              <span>Distribution</span>
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
            {/* TAB 1: VELOCITY COMPARISON BARS */}
            {activeTab === 'velocity' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Top products ranked by sales velocity (units/day)</span>
                  <span>Tap a bar to inspect details</span>
                </div>

                <div className="space-y-3">
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
                        className={`group relative cursor-pointer rounded-lg border p-3 transition-colors ${
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
            )}

            {/* TAB 2: STOCKOUT RUNWAY PROGRESS METERS */}
            {activeTab === 'runway' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Urgent stockout risks (runway under 14 days)</span>
                  <span>Tap to inspect restock order</span>
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
                  <div className="space-y-3">
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
                              Recommended reorder: +{p.recommendedReorderQty} units
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: INVENTORY COMPOSITION RATIO */}
            {activeTab === 'distribution' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Catalog inventory composition ({distribution.totalCount} products)
                  </span>
                  <span>Tap a category to filter</span>
                </div>

                {/* Segmented Distribution Bar */}
                <div className="flex h-5 w-full overflow-hidden rounded-md border border-border bg-muted">
                  {distribution.outOfStock.percentage > 0 && (
                    <div
                      className="bg-destructive transition-colors"
                      style={{ width: `${distribution.outOfStock.percentage}%` }}
                      title={`Out of stock: ${distribution.outOfStock.count} (${distribution.outOfStock.percentage}%)`}
                    />
                  )}
                  {distribution.criticalLow.percentage > 0 && (
                    <div
                      className="bg-destructive/80 transition-colors"
                      style={{ width: `${distribution.criticalLow.percentage}%` }}
                      title={`Critical low: ${distribution.criticalLow.count} (${distribution.criticalLow.percentage}%)`}
                    />
                  )}
                  {distribution.lowStock.percentage > 0 && (
                    <div
                      className="bg-warning transition-colors"
                      style={{ width: `${distribution.lowStock.percentage}%` }}
                      title={`Low stock: ${distribution.lowStock.count} (${distribution.lowStock.percentage}%)`}
                    />
                  )}
                  {distribution.healthy.percentage > 0 && (
                    <div
                      className="bg-primary transition-colors"
                      style={{ width: `${distribution.healthy.percentage}%` }}
                      title={`Healthy stock: ${distribution.healthy.count} (${distribution.healthy.percentage}%)`}
                    />
                  )}
                  {distribution.deadStock.percentage > 0 && (
                    <div
                      className="bg-muted-foreground/40 transition-colors"
                      style={{ width: `${distribution.deadStock.percentage}%` }}
                      title={`Dead stock: ${distribution.deadStock.count} (${distribution.deadStock.percentage}%)`}
                    />
                  )}
                </div>

                {/* 5 Status Cards Grid */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {/* Out of Stock */}
                  <div
                    onClick={() => onFilterStatus?.('OUT_OF_STOCK')}
                    className="hover:bg-muted/40 flex cursor-pointer flex-col justify-between rounded-lg border border-border bg-card p-3 transition-colors"
                    style={{ touchAction: 'manipulation' }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">
                        Out of stock
                      </span>
                      <div className="size-2 rounded-full bg-destructive" />
                    </div>
                    <div className="mt-2">
                      <div className="text-lg font-semibold tabular-nums text-foreground">
                        {distribution.outOfStock.count}
                      </div>
                      <div className="text-xs tabular-nums text-muted-foreground">
                        {distribution.outOfStock.percentage}% of catalog
                      </div>
                    </div>
                  </div>

                  {/* Critical Low */}
                  <div
                    onClick={() => onFilterStatus?.('CRITICAL_LOW')}
                    className="hover:bg-muted/40 flex cursor-pointer flex-col justify-between rounded-lg border border-border bg-card p-3 transition-colors"
                    style={{ touchAction: 'manipulation' }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">
                        Critical (≤ 2d)
                      </span>
                      <div className="bg-destructive/80 size-2 rounded-full" />
                    </div>
                    <div className="mt-2">
                      <div className="text-lg font-semibold tabular-nums text-foreground">
                        {distribution.criticalLow.count}
                      </div>
                      <div className="text-xs tabular-nums text-muted-foreground">
                        {distribution.criticalLow.percentage}% of catalog
                      </div>
                    </div>
                  </div>

                  {/* Low Stock */}
                  <div
                    onClick={() => onFilterStatus?.('LOW_STOCK')}
                    className="hover:bg-muted/40 flex cursor-pointer flex-col justify-between rounded-lg border border-border bg-card p-3 transition-colors"
                    style={{ touchAction: 'manipulation' }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">
                        Low stock (≤ 5d)
                      </span>
                      <div className="size-2 rounded-full bg-warning" />
                    </div>
                    <div className="mt-2">
                      <div className="text-lg font-semibold tabular-nums text-foreground">
                        {distribution.lowStock.count}
                      </div>
                      <div className="text-xs tabular-nums text-muted-foreground">
                        {distribution.lowStock.percentage}% of catalog
                      </div>
                    </div>
                  </div>

                  {/* Healthy */}
                  <div
                    onClick={() => onFilterStatus?.('HEALTHY')}
                    className="hover:bg-muted/40 flex cursor-pointer flex-col justify-between rounded-lg border border-border bg-card p-3 transition-colors"
                    style={{ touchAction: 'manipulation' }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">Healthy</span>
                      <div className="size-2 rounded-full bg-primary" />
                    </div>
                    <div className="mt-2">
                      <div className="text-lg font-semibold tabular-nums text-foreground">
                        {distribution.healthy.count}
                      </div>
                      <div className="text-xs tabular-nums text-muted-foreground">
                        {distribution.healthy.percentage}% of catalog
                      </div>
                    </div>
                  </div>

                  {/* Dead Stock */}
                  <div
                    onClick={() => onFilterStatus?.('DEAD_STOCK')}
                    className="hover:bg-muted/40 col-span-2 flex cursor-pointer flex-col justify-between rounded-lg border border-border bg-card p-3 transition-colors sm:col-span-1"
                    style={{ touchAction: 'manipulation' }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">
                        Dead stock
                      </span>
                      <div className="bg-muted-foreground/40 size-2 rounded-full" />
                    </div>
                    <div className="mt-2">
                      <div className="text-lg font-semibold tabular-nums text-foreground">
                        {distribution.deadStock.count}
                      </div>
                      <div className="text-xs tabular-nums text-muted-foreground">
                        {distribution.deadStock.percentage}% of catalog
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* INTERACTIVE INSPECTOR CARD (WHEN A PRODUCT IS PINNED/SELECTED) */}
            {selectedProduct && (
              <div className="border-primary/30 bg-primary/5 relative rounded-lg border p-4 transition-colors">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSelectProduct(null)}
                  className="absolute right-2 top-2 h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
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
                      Price: {(selectedProduct.priceCents / 100).toFixed(2)} ETB &bull;
                      Revenue: {(selectedProduct.revenueCents / 100).toFixed(2)} ETB
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
                        {(selectedProduct.estimatedReorderCostCents / 100).toFixed(2)} ETB
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
