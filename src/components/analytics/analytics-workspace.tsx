'use client';

import * as React from 'react';
import Link from 'next/link';
import { ClipboardCopy, Package, RefreshCw, Search, TrendingUp, X } from 'lucide-react';
import { NavigationShell } from '@/components/navigation-shell';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import {
  calculateDonutSegments,
  calculateInventoryDistribution,
  calculateVelocityBarWidth,
  classifyProductQuadrant,
  formatRunwayLabel,
  getAtRiskRunwayProducts,
  getTopVelocityProducts,
  groupProductsByQuadrant,
  paginateProducts,
  sortProducts,
} from '@/components/analytics/chart-utils';
import { fetchStockVelocityReport } from '@/lib/api/analytics';
import { cn } from '@/lib/utils';
import type {
  AnalyticsFilterTab,
  ChartViewTab,
  ProductQuadrant,
  ProductSortOption,
  ProductVelocityMetrics,
  StockVelocityRange,
  StockVelocityReport,
  StockVelocityStatus,
} from '@/types/analytics';

export interface AnalyticsWorkspaceProps {
  initialStoreName?: string;
  initialReport: StockVelocityReport | null;
  initialError?: string | null;
}

const RANGE_OPTIONS: Array<{ value: StockVelocityRange; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
];

const CHART_TABS: Array<{ value: ChartViewTab; label: string }> = [
  { value: 'donut', label: 'Stock health' },
  { value: 'matrix', label: 'Quadrants' },
  { value: 'demand_supply', label: 'Runway risk' },
  { value: 'velocity', label: 'Top movers' },
];

function getStatusBadgeProps(status: StockVelocityStatus): {
  label: string;
  variant: 'destructive' | 'warning' | 'success' | 'secondary';
} {
  switch (status) {
    case 'OUT_OF_STOCK':
      return { label: 'Out of stock', variant: 'destructive' };
    case 'CRITICAL_LOW':
      return { label: 'Critical low', variant: 'destructive' };
    case 'LOW_STOCK':
      return { label: 'Low stock', variant: 'warning' };
    case 'HEALTHY':
      return { label: 'Healthy', variant: 'success' };
    case 'DEAD_STOCK':
      return { label: 'Dead stock', variant: 'secondary' };
  }
}

/**
 * Interactive stock-velocity intelligence, runway planning, and wholesale reorder page.
 */
