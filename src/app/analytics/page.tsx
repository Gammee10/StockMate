// src/app/analytics/page.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  RotateCcw,
  TrendingUp,
  AlertTriangle,
  Package,
  Copy,
  Check,
  FileText,
  DollarSign,
  ShoppingCart,
} from 'lucide-react';
import { NavigationShell } from '@/components/navigation-shell';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { InteractiveCharts } from '@/components/analytics/interactive-charts';
import type {
  StockVelocityReport,
  StockVelocityRange,
  ProductVelocityMetrics,
} from '@/server/analytics/types';

export default function AnalyticsPage() {
  const [range, setRange] = useState<StockVelocityRange>('7d');
  const [report, setReport] = useState<StockVelocityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<'all' | 'restock' | 'fast' | 'dead'>('all');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics/stock-velocity?range=${range}`);
      if (!res.ok) {
        throw new Error('Failed to load stock velocity report');
      }
      const json = await res.json();
      setReport(json.data);
    } catch {
      setError('Failed to load velocity report. Please retry.');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Restock items
  const restockItems = useMemo(() => {
    if (!report) return [];
    return report.products.filter(
      (p) =>
        p.recommendedReorderQty > 0 ||
        p.stockStatus === 'OUT_OF_STOCK' ||
        p.stockStatus === 'CRITICAL_LOW' ||
        p.stockStatus === 'LOW_STOCK'
    );
  }, [report]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    if (!report) return [];
    switch (filterTab) {
      case 'restock':
        return restockItems;
      case 'fast':
        return report.products.filter((p) => p.salesVelocityPerDay >= 1.0);
      case 'dead':
        return report.products.filter((p) => p.stockStatus === 'DEAD_STOCK');
      default:
        return report.products;
    }
  }, [report, filterTab, restockItems]);

  // Copy Restock Order list to clipboard for SMS / Telegram to wholesaler
  const handleCopyRestockList = async () => {
    if (restockItems.length === 0) return;

    const lines = [
      `StockMate Restock Order (${range === '30d' ? '30-Day Velocity' : '7-Day Velocity'}):`,
      ...restockItems.map(
        (item, idx) =>
          `${idx + 1}. ${item.productName}: Order ${item.recommendedReorderQty} units (Current stock: ${item.currentStock})`
      ),
      '',
      `Total Estimated Wholesale Value: ${report?.summary.totalEstimatedRestockCostEtb} ETB`,
    ];

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const getStatusBadge = (status: ProductVelocityMetrics['stockStatus']) => {
    switch (status) {
      case 'OUT_OF_STOCK':
        return <Badge variant="destructive">Out of stock</Badge>;
      case 'CRITICAL_LOW':
        return <Badge variant="destructive">Critical (&le; 2d)</Badge>;
      case 'LOW_STOCK':
        return <Badge variant="warning">Low stock</Badge>;
      case 'DEAD_STOCK':
        return <Badge variant="secondary">Dead stock (0 sales)</Badge>;
      case 'HEALTHY':
        return <Badge variant="success">Healthy stock</Badge>;
    }
  };

  return (
    <NavigationShell>
      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        <PageHeader
          title="Stock & sales velocity analytics"
          description="Identify high-demand products, detect dead capital, and calculate exact wholesale restock quantities."
          actions={
            <div className="flex items-center gap-2">
              {/* Time Range Selector */}
              <div className="bg-muted/50 flex items-center rounded-lg border border-border p-0.5">
                <Button
                  variant={range === 'today' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setRange('today')}
                  className="h-7 px-2.5 text-xs font-medium"
                >
                  Today
                </Button>
                <Button
                  variant={range === '7d' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setRange('7d')}
                  className="h-7 px-2.5 text-xs font-medium"
                >
                  7 days
                </Button>
                <Button
                  variant={range === '30d' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setRange('30d')}
                  className="h-7 px-2.5 text-xs font-medium"
                >
                  30 days
                </Button>
              </div>

              {/* Refresh Action */}
              <Button
                variant="outline"
                size="sm"
                onClick={fetchReport}
                disabled={loading}
                className="gap-1.5 text-xs"
                style={{ touchAction: 'manipulation' }}
              >
                <RotateCcw className={loading ? 'size-3.5 animate-spin' : 'size-3.5'} />
                <span>Refresh</span>
              </Button>
            </div>
          }
        />

        {error && (
          <div
            role="alert"
            className="border-destructive/30 bg-destructive/10 flex items-center justify-between rounded-lg border p-4 text-sm text-destructive"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchReport}
              className="hover:bg-destructive/20 h-7 text-xs text-destructive"
            >
              Retry
            </Button>
          </div>
        )}

        {/* Stats Row */}
        <section aria-labelledby="analytics-stats-heading">
          <h2 id="analytics-stats-heading" className="sr-only">
            Performance summary
          </h2>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1: Fast-Moving Items */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <dt className="text-sm font-medium text-muted-foreground">
                  Fast-moving items
                </dt>
                <TrendingUp className="size-4 text-muted-foreground" />
              </div>
              <dd className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                {loading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  `${report?.summary.fastMovingCount ?? 0} items`
                )}
              </dd>
              <p className="mt-1 text-xs text-muted-foreground">
                Selling &ge; 1 unit per day
              </p>
            </div>

            {/* Card 2: Restock Urgent */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <dt className="text-sm font-medium text-muted-foreground">
                  Restock alerts
                </dt>
                <AlertTriangle className="size-4 text-muted-foreground" />
              </div>
              <dd className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                {loading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  `${(report?.summary.outOfStockCount ?? 0) + (report?.summary.criticalLowCount ?? 0) + (report?.summary.lowStockCount ?? 0)} items`
                )}
              </dd>
              <p className="mt-1 text-xs text-muted-foreground">
                Running out or under threshold
              </p>
            </div>

            {/* Card 3: Dead Stock */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <dt className="text-sm font-medium text-muted-foreground">Dead stock</dt>
                <Package className="size-4 text-muted-foreground" />
              </div>
              <dd className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                {loading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  `${report?.summary.deadStockCount ?? 0} items`
                )}
              </dd>
              <p className="mt-1 text-xs text-muted-foreground">
                Zero sales in observation window
              </p>
            </div>

            {/* Card 4: Total Revenue */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <dt className="text-sm font-medium text-muted-foreground">
                  Window revenue
                </dt>
                <DollarSign className="size-4 text-muted-foreground" />
              </div>
              <dd className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  `${report?.summary.totalRevenueEtb ?? '0.00'} ETB`
                )}
              </dd>
              <p className="mt-1 text-xs text-muted-foreground">
                {report?.summary.totalUnitsSold ?? 0} total units sold
              </p>
            </div>
          </dl>
        </section>

        {/* Interactive Visualization Charts */}
        <section aria-label="Interactive visual intelligence">
          <InteractiveCharts
            products={report?.products ?? []}
            windowDays={report?.windowDays ?? 7}
            loading={loading}
            selectedProductId={selectedProductId}
            onSelectProduct={setSelectedProductId}
            onFilterStatus={(status) => {
              if (
                status === 'OUT_OF_STOCK' ||
                status === 'CRITICAL_LOW' ||
                status === 'LOW_STOCK'
              ) {
                setFilterTab('restock');
              } else if (status === 'DEAD_STOCK') {
                setFilterTab('dead');
              } else {
                setFilterTab('all');
              }
            }}
          />
        </section>

        {/* Wholesale Restock Order Builder Card */}
        {report && restockItems.length > 0 && (
          <section className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-foreground" />
                  <h2 className="text-base font-semibold text-foreground">
                    Wholesale Restock Order Sheet
                  </h2>
                </div>
                <p className="text-xs text-muted-foreground">
                  Recommended order quantities to maintain 7-day sales buffer based on
                  velocity.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Est. Wholesale Cost</div>
                  <div className="text-sm font-semibold tabular-nums text-foreground">
                    {report.summary.totalEstimatedRestockCostEtb} ETB
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={handleCopyRestockList}
                  className="gap-1.5 text-xs font-semibold"
                  style={{ touchAction: 'manipulation' }}
                >
                  {copied ? (
                    <>
                      <Check className="size-3.5 text-success" />
                      <span>Copied order list</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      <span>Copy restock list</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {restockItems.slice(0, 6).map((item) => (
                <div
                  key={item.productId}
                  className="bg-muted/30 space-y-1 rounded-lg border border-border p-3 text-xs"
                >
                  <div className="flex items-center justify-between font-medium text-foreground">
                    <span className="truncate">{item.productName}</span>
                    <span className="font-semibold text-primary">
                      +{item.recommendedReorderQty} units
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Current: {item.currentStock} units</span>
                    <span>{item.estimatedReorderCostEtb} ETB</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Filter Tabs & Velocity Breakdown Table */}
        <section className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Product sales velocity breakdown
              </h2>
              <p className="text-xs text-muted-foreground">
                Sell-through velocity, runway estimation, and stock status categorization.
              </p>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant={filterTab === 'all' ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setFilterTab('all')}
                className="h-8 text-xs font-medium"
              >
                All ({report?.products.length ?? 0})
              </Button>
              <Button
                variant={filterTab === 'restock' ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setFilterTab('restock')}
                className="h-8 text-xs font-medium"
              >
                Needs restock ({restockItems.length})
              </Button>
              <Button
                variant={filterTab === 'fast' ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setFilterTab('fast')}
                className="h-8 text-xs font-medium"
              >
                Fast moving ({report?.summary.fastMovingCount ?? 0})
              </Button>
              <Button
                variant={filterTab === 'dead' ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setFilterTab('dead')}
                className="h-8 text-xs font-medium"
              >
                Dead stock ({report?.summary.deadStockCount ?? 0})
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            {loading ? (
              <div className="space-y-3 p-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <div className="mb-2 flex size-10 items-center justify-center rounded-lg border border-border bg-muted">
                  <ShoppingCart className="size-5 text-muted-foreground" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">
                  No products in this category
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  As transactions are recorded at the counter, velocity metrics will
                  populate here.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">
                      Current stock
                    </TableHead>
                    <TableHead className="hidden text-right sm:table-cell">
                      Units sold
                    </TableHead>
                    <TableHead className="hidden text-right sm:table-cell">
                      Velocity
                    </TableHead>
                    <TableHead className="hidden text-right sm:table-cell">
                      Runway
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Recommended order</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((p) => (
                    <TableRow
                      key={p.productId}
                      className={
                        p.productId === selectedProductId ? 'bg-primary/5' : undefined
                      }
                    >
                      {/* Product Name (Main Cell) */}
                      <TableCell className="font-medium text-foreground">
                        <div>{p.productName}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground sm:hidden">
                          <span className="font-medium text-foreground">
                            {p.salesVelocityPerDay}/day
                          </span>
                          <span>&bull;</span>
                          <span>Stock: {p.currentStock}</span>
                          <span>&bull;</span>
                          <span>
                            {p.daysOfStockRemaining !== null
                              ? `${p.daysOfStockRemaining}d runway`
                              : 'No runway'}
                          </span>
                        </div>
                      </TableCell>

                      {/* Stock Level (Desktop) */}
                      <TableCell className="hidden text-right tabular-nums text-foreground sm:table-cell">
                        {p.currentStock}
                      </TableCell>

                      {/* Units Sold (Desktop) */}
                      <TableCell className="hidden text-right tabular-nums text-foreground sm:table-cell">
                        {p.unitsSold}
                      </TableCell>

                      {/* Sales Velocity (Desktop) */}
                      <TableCell className="hidden text-right font-semibold tabular-nums text-foreground sm:table-cell">
                        {p.salesVelocityPerDay}/day
                      </TableCell>

                      {/* Stock Runway (Desktop) */}
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">
                        {p.daysOfStockRemaining !== null ? (
                          <span
                            className={
                              p.daysOfStockRemaining <= 2
                                ? 'font-semibold text-destructive'
                                : p.daysOfStockRemaining <= 5
                                  ? 'font-medium text-warning'
                                  : 'text-foreground'
                            }
                          >
                            {p.daysOfStockRemaining} days
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>

                      {/* Stock Status Badge */}
                      <TableCell>{getStatusBadge(p.stockStatus)}</TableCell>

                      {/* Recommended Order */}
                      <TableCell className="text-right font-semibold tabular-nums text-foreground">
                        {p.recommendedReorderQty > 0 ? (
                          <span className="text-primary">
                            +{p.recommendedReorderQty} units
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </section>
      </main>
    </NavigationShell>
  );
}
