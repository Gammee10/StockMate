'use client';

import * as React from 'react';
import { ChevronDown, Copy, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import type { CheckoutFeedbackModalState } from '@/types/sales';

export interface ReceiptLineSnapshot {
  name: string;
  qty: number;
  lineCents: number;
}

export interface CheckoutFeedbackModalProps {
  state: CheckoutFeedbackModalState;
  onClose: () => void;
  onRetry?: () => void;
  lineItems?: ReceiptLineSnapshot[];
  tenderedCents?: number | null;
  storeName?: string;
}

function formatEtb(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatEatTime(): string {
  try {
    return (
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Addis_Ababa',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date()) + ' EAT'
    );
  } catch {
    return 'EAT';
  }
}

/**
 * Interactive checkout confirmation / declined dialog featuring the 118px self-drawing
 * SVG checkmark & cross animations, cash change summary, itemized receipt disclosure,
 * and smart pauseable auto-close countdown.
 */
export function CheckoutFeedbackModal({
  state,
  onClose,
  onRetry,
  lineItems = [],
  tenderedCents = null,
  storeName = 'StockMate',
}: CheckoutFeedbackModalProps) {
  const { toast } = useToast();
  const isSuccess = state.type === 'success';
  const durationMs = isSuccess ? 2200 : 3000;

  const [isPinned, setIsPinned] = React.useState(false);
  const [remainingMs, setRemainingMs] = React.useState(durationMs);
  const [itemsExpanded, setItemsExpanded] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [replayNonce, setReplayNonce] = React.useState(0);
  const [timeLabel, setTimeLabel] = React.useState('EAT');

  React.useEffect(() => {
    if (!state.isOpen) return;
    setIsPinned(false);
    setRemainingMs(durationMs);
    setItemsExpanded(false);
    setCopied(false);
    setReplayNonce((prev) => prev + 1);
    setTimeLabel(formatEatTime());
  }, [state.isOpen, state.type, durationMs]);

  React.useEffect(() => {
    if (!state.isOpen || isPinned) return;

    let last = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setRemainingMs((prev) => {
        const next = prev - dt;
        if (next <= 0) {
          onClose();
          return 0;
        }
        return next;
      });
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [state.isOpen, isPinned, onClose]);

  const pinOpen = React.useCallback(() => {
    setIsPinned(true);
  }, []);

  const totalEtbText = state.feedback?.totalEtb ?? '0.00';
  const totalCentsFromItems = lineItems.reduce((sum, item) => sum + item.lineCents, 0);
  const showCashStrip =
    isSuccess &&
    state.feedback?.paymentMethod === 'CASH' &&
    tenderedCents !== null &&
    tenderedCents > totalCentsFromItems;
  const changeCents =
    tenderedCents !== null ? Math.max(0, tenderedCents - totalCentsFromItems) : 0;

  const handleCopyReceipt = async () => {
    pinOpen();
    const lines = lineItems.map(
      (item) => `${item.qty}x ${item.name} - ${formatEtb(item.lineCents)} ETB`
    );
    const text = [
      `${storeName} · ${timeLabel}`,
      ...lines,
      `Total: ${totalEtbText} ETB (${state.feedback?.paymentLabel ?? 'Cash'})`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ message: 'Receipt copied to clipboard', variant: 'success' });
    } catch {
      toast({ message: 'Clipboard unavailable in this browser', variant: 'warning' });
    }
  };

  const progressRatio = Math.max(0, Math.min(1, remainingMs / durationMs));
  const secondsLeft = Math.max(1, Math.ceil(remainingMs / 1000));

  return (
    <Modal
      open={state.isOpen}
      onClose={onClose}
      size="sm"
      ariaLabelledBy="checkout-feedback-title"
      className="max-w-md overflow-y-auto p-6"
    >
      <div
        onPointerDown={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest('[data-no-auto-pin="true"]')) return;
          pinOpen();
        }}
        className="space-y-4"
      >
        {/* Hero Self-Drawing Emblem + Headline */}
        <div className="flex flex-col items-center text-center">
          <div key={replayNonce} className="emblem-stage" aria-hidden="true">
            {isSuccess ? (
              <svg className="emblem-svg text-success" viewBox="0 0 96 96" fill="none">
                <circle
                  className="emblem-fill text-success-soft"
                  cx="48"
                  cy="48"
                  r="42"
                  fill="currentColor"
                />
                <circle
                  className="emblem-ring"
                  cx="48"
                  cy="48"
                  r="42"
                  stroke="currentColor"
                  pathLength={100}
                />
                <path
                  className="emblem-check"
                  d="M27 50.5 L42 65 L69 33"
                  stroke="currentColor"
                  pathLength={100}
                />
              </svg>
            ) : (
              <svg
                className="emblem-svg text-destructive"
                viewBox="0 0 96 96"
                fill="none"
              >
                <circle
                  className="emblem-fill text-destructive-soft"
                  cx="48"
                  cy="48"
                  r="42"
                  fill="currentColor"
                />
                <circle
                  className="emblem-ring"
                  cx="48"
                  cy="48"
                  r="42"
                  stroke="currentColor"
                  pathLength={100}
                />
                <path
                  className="emblem-cross-1"
                  d="M31 31 L65 65"
                  stroke="currentColor"
                  pathLength={100}
                />
                <path
                  className="emblem-cross-2"
                  d="M65 31 L31 65"
                  stroke="currentColor"
                  pathLength={100}
                />
              </svg>
            )}
          </div>

          <Badge variant={isSuccess ? 'success' : 'destructive'} className="mt-2">
            {isSuccess ? 'Receipt confirmed' : 'Checkout declined'}
          </Badge>

          <h2
            id="checkout-feedback-title"
            className="mt-2 text-xl font-semibold tracking-tight text-foreground"
          >
            {isSuccess ? 'Sale recorded' : 'Sale declined'}
          </h2>

          <p className="mt-0.5 text-xs text-muted-foreground">
            {isSuccess
              ? `${state.feedback?.count ?? 0} ${
                  state.feedback?.count === 1 ? 'item' : 'items'
                } sold and store stock updated`
              : 'No charge was recorded and inventory was not modified'}
          </p>

          {isSuccess && state.feedback ? (
            <p className="mt-2 font-mono text-2xl font-semibold tabular-nums tracking-tight text-foreground">
              {state.feedback.totalEtb} ETB
            </p>
          ) : null}
        </div>

        {/* Success Receipt Details */}
        {isSuccess && state.feedback ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3.5 py-2.5 text-xs text-muted-foreground">
              <span>{state.feedback.paymentLabel}</span>
              <span className="font-mono tabular-nums">{timeLabel}</span>
            </div>

            {showCashStrip ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-primary-border bg-primary-soft px-3.5 py-2 text-xs">
                <span className="text-primary">
                  Tendered {formatEtb(tenderedCents)} ETB
                </span>
                <span className="font-mono font-semibold tabular-nums text-primary">
                  Change: {formatEtb(changeCents)} ETB
                </span>
              </div>
            ) : null}

            {lineItems.length > 0 ? (
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  aria-expanded={itemsExpanded}
                  onClick={() => {
                    pinOpen();
                    setItemsExpanded((prev) => !prev);
                  }}
                  className="w-full justify-between"
                >
                  <span>
                    View itemized receipt ({state.feedback.count}{' '}
                    {state.feedback.count === 1 ? 'item' : 'items'})
                  </span>
                  <ChevronDown
                    className={cn(
                      'size-4 text-muted-foreground transition-transform',
                      itemsExpanded ? 'rotate-180' : ''
                    )}
                    aria-hidden="true"
                  />
                </Button>

                {itemsExpanded ? (
                  <div className="max-h-32 space-y-1.5 overflow-y-auto rounded-lg border border-border bg-background px-3 py-2.5 text-xs">
                    {lineItems.map((item, idx) => (
                      <div
                        key={`${item.name}-${idx}`}
                        className="flex items-baseline justify-between gap-3"
                      >
                        <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                          <span className="font-mono tabular-nums">{item.qty}×</span>{' '}
                          {item.name}
                        </span>
                        <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                          {formatEtb(item.lineCents)} ETB
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button variant="outline" onClick={handleCopyReceipt}>
                <Copy className="size-3.5" aria-hidden="true" />
                <span>{copied ? 'Copied' : 'Copy receipt'}</span>
              </Button>
              <Button data-no-auto-pin="true" onClick={onClose}>
                Done · Next sale
              </Button>
            </div>
          </div>
        ) : (
          /* Declined Recovery Details */
          <div className="space-y-3">
            <div
              role="alert"
              className="rounded-lg border border-destructive-border bg-destructive-soft p-3 text-xs font-medium text-destructive"
            >
              {state.errorMessage || 'Checkout failed. Review cart quantities and retry.'}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" data-no-auto-pin="true" onClick={onClose}>
                Edit cart
              </Button>
              <Button
                variant="destructive"
                data-no-auto-pin="true"
                onClick={() => {
                  onClose();
                  onRetry?.();
                }}
              >
                <RotateCcw className="size-3.5" aria-hidden="true" />
                <span>Retry charge</span>
              </Button>
            </div>
          </div>
        )}

        {/* Smart Pauseable Countdown Footer */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between gap-2 text-xs text-subtle-foreground">
            <span>
              {isPinned
                ? 'Pinned open · Press Escape to close'
                : `Auto-closing in ${secondsLeft}s · tap inside to keep open`}
            </span>
            <Button
              variant="ghost"
              size="sm"
              data-no-auto-pin="true"
              onClick={() => {
                if (isPinned) {
                  setRemainingMs(durationMs);
                  setIsPinned(false);
                } else {
                  setIsPinned(true);
                }
              }}
              className="h-6 px-2 text-xs"
            >
              {isPinned ? 'Resume' : 'Keep open'}
            </Button>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full w-full origin-left transition-none',
                isSuccess ? 'bg-success' : 'bg-destructive'
              )}
              style={{ transform: `scaleX(${progressRatio})` }}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
