// src/components/till-reconciliation-modal.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, RotateCcw, AlertTriangle, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { TodaySalesSummary, RecentSaleRecord } from '@/modules/sales/types';

interface TillReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVoidSuccess?: () => void;
}

export function TillReconciliationModal({
  isOpen,
  onClose,
  onVoidSuccess,
}: TillReconciliationModalProps) {
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
    if (isOpen) {
      fetchLedger();
      setSaleToVoid(null);
      setVoidError(null);
    }
  }, [isOpen, fetchLedger]);

  if (!isOpen) return null;

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
      if (onVoidSuccess) {
        onVoidSuccess();
      }
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="till-modal-title"
      className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
    >
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-xl border border-border bg-card shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4 sm:p-6">
          <div>
            <h2
              id="till-modal-title"
              className="text-xl font-semibold tracking-tight text-foreground"
            >
              Daily till reconciliation
            </h2>
            <p className="text-xs text-muted-foreground">
              East Africa Time (EAT) &bull; Midnight to current instant
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close till reconciliation"
            className="size-8"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Content body */}
        <div className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
          {error && (
            <div
              role="alert"
              className="border-destructive/30 bg-destructive/10 flex items-center justify-between rounded-lg border p-3 text-sm text-destructive"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchLedger}
                className="hover:bg-destructive/20 h-7 px-2 text-xs text-destructive"
              >
                <RotateCcw className="mr-1 size-3" />
                <span>Retry</span>
              </Button>
            </div>
          )}

          {loading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-24 rounded-xl" />
              </div>
              <Skeleton className="h-48 rounded-xl" />
            </div>
          ) : summary ? (
            <>
              {/* Stats Row (Pattern 3) */}
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border bg-card p-4">
                  <dt className="text-xs font-medium text-muted-foreground">
                    Cash in till
                  </dt>
                  <dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                    {(summary.cashRevenueCents / 100).toFixed(2)} ETB
                  </dd>
                  <dd className="mt-1 text-xs text-muted-foreground">
                    Drawer physical balance
                  </dd>
                </div>

                <div className="rounded-xl border border-border bg-card p-4">
                  <dt className="text-xs font-medium text-muted-foreground">
                    Digital wallet
                  </dt>
                  <dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                    {(summary.digitalRevenueCents / 100).toFixed(2)} ETB
                  </dd>
                  <dd className="mt-1 text-xs text-muted-foreground">
                    Telebirr & CBE Birr
                  </dd>
                </div>

                <div className="rounded-xl border border-border bg-card p-4">
                  <dt className="text-xs font-medium text-muted-foreground">
                    Total revenue
                  </dt>
                  <dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                    {(summary.totalRevenueCents / 100).toFixed(2)} ETB
                  </dd>
                  <dd className="mt-1 text-xs text-muted-foreground">
                    {summary.completedCount} sales ({summary.voidedCount} voided)
                  </dd>
                </div>
              </dl>

              {/* Recent Sales Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">
                    Today&apos;s transactions
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {recentSales.length} records
                  </span>
                </div>

                {recentSales.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-8 text-center">
                    <Receipt className="mx-auto size-8 text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      No sales recorded yet today.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border rounded-xl border border-border">
                    {recentSales.map((sale) => (
                      <div
                        key={sale.id}
                        className="flex items-center justify-between p-3 text-sm"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-muted-foreground">
                              #{sale.id.slice(-6)}
                            </span>
                            <Badge
                              variant={
                                sale.paymentMethod === 'CASH' ? 'outline' : 'secondary'
                              }
                            >
                              {sale.paymentMethod}
                            </Badge>
                            <Badge
                              variant={
                                sale.status === 'COMPLETED' ? 'success' : 'destructive'
                              }
                            >
                              {sale.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatEatTime(sale.createdAt)} EAT &bull;{' '}
                            {sale.items?.length || 0} items
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-semibold tabular-nums text-foreground">
                            {(sale.totalAmountCents / 100).toFixed(2)} ETB
                          </span>
                          {sale.status === 'COMPLETED' && sale.isVoidable && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSaleToVoid(sale);
                                setVoidError(null);
                              }}
                              className="hover:bg-destructive/10 h-8 px-2.5 text-xs text-destructive hover:text-destructive"
                            >
                              Void
                            </Button>
                          )}
                          {sale.status === 'COMPLETED' && !sale.isVoidable && (
                            <span className="text-xs text-muted-foreground">Locked</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-border p-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      {/* Confirmation Modal for Void */}
      {saleToVoid && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="void-alert-title"
          className="z-60 bg-background/80 fixed inset-0 flex items-center justify-center p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
            <div>
              <h4
                id="void-alert-title"
                className="text-base font-semibold text-foreground"
              >
                Void transaction #{saleToVoid.id.slice(-6)}?
              </h4>
              <p className="mt-1 text-sm text-muted-foreground">
                {(saleToVoid.totalAmountCents / 100).toFixed(2)} ETB will be removed from
                daily revenue. Product inventory will be atomically restored.
              </p>
            </div>

            {voidError && (
              <div
                role="alert"
                className="border-destructive/30 bg-destructive/10 flex items-center gap-2 rounded-lg border p-2 text-xs text-destructive"
              >
                <AlertTriangle className="size-3.5 shrink-0" />
                <span>{voidError}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                variant="outline"
                size="kiosk"
                disabled={isVoiding}
                onClick={() => setSaleToVoid(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="kiosk"
                disabled={isVoiding}
                onClick={handleConfirmVoid}
              >
                {isVoiding ? <Loader2 className="size-5 animate-spin" /> : 'Confirm void'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