export function AnalyticsWorkspace({
  initialStoreName,
  initialReport,
  initialError = null,
}: AnalyticsWorkspaceProps) {
  const { toast } = useToast();

  const [range, setRange] = React.useState<StockVelocityRange>(
    initialReport?.range ?? '7d'
  );
  const [report, setReport] = React.useState<StockVelocityReport | null>(initialReport);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(initialError);

  const [chartTab, setChartTab] = React.useState<ChartViewTab>('donut');
  const [filterTab, setFilterTab] = React.useState<AnalyticsFilterTab>('all');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedStatus, setSelectedStatus] = React.useState<StockVelocityStatus | null>(
    null
  );
  const [selectedQuadrant, setSelectedQuadrant] = React.useState<ProductQuadrant | null>(
    null
  );
  const [sortBy, setSortBy] = React.useState<ProductSortOption>('velocity_desc');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [selectedProductId, setSelectedProductId] = React.useState<string | null>(null);

  const fetchReportForRange = React.useCallback(async (nextRange: StockVelocityRange) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchStockVelocityReport(nextRange);
      setReport(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load stock velocity report. Please retry.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRangeChange = (nextRange: StockVelocityRange) => {
    setRange(nextRange);
    setCurrentPage(1);
    void fetchReportForRange(nextRange);
  };

  // Reset to page 1 when filters or sorting change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [filterTab, searchQuery, selectedStatus, selectedQuadrant, sortBy]);

  const products = React.useMemo(() => report?.products ?? [], [report]);

  const restockItems = React.useMemo(
    () =>
      products.filter(
        (p) =>
          p.recommendedReorderQty > 0 ||
          p.stockStatus === 'OUT_OF_STOCK' ||
          p.stockStatus === 'CRITICAL_LOW' ||
          p.stockStatus === 'LOW_STOCK'
      ),
    [products]
  );

  const distribution = React.useMemo(
    () => calculateInventoryDistribution(products),
    [products]
  );
  const donutSegments = React.useMemo(
    () => calculateDonutSegments(distribution),
    [distribution]
  );
  const quadrants = React.useMemo(() => groupProductsByQuadrant(products), [products]);
  const topMovers = React.useMemo(() => getTopVelocityProducts(products, 6), [products]);
  const atRiskRunway = React.useMemo(
    () => getAtRiskRunwayProducts(products, 14),
    [products]
  );

  const filteredProducts = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = products.filter((p) => {
      if (q && !p.productName.toLowerCase().includes(q)) return false;
      if (selectedStatus && p.stockStatus !== selectedStatus) return false;
      if (selectedQuadrant && classifyProductQuadrant(p) !== selectedQuadrant)
        return false;
      if (filterTab === 'restock') {
        return (
          p.recommendedReorderQty > 0 ||
          p.stockStatus === 'OUT_OF_STOCK' ||
          p.stockStatus === 'CRITICAL_LOW' ||
          p.stockStatus === 'LOW_STOCK'
        );
      }
      if (filterTab === 'fast') return p.salesVelocityPerDay >= 1.0;
      if (filterTab === 'dead') return p.stockStatus === 'DEAD_STOCK';
      return true;
    });

    return sortProducts(filtered, sortBy);
  }, [products, searchQuery, selectedStatus, selectedQuadrant, filterTab, sortBy]);

  const paginated = React.useMemo(
    () => paginateProducts(filteredProducts, currentPage, 10),
    [filteredProducts, currentPage]
  );

  const selectedProduct = React.useMemo(
    () => products.find((p) => p.productId === selectedProductId) ?? null,
    [products, selectedProductId]
  );

  const hasActiveFilters =
    filterTab !== 'all' ||
    searchQuery.trim().length > 0 ||
    selectedStatus !== null ||
    selectedQuadrant !== null;

  const resetFilters = () => {
    setFilterTab('all');
    setSearchQuery('');
    setSelectedStatus(null);
    setSelectedQuadrant(null);
  };

  const handleCopyReorderList = async () => {
    if (restockItems.length === 0) return;
    const lines = restockItems.map(
      (item) =>
        `- ${item.productName}: order ${item.recommendedReorderQty} units (stock ${item.currentStock}, est. ${item.estimatedReorderCostEtb} ETB)`
    );
    const header = `Wholesale Reorder List (${range} window) · Est. total: ${report?.summary.totalEstimatedRestockCostEtb ?? '0.00'} ETB`;
    try {
      await navigator.clipboard.writeText([header, ...lines].join('\n'));
      toast({
        message: `Copied ${restockItems.length} reorder ${restockItems.length === 1 ? 'item' : 'items'}`,
        variant: 'success',
      });
    } catch {
      toast({ message: 'Clipboard unavailable in this browser', variant: 'warning' });
    }
  };

  const handleCopySingleReorder = async (item: ProductVelocityMetrics) => {
    const text = `${item.productName}: order ${item.recommendedReorderQty} units (on hand ${item.currentStock}, est. ${item.estimatedReorderCostEtb} ETB)`;
    try {
      await navigator.clipboard.writeText(text);
      toast({
        message: `Copied ${item.productName} reorder summary`,
        variant: 'success',
      });
    } catch {
      toast({ message: 'Clipboard unavailable in this browser', variant: 'warning' });
    }
  };

  const maxVelocity = Math.max(0.01, ...topMovers.map((p) => p.salesVelocityPerDay));

  return (
    <NavigationShell storeName={initialStoreName}>
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          title="Analytics"
          description="Stock velocity, days of runway remaining, dead capital, and wholesale reorder planning."
          badge={<Badge variant="outline">{range} window</Badge>}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <div
                role="group"
                aria-label="Observation window"
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted p-1"
              >
                {RANGE_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    variant={range === opt.value ? 'outline' : 'ghost'}
                    size="sm"
                    disabled={loading}
                    onClick={() => handleRangeChange(opt.value)}
                    className={cn(
                      'h-7 px-2.5 text-xs',
                      range === opt.value
                        ? 'border-border-strong bg-card text-foreground shadow-sm'
                        : ''
                    )}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                loading={loading}
                onClick={() => void fetchReportForRange(range)}
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
                <span>Refresh</span>
              </Button>

              <Button
                size="sm"
                disabled={restockItems.length === 0}
                onClick={() => void handleCopyReorderList()}
              >
                <ClipboardCopy className="size-3.5" aria-hidden="true" />
                <span>Copy reorder ({restockItems.length})</span>
              </Button>
            </div>
          }
        />

        {error && !report ? (
          <EmptyState
            variant="error"
            title="Unable to load stock velocity analytics"
            description={error}
            action={
              <Button onClick={() => void fetchReportForRange(range)}>Retry</Button>
            }
          />
        ) : (
          <>
            {error ? (
              <div
                role="alert"
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive-border bg-destructive-soft px-4 py-2.5 text-xs font-medium text-destructive"
              >
                <span>{error}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void fetchReportForRange(range)}
                >
                  Retry
                </Button>
              </div>
            ) : null}

            {/* Summary KPI Strip */}
            <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Card className="p-4">
                <dt className="text-xs font-medium text-muted-foreground">
                  Window revenue
                </dt>
                <dd className="mt-1.5 font-mono text-lg font-semibold tabular-nums text-foreground sm:text-xl">
                  {loading && !report ? (
                    <Skeleton className="h-6 w-28" />
                  ) : (
                    `${report?.summary.totalRevenueEtb ?? '0.00'} ETB`
                  )}
                </dd>
                <dd className="mt-1 font-mono text-xs tabular-nums text-primary">
                  {report?.summary.totalUnitsSold ?? 0} units sold
                </dd>
              </Card>

              <Card className="p-4">
                <dt className="text-xs font-medium text-muted-foreground">
                  Needs restock
                </dt>
                <dd className="mt-1.5 font-mono text-lg font-semibold tabular-nums text-foreground sm:text-xl">
                  {restockItems.length} SKUs
                </dd>
                <dd className="mt-1 font-mono text-xs tabular-nums text-warning">
                  {report?.summary.outOfStockCount ?? 0} out ·{' '}
                  {report?.summary.criticalLowCount ?? 0} critical
                </dd>
              </Card>

              <Card className="p-4">
                <dt className="text-xs font-medium text-muted-foreground">
                  Est. reorder cost
                </dt>
                <dd className="mt-1.5 font-mono text-lg font-semibold tabular-nums text-foreground sm:text-xl">
                  {report?.summary.totalEstimatedRestockCostEtb ?? '0.00'} ETB
                </dd>
                <dd className="mt-1 text-xs text-subtle-foreground">
                  {report?.summary.itemsWithoutCost
                    ? `${report.summary.itemsWithoutCost} estimated from price`
                    : 'Based on wholesale cost'}
                </dd>
              </Card>

              <Card className="p-4">
                <dt className="text-xs font-medium text-muted-foreground">
                  Velocity split
                </dt>
                <dd className="mt-1.5 font-mono text-lg font-semibold tabular-nums text-foreground sm:text-xl">
                  {report?.summary.fastMovingCount ?? 0} fast
                </dd>
                <dd className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
                  {report?.summary.deadStockCount ?? 0} zero-velocity SKUs
                </dd>
              </Card>
            </dl>

            {products.length === 0 ? (
              <EmptyState
                icon={Package}
                title="No active products to analyze"
                description="Add catalog products in Inventory and record counter sales to unlock velocity intelligence."
                action={
                  <Link href="/inventory" className={buttonVariants()}>
                    Go to Inventory
                  </Link>
                }
              />
            ) : (
              <>
                {/* Interactive Visualization Card + Selected SKU Inspector */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <Card className="lg:col-span-2">
                    <CardHeader className="border-b border-border">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <CardTitle>Catalog intelligence</CardTitle>
                          <CardDescription>
                            Click a status segment or quadrant to filter the SKU breakdown
                            below.
                          </CardDescription>
                        </div>

                        <div
                          role="tablist"
                          aria-label="Analytics view"
                          className="grid shrink-0 grid-cols-2 gap-1 rounded-lg border border-border bg-muted p-1 sm:inline-flex sm:flex-nowrap"
                        >
                          {CHART_TABS.map((tab) => (
                            <Button
                              key={tab.value}
                              role="tab"
                              aria-selected={chartTab === tab.value}
                              variant={chartTab === tab.value ? 'outline' : 'ghost'}
                              size="sm"
                              onClick={() => setChartTab(tab.value)}
                              className={cn(
                                'h-7 px-2.5 text-xs',
                                chartTab === tab.value
                                  ? 'border-border-strong bg-card text-foreground shadow-sm'
                                  : ''
                              )}
                            >
                              {tab.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-5">
                      {chartTab === 'donut' ? (
                        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
                          <div className="relative flex size-40 shrink-0 items-center justify-center">
                            <svg
                              viewBox="0 0 140 140"
                              className="size-40 -rotate-90"
                              role="img"
                              aria-label="Stock health distribution chart"
                            >
                              <circle
                                cx="70"
                                cy="70"
                                r="54"
                                fill="none"
                                stroke="rgb(var(--muted))"
                                strokeWidth="16"
                              />
                              {donutSegments.map((seg) =>
                                seg.count > 0 ? (
                                  <circle
                                    key={seg.status}
                                    cx="70"
                                    cy="70"
                                    r="54"
                                    fill="none"
                                    stroke={seg.svgColor}
                                    strokeWidth={
                                      selectedStatus === seg.status ? '20' : '16'
                                    }
                                    strokeDasharray={seg.strokeDasharray}
                                    strokeDashoffset={seg.strokeDashoffset}
                                  />
                                ) : null
                              )}
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                              <span className="font-mono text-2xl font-semibold tabular-nums text-foreground">
                                {distribution.totalCount}
                              </span>
                              <span className="text-xs text-muted-foreground">SKUs</span>
                            </div>
                          </div>

                          <div className="grid w-full flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                            {donutSegments.map((seg) => {
                              const active = selectedStatus === seg.status;
                              return (
                                <Button
                                  key={seg.status}
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedQuadrant(null);
                                    setSelectedStatus(active ? null : seg.status);
                                  }}
                                  className={cn(
                                    'h-auto justify-between px-3 py-2.5 text-left',
                                    active ? 'border-primary bg-primary-soft' : ''
                                  )}
                                >
                                  <span className="flex items-center gap-2">
                                    <span
                                      className={cn(
                                        'size-2.5 shrink-0 rounded-full',
                                        seg.colorClass
                                      )}
                                      aria-hidden="true"
                                    />
                                    <span className="text-xs font-medium text-foreground">
                                      {seg.label}
                                    </span>
                                  </span>
                                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                                    {seg.count} ({seg.percentage}%)
                                  </span>
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      {chartTab === 'matrix' ? (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {(Object.keys(quadrants) as ProductQuadrant[]).map((key) => {
                            const q = quadrants[key];
                            const active = selectedQuadrant === key;
                            return (
                              <Button
                                key={key}
                                variant="outline"
                                onClick={() => {
                                  setSelectedStatus(null);
                                  setSelectedQuadrant(active ? null : key);
                                }}
                                className={cn(
                                  'h-auto flex-col items-stretch justify-between gap-2 whitespace-normal p-3.5 text-left',
                                  active ? 'border-primary bg-primary-soft' : ''
                                )}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-semibold text-foreground">
                                    {q.title}
                                  </span>
                                  <Badge
                                    variant={q.badgeVariant}
                                    className="font-mono tabular-nums"
                                  >
                                    {q.products.length} SKUs
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {q.subtitle}
                                </p>
                                <div className="flex items-center justify-between border-t border-border pt-2 font-mono text-xs tabular-nums text-subtle-foreground">
                                  <span>{q.totalStockUnits} units on hand</span>
                                  <span>
                                    {(q.totalRevenueCents / 100).toFixed(2)} ETB
                                  </span>
                                </div>
                              </Button>
                            );
                          })}
                        </div>
                      ) : null}

                      {chartTab === 'demand_supply' ? (
                        atRiskRunway.length === 0 ? (
                          <EmptyState
                            icon={TrendingUp}
                            title="No at-risk runway items"
                            description="Every active SKU has more than 14 days of projected stock remaining."
                          />
                        ) : (
                          <div className="space-y-3">
                            {atRiskRunway.map((item) => {
                              const targetUnits = Math.max(
                                item.lowStockThreshold,
                                item.currentStock + item.recommendedReorderQty,
                                1
                              );
                              const stockPct = Math.min(
                                100,
                                Math.round((item.currentStock / targetUnits) * 100)
                              );
                              return (
                                <div key={item.productId} className="space-y-1">
                                  <div className="flex items-center justify-between gap-3 text-xs">
                                    <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                                      {item.productName}
                                    </span>
                                    <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                                      {item.currentStock} on hand ·{' '}
                                      {formatRunwayLabel(
                                        item.daysOfStockRemaining,
                                        item.currentStock
                                      )}
                                    </span>
                                  </div>
                                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                                    <div
                                      className={cn(
                                        'h-full rounded-full',
                                        item.currentStock === 0
                                          ? 'bg-destructive'
                                          : item.stockStatus === 'LOW_STOCK' ||
                                              item.stockStatus === 'CRITICAL_LOW'
                                            ? 'bg-warning'
                                            : 'bg-primary'
                                      )}
                                      style={{ width: `${Math.max(4, stockPct)}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )
                      ) : null}

                      {chartTab === 'velocity' ? (
                        topMovers.length === 0 ? (
                          <EmptyState
                            icon={TrendingUp}
                            title="No sales velocity in this window"
                            description="Switch to a wider observation window (7 days or 30 days) to compare product velocity."
                          />
                        ) : (
                          <div className="space-y-3">
                            {topMovers.map((item) => {
                              const pct = calculateVelocityBarWidth(
                                item.salesVelocityPerDay,
                                maxVelocity
                              );
                              return (
                                <div key={item.productId} className="space-y-1">
                                  <div className="flex items-center justify-between gap-3 text-xs">
                                    <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                                      {item.productName}
                                    </span>
                                    <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                                      {item.salesVelocityPerDay}/day · {item.revenueEtb}{' '}
                                      ETB
                                    </span>
                                  </div>
                                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                                    <div
                                      className="h-full rounded-full bg-primary"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )
                      ) : null}
                    </CardContent>
                  </Card>

                  {/* Selected SKU Inspector */}
                  <Card className="h-fit">
                    <CardHeader className="border-b border-border">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle>SKU inspector</CardTitle>
                        {selectedProduct ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedProductId(null)}
                            className="h-7 px-2 text-xs"
                          >
                            Clear
                          </Button>
                        ) : null}
                      </div>
                      <CardDescription>
                        Select any row in the velocity table to inspect runway and reorder
                        cost.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                      {!selectedProduct ? (
                        <EmptyState
                          icon={TrendingUp}
                          title="No SKU selected"
                          description="Click a product name in the table below to inspect its velocity and wholesale order plan."
                        />
                      ) : (
                        <div className="space-y-3 text-xs">
                          <div className="space-y-1">
                            <p className="break-anywhere text-sm font-semibold text-foreground">
                              {selectedProduct.productName}
                            </p>
                            <Badge
                              variant={
                                getStatusBadgeProps(selectedProduct.stockStatus).variant
                              }
                            >
                              {getStatusBadgeProps(selectedProduct.stockStatus).label}
                            </Badge>
                          </div>

                          <dl className="divide-y divide-border rounded-lg border border-border bg-background px-3">
                            <div className="flex justify-between gap-2 py-2">
                              <dt className="text-muted-foreground">Selling price</dt>
                              <dd className="font-mono font-medium tabular-nums text-foreground">
                                {selectedProduct.priceEtb} ETB
                              </dd>
                            </div>
                            <div className="flex justify-between gap-2 py-2">
                              <dt className="text-muted-foreground">Velocity</dt>
                              <dd className="font-mono font-medium tabular-nums text-foreground">
                                {selectedProduct.salesVelocityPerDay} units/day
                              </dd>
                            </div>
                            <div className="flex justify-between gap-2 py-2">
                              <dt className="text-muted-foreground">Runway</dt>
                              <dd className="font-mono font-medium tabular-nums text-foreground">
                                {formatRunwayLabel(
                                  selectedProduct.daysOfStockRemaining,
                                  selectedProduct.currentStock
                                )}
                              </dd>
                            </div>
                            <div className="flex justify-between gap-2 py-2">
                              <dt className="text-muted-foreground">Recommended order</dt>
                              <dd className="font-mono font-semibold tabular-nums text-primary">
                                {selectedProduct.recommendedReorderQty} units
                              </dd>
                            </div>
                            <div className="flex justify-between gap-2 py-2">
                              <dt className="text-muted-foreground">Est. reorder cost</dt>
                              <dd className="font-mono font-medium tabular-nums text-foreground">
                                {selectedProduct.estimatedReorderCostEtb} ETB
                                {selectedProduct.costIsEstimated ? ' (est.)' : ''}
                              </dd>
                            </div>
                          </dl>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleCopySingleReorder(selectedProduct)}
                            className="w-full"
                          >
                            <ClipboardCopy className="size-3.5" aria-hidden="true" />
                            <span>Copy SKU reorder line</span>
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Paginated SKU Velocity Table */}
                <Card>
                  <CardHeader className="border-b border-border">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div
                        className="flex flex-wrap items-center gap-1.5"
                        role="group"
                        aria-label="Velocity filters"
                      >
                        {(
                          [
                            ['all', `All (${products.length})`],
                            ['restock', `Restock (${restockItems.length})`],
                            ['fast', `Fast (${report?.summary.fastMovingCount ?? 0})`],
                            ['dead', `Dead (${report?.summary.deadStockCount ?? 0})`],
                          ] as Array<[AnalyticsFilterTab, string]>
                        ).map(([tabKey, label]) => (
                          <Button
                            key={tabKey}
                            variant={filterTab === tabKey ? 'secondary' : 'outline'}
                            size="sm"
                            onClick={() => setFilterTab(tabKey)}
                            className={cn(
                              filterTab === tabKey
                                ? 'border-foreground bg-foreground text-card hover:bg-foreground/90 hover:text-card'
                                : ''
                            )}
                          >
                            {label}
                          </Button>
                        ))}

                        {hasActiveFilters ? (
                          <Button variant="ghost" size="sm" onClick={resetFilters}>
                            <X className="size-3.5" aria-hidden="true" />
                            <span>Reset</span>
                          </Button>
                        ) : null}
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="relative min-w-0 sm:w-56">
                          <Search
                            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground"
                            aria-hidden="true"
                          />
                          <Input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Filter SKUs..."
                            aria-label="Filter SKUs by name"
                            className="pl-9 pr-8"
                          />
                        </div>

                        <div className="w-full sm:w-52">
                          <Select
                            aria-label="Sort products"
                            value={sortBy}
                            onChange={(e) =>
                              setSortBy(e.target.value as ProductSortOption)
                            }
                          >
                            <option value="velocity_desc">Velocity: high–low</option>
                            <option value="runway_asc">Runway: shortest</option>
                            <option value="stock_asc">Stock: lowest</option>
                            <option value="revenue_desc">Revenue: high–low</option>
                            <option value="name_asc">Name: A–Z</option>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-0">
                    {paginated.items.length === 0 ? (
                      <div className="p-4">
                        <EmptyState
                          icon={Search}
                          title="No matching SKUs"
                          description="No catalog items matched the active analytics filters."
                          action={
                            <Button variant="outline" onClick={resetFilters}>
                              Reset filters
                            </Button>
                          }
                        />
                      </div>
                    ) : (
                      <>
                        <Table className="[&_tr>*:first-child]:pl-4 [&_tr>*:last-child]:pr-4">
                          <TableHeader>
                            <TableRow>
                              <TableHead>Product</TableHead>
                              <TableHead className="hidden text-right sm:table-cell">
                                Sold / Rev
                              </TableHead>
                              <TableHead className="text-right">Stock / Runway</TableHead>
                              <TableHead className="text-right">Reorder</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginated.items.map((item) => {
                              const statusBadge = getStatusBadgeProps(item.stockStatus);
                              const isSelected = selectedProductId === item.productId;

                              return (
                                <TableRow
                                  key={item.productId}
                                  data-state={isSelected ? 'selected' : undefined}
                                >
                                  <TableCell className="min-w-0">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        setSelectedProductId(
                                          isSelected ? null : item.productId
                                        )
                                      }
                                      className="h-auto justify-start whitespace-normal p-0 text-left font-medium text-foreground hover:bg-transparent hover:text-primary"
                                    >
                                      <span className="break-anywhere">
                                        {item.productName}
                                      </span>
                                    </Button>
                                    <p className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground sm:hidden">
                                      {item.unitsSold} sold · {item.revenueEtb} ETB ·{' '}
                                      {item.salesVelocityPerDay}/d
                                    </p>
                                  </TableCell>

                                  <TableCell className="hidden text-right font-mono tabular-nums sm:table-cell">
                                    <p className="font-medium text-foreground">
                                      {item.revenueEtb} ETB
                                    </p>
                                    <p className="text-xs text-subtle-foreground">
                                      {item.unitsSold} sold ({item.salesVelocityPerDay}/d)
                                    </p>
                                  </TableCell>

                                  <TableCell className="text-right font-mono tabular-nums">
                                    <p className="font-medium text-foreground">
                                      {item.currentStock} units
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {formatRunwayLabel(
                                        item.daysOfStockRemaining,
                                        item.currentStock
                                      )}
                                    </p>
                                  </TableCell>

                                  <TableCell className="text-right">
                                    <div className="inline-flex flex-col items-end gap-1">
                                      <Badge variant={statusBadge.variant}>
                                        {statusBadge.label}
                                      </Badge>
                                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                                        {item.recommendedReorderQty > 0
                                          ? `+${item.recommendedReorderQty} (${item.estimatedReorderCostEtb} ETB)`
                                          : 'No order'}
                                      </span>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>

                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground">
                          <span className="font-mono tabular-nums">
                            Page {paginated.currentPage} of {paginated.totalPages} (
                            {paginated.totalItems}{' '}
                            {paginated.totalItems === 1 ? 'SKU' : 'SKUs'})
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={paginated.currentPage <= 1}
                              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            >
                              Previous
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={paginated.currentPage >= paginated.totalPages}
                              onClick={() =>
                                setCurrentPage((p) =>
                                  Math.min(paginated.totalPages, p + 1)
                                )
                              }
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}
      </div>
    </NavigationShell>
  );
}
