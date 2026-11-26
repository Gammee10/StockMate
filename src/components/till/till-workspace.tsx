'use client';

import * as React from 'react';
import Link from 'next/link';
import { Calculator, RefreshCw, RotateCcw, ShoppingCart } from 'lucide-react';
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
import {
  Modal,
  ModalBody,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { fetchTodayLedger, voidSaleById } from '@/lib/api/sales';
import { toCents } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { RecentSaleRecord, TodaySalesSummary } from '@/types/sales';

export interface TillWorkspaceProps {
  initialStoreName?: string;
  initialSummary: TodaySalesSummary | null;
  initialRecentSales: RecentSaleRecord[];
  initialError?: string | null;
}

function formatEtb(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatEatTime(createdAt: Date | string): string {
  try {
    const date = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
    return (
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Addis_Ababa',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(date) + ' EAT'
    );
  } catch {
    return 'EAT';
  }
}

function getRemainingVoidMinutes(createdAt: Date | string, nowMs: number): number {
  const createdMs =
    typeof createdAt === 'string' ? new Date(createdAt).getTime() : createdAt.getTime();
  const elapsedMinutes = Math.floor((nowMs - createdMs) / 60000);
  return Math.max(0, 15 - elapsedMinutes);
}

function formatItemsSummary(sale: RecentSaleRecord): string {
  if (!sale.items || sale.items.length === 0) return 'No line items';
  return sale.items
    .map((item) => `${item.quantity}× ${item.product?.name ?? 'Product'}`)
    .join(', ');
}

/**
 * Interactive Daily Till reconciliation view displaying today's EAT revenue breakdown,
 * cash drawer count variance helper, and 15-minute sale voiding.
 */
export function TillWorkspace({
  initialStoreName,
  initialSummary,
  initialRecentSales,
  initialError = null,
}: TillWorkspaceProps) {
  const { toast } = useToast();

  const [summary, setSummary] = React.useState<TodaySalesSummary | null>(initialSummary);
  const [recentSales, setRecentSales] =
    React.useState<RecentSaleRecord[]>(initialRecentSales);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(initialError);

  const [saleToVoid, setSaleToVoid] = React.useState<RecentSaleRecord | null>(null);
  const [isVoiding, setIsVoiding] = React.useState(false);
  const [voidError, setVoidError] = React.useState<string | null>(null);

  const [openingFloatInput, setOpeningFloatInput] = React.useState('');
  const [countedCashInput, setCountedCashInput] = React.useState('');
  const [nowMs, setNowMs] = React.useState(() => Date.now());

  React.useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const fetchLedger = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTodayLedger();
      setSummary(data.summary);
      setRecentSales(data.recentSales);
      setNowMs(Date.now());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load daily till ledger. Please retry.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const handleConfirmVoid = async () => {
    if (!saleToVoid || isVoiding) return;
    setIsVoiding(true);
    setVoidError(null);

    try {
      await voidSaleById(saleToVoid.id);
      const voidedTotal = formatEtb(saleToVoid.totalAmountCents);
      setSaleToVoid(null);
      await fetchLedger();
      toast({
        message: `Voided ${voidedTotal} ETB sale and restored stock`,
        variant: 'warning',
      });
    } catch (err) {
      setVoidError(
        err instanceof Error ? err.message : 'Unable to void transaction. Please retry.'
      );
    } finally {
      setIsVoiding(false);
    }
  };

  const cashSalesCents = summary?.cashRevenueCents ?? 0;
  const floatCents = openingFloatInput.trim() ? (toCents(openingFloatInput) ?? 0) : 0;
  const expectedDrawerCents = cashSalesCents + floatCents;
  const parsedCountedCents = countedCashInput.trim() ? toCents(countedCashInput) : null;
  const drawerVarianceCents =
    parsedCountedCents !== null ? parsedCountedCents - expectedDrawerCents : null;

  return (
    <NavigationShell storeName={initialStoreName}>
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          title="Daily till"
          description="Today's EAT shift revenue summary, cash drawer check, and 15-minute sale voiding."
          badge={<Badge variant="outline">EAT (UTC+3)</Badge>}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                loading={loading}
                onClick={() => void fetchLedger()}
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
                <span>Refresh</span>
              </Button>
              <Link href="/counter" className={buttonVariants({ size: 'sm' })}>
                <ShoppingCart className="size-3.5" aria-hidden="true" />
                <span>Counter</span>
              </Link>
            </div>
          }
        />

        {error && !summary ? (
          <EmptyState
            variant="error"
            title="Unable to load daily till"
            description={error}
            action={<Button onClick={() => void fetchLedger()}>Retry</Button>}
          />
        ) : (
          <>
            {error ? (
              <div
                role="alert"
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive-border bg-destructive-soft px-4 py-2.5 text-xs font-medium text-destructive"
              >
                <span>{error}</span>
                <Button variant="outline" size="sm" onClick={() => void fetchLedger()}>
                  Retry
                </Button>
              </div>
            ) : null}

            {/* 4-Metric EAT Shift Summary */}
            <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Card className="p-4">
                <dt className="text-xs font-medium text-muted-foreground">Gross sales</dt>
                <dd className="mt-1.5 font-mono text-lg font-semibold tabular-nums text-foreground sm:text-xl">
                  {loading && !summary ? (
                    <Skeleton className="h-6 w-28" />
                  ) : (
                    `${formatEtb(summary?.totalRevenueCents ?? 0)} ETB`
                  )}
                </dd>
                <dd className="mt-1 font-mono text-xs tabular-nums text-primary">
                  {summary?.completedCount ?? 0}{' '}
                  {(summary?.completedCount ?? 0) === 1
                    ? 'completed sale'
                    : 'completed sales'}
                </dd>
              </Card>

              <Card className="p-4">
                <dt className="text-xs font-medium text-muted-foreground">Cash sales</dt>
                <dd className="mt-1.5 font-mono text-lg font-semibold tabular-nums text-foreground sm:text-xl">
                  {loading && !summary ? (
                    <Skeleton className="h-6 w-28" />
                  ) : (
                    `${formatEtb(summary?.cashRevenueCents ?? 0)} ETB`
                  )}
                </dd>
                <dd className="mt-1 text-xs text-subtle-foreground">
                  Cash drawer receipts
                </dd>
              </Card>

              <Card className="p-4">
                <dt className="text-xs font-medium text-muted-foreground">
                  Digital sales
                </dt>
                <dd className="mt-1.5 font-mono text-lg font-semibold tabular-nums text-foreground sm:text-xl">
                  {loading && !summary ? (
                    <Skeleton className="h-6 w-28" />
                  ) : (
                    `${formatEtb(summary?.digitalRevenueCents ?? 0)} ETB`
                  )}
                </dd>
                <dd className="mt-1 text-xs text-subtle-foreground">Telebirr and bank</dd>
              </Card>

              <Card className="p-4">
                <dt className="text-xs font-medium text-muted-foreground">
                  Voided today
                </dt>
                <dd className="mt-1.5 font-mono text-lg font-semibold tabular-nums text-foreground sm:text-xl">
                  {loading && !summary ? (
                    <Skeleton className="h-6 w-28" />
                  ) : (
                    `${formatEtb(summary?.voidedRevenueCents ?? 0)} ETB`
                  )}
                </dd>
                <dd className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
                  {summary?.voidedCount ?? 0}{' '}
                  {(summary?.voidedCount ?? 0) === 1 ? 'voided ticket' : 'voided tickets'}
                </dd>
              </Card>
            </dl>

            {/* Drawer Count Helper + Recent Transactions */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="h-fit">
                <CardHeader>
                  <CardTitle>Drawer count check</CardTitle>
                  <CardDescription>
                    Compare physical cash in drawer against today&apos;s cash sales.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="till-float-input"
                      className="block text-xs font-medium text-muted-foreground"
                    >
                      Opening float (ETB, optional)
                    </label>
                    <Input
                      id="till-float-input"
                      type="number"
                      min="0"
                      step="1"
                      value={openingFloatInput}
                      onChange={(e) => setOpeningFloatInput(e.target.value)}
                      placeholder="0.00"
                      className="font-mono tabular-nums"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="till-counted-input"
                      className="block text-xs font-medium text-muted-foreground"
                    >
                      Counted cash in drawer (ETB)
                    </label>
                    <Input
                      id="till-counted-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={countedCashInput}
                      onChange={(e) => setCountedCashInput(e.target.value)}
                      placeholder="Enter counted total"
                      className="font-mono tabular-nums"
                    />
                  </div>

                  <div className="space-y-2 rounded-lg border border-border bg-background p-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Expected cash</span>
                      <span className="font-mono font-semibold tabular-nums text-foreground">
                        {formatEtb(expectedDrawerCents)} ETB
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
                      <span className="text-muted-foreground">Variance</span>
                      {drawerVarianceCents === null ? (
                        <span className="font-mono text-subtle-foreground">
                          Enter count
                        </span>
                      ) : drawerVarianceCents === 0 ? (
                        <span className="font-mono font-semibold tabular-nums text-success">
                          Balanced (0.00 ETB)
                        </span>
                      ) : drawerVarianceCents > 0 ? (
                        <span className="font-mono font-semibold tabular-nums text-warning">
                          +{formatEtb(drawerVarianceCents)} ETB over
                        </span>
                      ) : (
                        <span className="font-mono font-semibold tabular-nums text-destructive">
                          -{formatEtb(Math.abs(drawerVarianceCents))} ETB short
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="min-w-0 lg:col-span-2">
                <CardHeader className="border-b border-border">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle>Recent transactions</CardTitle>
                      <CardDescription>
                        Completed sales are voidable within 15 minutes to restore stock.
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="font-mono tabular-nums">
                      {recentSales.length} {recentSales.length === 1 ? 'sale' : 'sales'}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  {loading && recentSales.length === 0 ? (
                    <div className="divide-y divide-border p-4">
                      {Array.from({ length: 4 }).map((_, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-4 py-3"
                        >
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-40" />
                            <Skeleton className="h-3 w-56" />
                          </div>
                          <Skeleton className="h-8 w-20" />
                        </div>
                      ))}
                    </div>
                  ) : recentSales.length === 0 ? (
                    <div className="p-4">
                      <EmptyState
                        icon={Calculator}
                        title="No sales recorded yet today"
                        description="Completed counter checkouts appear here for daily reconciliation and 15-minute voids."
                        action={
                          <Link href="/counter" className={buttonVariants()}>
                            Go to Counter
                          </Link>
                        }
                      />
                    </div>
                  ) : (
                    <div className="divide-y divide-border/70">
                      {recentSales.map((sale) => {
                        const isVoided = sale.status === 'VOIDED';
                        const remainingMins = getRemainingVoidMinutes(
                          sale.createdAt,
                          nowMs
                        );
                        const canVoid = !isVoided && sale.isVoidable && remainingMins > 0;
                        const itemsText = formatItemsSummary(sale);

                        return (
                          <div
                            key={sale.id}
                            className={cn(
                              'flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between',
                              isVoided ? 'bg-background/60 opacity-65' : ''
                            )}
                          >
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-xs font-medium tabular-nums text-foreground">
                                  {formatEatTime(sale.createdAt)}
                                </span>
                                <Badge
                                  variant={
                                    sale.paymentMethod === 'DIGITAL'
                                      ? 'outline'
                                      : 'secondary'
                                  }
                                >
                                  {sale.paymentMethod === 'DIGITAL' ? 'Digital' : 'Cash'}
                                </Badge>
                                {isVoided ? (
                                  <Badge variant="destructive">Voided</Badge>
                                ) : canVoid ? (
                                  <Badge
                                    variant="warning"
                                    className="font-mono tabular-nums"
                                  >
                                    {remainingMins}m left to void
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-subtle-foreground">
                                    Locked (&gt;15m)
                                  </span>
                                )}
                              </div>
                              <p className="break-anywhere text-xs text-muted-foreground">
                                {itemsText}
                              </p>
                            </div>

                            <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                              <span
                                className={cn(
                                  'font-mono text-sm font-semibold tabular-nums',
                                  isVoided
                                    ? 'text-muted-foreground line-through'
                                    : 'text-foreground'
                                )}
                              >
                                {formatEtb(sale.totalAmountCents)} ETB
                              </span>

                              {canVoid ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setVoidError(null);
                                    setSaleToVoid(sale);
                                  }}
                                  className="text-destructive hover:border-destructive-border hover:bg-destructive-soft hover:text-destructive"
                                >
                                  <RotateCcw className="size-3.5" aria-hidden="true" />
                                  <span>Void</span>
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>

      {/* 15-Minute Void Confirmation Dialog */}
      <Modal
        open={Boolean(saleToVoid)}
        onClose={() => {
          if (!isVoiding) {
            setSaleToVoid(null);
            setVoidError(null);
          }
        }}
        size="sm"
        ariaLabelledBy="void-dialog-title"
      >
        <ModalHeader
          onClose={
            isVoiding
              ? undefined
              : () => {
                  setSaleToVoid(null);
                  setVoidError(null);
                }
          }
        >
          <ModalTitle id="void-dialog-title">Void sale?</ModalTitle>
          <ModalDescription>
            This reverses today&apos;s revenue and atomically restores sold units back to
            inventory.
          </ModalDescription>
        </ModalHeader>

        {saleToVoid ? (
          <ModalBody className="space-y-3">
            <div className="space-y-1.5 rounded-lg border border-border bg-background p-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono tabular-nums text-muted-foreground">
                  {formatEatTime(saleToVoid.createdAt)}
                </span>
                <span className="font-mono font-semibold tabular-nums text-foreground">
                  {formatEtb(saleToVoid.totalAmountCents)} ETB
                </span>
              </div>
              <p className="break-anywhere text-muted-foreground">
                {formatItemsSummary(saleToVoid)}
              </p>
            </div>

            {voidError ? (
              <p
                role="alert"
                className="break-words rounded-md border border-destructive-border bg-destructive-soft px-3 py-2 text-xs font-medium text-destructive"
              >
                {voidError}
              </p>
            ) : null}
          </ModalBody>
        ) : null}

        <ModalFooter>
          <Button
            variant="outline"
            disabled={isVoiding}
            onClick={() => {
              setSaleToVoid(null);
              setVoidError(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            loading={isVoiding}
            loadingText="Voiding sale..."
            onClick={() => void handleConfirmVoid()}
          >
            Void sale
          </Button>
        </ModalFooter>
      </Modal>
    </NavigationShell>
  );
}
