// src/app/till/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  RotateCcw,
  Receipt,
  AlertTriangle,
  Loader2,
  X,
  Banknote,
  Smartphone,
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
import type { TodaySalesSummary, RecentSaleRecord } from '@/modules/sales/types';

export default function TillPage() {
  const [summary, setSummary] = useState<TodaySalesSummary | null>(null);
  const [recentSales, setRecentSales] = useState<RecentSaleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saleToVoid, setSaleToVoid] = useState<RecentSaleRecord | null>(null);
  const [isVoiding, setIsVoiding] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  const fetchLedger = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sales/today');
      if (!res.ok) {
        throw new Error('Failed to load ledger');
      }
      const json = await res.json();
      setSummary(json.data.summary);
      setRecentSales(json.data.recentSales);
    } catch {
      setError('Failed to load daily ledger. Please retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  const handleConfirmVoid = async () => {
    if (!saleToVoid) return;
    setIsVoiding(true);
    setVoidError(null);

    try {
      const res = await fetch(`/api/sales/${saleToVoid.id}/void`, {
        method: 'POST',
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || 'Failed to void sale');
      }

      setSaleToVoid(null);
      await fetchLedger();
    } catch (err) {
      setVoidError(err instanceof Error ? err.message : 'Error voiding transaction');
    } finally {
      setIsVoiding(false);
    }
  };

  const formatEatTime = (dateInput: Date | string) => {
    try {
      const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Addis_Ababa',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
    } catch {
      return '';
    }
  };

  const getItemsSummary = (sale: RecentSaleRecord) => {
    if (!sale.items || sale.items.length === 0) return '0 items';
    return sale.items
      .map((it) => `${it.quantity}x ${it.product?.name || 'Item'}`)
      .join(', ');
  };

  const getMinutesRemaining = (createdAt: Date | string) => {
    const elapsedMinutes = Math.floor(
      (Date.now() - new Date(createdAt).getTime()) / 60000
    );
    return Math.max(0, 15 - elapsedMinutes);
  };

  return (
    <NavigationShell>
      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        <PageHeader
          title="Daily till & reconciliation"
          description="East Africa Time (EAT) revenue from midnight, cash drawer vs digital balances, and sales history."
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={fetchLedger}
              disabled={loading}
              className="gap-1.5 text-xs"
              style={{ touchAction: 'manipulation' }}
            >
              <RotateCcw className={loading ? 'size-3.5 animate-spin' : 'size-3.5'} />
              <span>Refresh ledger</span>
            </Button>
          }
        />

        {error && (
          <div
            role="alert"
            className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchLedger}
              className="h-7 text-xs text-destructive hover:bg-destructive/20"
            >
              Retry
            </Button>
          </div>
        )}

        {/* Stats Row */}
        <section aria-labelledby="stats-heading">
          <h2 id="stats-heading" className="sr-only">
            Financial summary
          </h2>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1: Cash in Drawer */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <dt className="text-sm font-medium text-muted-foreground">
                  Cash in drawer
                </dt>
                <Banknote className="size-4 text-muted-foreground" />
              </div>
              <dd className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-foreground">
                {loading ? (
                  <Skeleton className="h-8 w-28" />
                ) : (
                  `${((summary?.cashRevenueCents || 0) / 100).toFixed(2)} ETB`
                )}
              </dd>
              <p className="mt-1 text-xs text-muted-foreground">Physical till drawer balance</p>
            </div>

            {/* Card 2: Digital Payments */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <dt className="text-sm font-medium text-muted-foreground">
                  Digital payments
                </dt>
                <Smartphone className="size-4 text-muted-foreground" />
              </div>
              <dd className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-foreground">
                {loading ? (
                  <Skeleton className="h-8 w-28" />
                ) : (
                  `${((summary?.digitalRevenueCents || 0) / 100).toFixed(2)} ETB`
                )}
              </dd>
              <p className="mt-1 text-xs text-muted-foreground">Telebirr & CBE Birr total</p>
            </div>

            {/* Card 3: Total Completed Sales */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <dt className="text-sm font-medium text-muted-foreground">
                  Total completed sales
                </dt>
                <Receipt className="size-4 text-muted-foreground" />
              </div>
              <dd className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-foreground">
                {loading ? (
                  <Skeleton className="h-8 w-28" />
                ) : (
                  `${((summary?.totalRevenueCents || 0) / 100).toFixed(2)} ETB`
                )}
              </dd>
              <p className="mt-1 text-xs text-muted-foreground">
                {summary?.completedCount ?? 0} completed transactions
              </p>
            </div>

            {/* Card 4: Voided Sales */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <dt className="text-sm font-medium text-muted-foreground">
                  Voided transactions
                </dt>
                <RotateCcw className="size-4 text-muted-foreground" />
              </div>
              <dd className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-foreground">
                {loading ? (
                  <Skeleton className="h-8 w-28" />
                ) : (
                  `${((summary?.voidedRevenueCents || 0) / 100).toFixed(2)} ETB`
                )}
              </dd>
              <p className="mt-1 text-xs text-muted-foreground">
                {summary?.voidedCount ?? 0} cancelled sales
              </p>
            </div>
          </dl>
        </section>

        {/* Transactions Table Section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Today&apos;s sales history
              </h2>
              <p className="text-xs text-muted-foreground">
                Transactions within 15 minutes can be voided to reverse ledger and restore stock.
              </p>
            </div>
            <span className="text-xs text-muted-foreground">
              {recentSales.length} records
            </span>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            {loading ? (
              <div className="space-y-3 p-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : recentSales.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <div className="mb-2 flex size-10 items-center justify-center rounded-lg border border-border bg-muted">
                  <Receipt className="size-5 text-muted-foreground" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">
                  No sales recorded today
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  When you complete checkouts at the counter, they will appear here in real time.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="hidden sm:table-cell">Time (EAT)</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead className="hidden sm:table-cell">Method</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="hidden sm:table-cell">Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentSales.map((sale) => {
                    const isVoided = sale.status === 'VOIDED';
                    const canVoid = sale.status === 'COMPLETED' && sale.isVoidable;
                    const minutesLeft = getMinutesRemaining(sale.createdAt);
                    const itemsSummary = getItemsSummary(sale);

                    return (
                      <TableRow key={sale.id}>
                        <TableCell className="hidden sm:table-cell tabular-nums text-muted-foreground">
                          {formatEatTime(sale.createdAt)}
                        </TableCell>
                        <TableCell className="max-w-48 truncate font-medium text-foreground">
                          <div>{itemsSummary}</div>
                          <div className="text-muted-foreground sm:hidden flex items-center gap-1.5 mt-0.5 text-xs">
                            <span>{formatEatTime(sale.createdAt)}</span>
                            <span>&bull;</span>
                            <span>{sale.paymentMethod === 'DIGITAL' ? 'Digital' : 'Cash'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant={sale.paymentMethod === 'DIGITAL' ? 'secondary' : 'outline'}>
                            {sale.paymentMethod === 'DIGITAL' ? 'Digital' : 'Cash'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums text-foreground">
                          {(sale.totalAmountCents / 100).toFixed(2)} ETB
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {isVoided ? (
                            <Badge variant="destructive">Voided</Badge>
                          ) : (
                            <Badge variant="success">Completed</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isVoided ? (
                            <span className="text-muted-foreground">Reversed</span>
                          ) : canVoid ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSaleToVoid(sale)}
                              className="h-7 text-xs text-destructive hover:bg-destructive/10"
                              style={{ touchAction: 'manipulation' }}
                            >
                              Void ({minutesLeft}m)
                            </Button>
                          ) : (
                            <span className="text-muted-foreground" title="Window expired">
                              Locked (&gt;15m)
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </section>

        {/* 15-Minute Void Confirmation Modal */}
        {saleToVoid && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="void-modal-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm animate-in fade-in-0 duration-150"
          >
            <div className="relative flex w-full max-w-md flex-col rounded-xl border border-border bg-card p-6 shadow-sm animate-in zoom-in-95 duration-200">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-5 text-destructive shrink-0" />
                  <h3 id="void-modal-title" className="text-base font-semibold text-foreground">
                    Void sale transaction
                  </h3>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSaleToVoid(null)}
                  className="size-7"
                >
                  <X className="size-4" />
                </Button>
              </div>

              <div className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  Are you sure you want to void this transaction? This will reverse the sale in the daily ledger and atomically restore inventory stock levels.
                </p>

                <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount:</span>
                    <span className="font-semibold tabular-nums text-foreground">
                      {(saleToVoid.totalAmountCents / 100).toFixed(2)} ETB
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment method:</span>
                    <span className="font-medium text-foreground">
                      {saleToVoid.paymentMethod === 'DIGITAL' ? 'Digital (Telebirr/CBE)' : 'Cash (Physical Drawer)'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Items:</span>
                    <span className="font-medium text-foreground truncate max-w-xs">
                      {getItemsSummary(saleToVoid)}
                    </span>
                  </div>
                </div>

                {voidError && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
                    {voidError}
                  </div>
                )}
              </div>

              <div className="mt-5 flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSaleToVoid(null)}
                  disabled={isVoiding}
                  className="flex-1 text-xs"
                >
                  Keep sale
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleConfirmVoid}
                  disabled={isVoiding}
                  className="flex-1 text-xs"
                >
                  {isVoiding ? (
                    <>
                      <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                      <span>Voiding...</span>
                    </>
                  ) : (
                    <span>Confirm void</span>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </NavigationShell>
  );
}
