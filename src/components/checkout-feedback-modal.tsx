// src/components/checkout-feedback-modal.tsx
'use client';

import { useEffect } from 'react';
import { X, Receipt, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SaleReceiptFeedback } from '@/modules/sales/counter';

interface CheckoutFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'success' | 'error';
  feedback?: SaleReceiptFeedback | null;
  errorMessage?: string | null;
}

export function CheckoutFeedbackModal({
  isOpen,
  onClose,
  type,
  feedback,
  errorMessage,
}: CheckoutFeedbackModalProps) {
  // Auto-dismiss: 2.2s for success, 3.0s for error so kiosk cashiers are never held back
  useEffect(() => {
    if (!isOpen) return;

    const timeoutMs = type === 'success' ? 2200 : 3000;
    const timer = setTimeout(() => {
      onClose();
    }, timeoutMs);

    return () => clearTimeout(timer);
  }, [isOpen, type, onClose]);

  if (!isOpen) return null;

  const isSuccess = type === 'success';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-modal-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in-0 duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex w-full max-w-sm flex-col items-center justify-center rounded-xl border border-border bg-card p-6 text-center shadow-sm animate-in zoom-in-95 duration-200"
      >
        {/* Top Close Button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close popup"
          style={{ touchAction: 'manipulation' }}
          className="absolute right-3 top-3 size-8 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </Button>

        {/* Animated Icon Section */}
        {isSuccess ? (
          <div className="mb-3 flex size-20 items-center justify-center rounded-full border-4 border-success/30 bg-success/10 animate-in zoom-in-75 duration-300">
            <svg
              className="size-10 text-success"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        ) : (
          <div className="mb-3 flex size-20 items-center justify-center rounded-full border-4 border-destructive/30 bg-destructive/10 animate-in zoom-in-75 duration-300">
            <svg
              className="size-10 text-destructive"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
        )}

        {/* Modal Text Content */}
        <h2
          id="feedback-modal-title"
          className={
            isSuccess
              ? 'text-xl font-semibold text-foreground'
              : 'text-xl font-semibold text-destructive'
          }
        >
          {isSuccess ? 'Sale recorded!' : 'Checkout failed'}
        </h2>

        {isSuccess && feedback ? (
          <div className="mt-2 space-y-2">
            <p className="text-2xl font-semibold tabular-nums text-foreground">
              {feedback.totalEtb}{' '}
              <span className="text-xs font-normal text-muted-foreground">ETB</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {feedback.paymentLabel} &bull; {feedback.count}{' '}
              {feedback.count === 1 ? 'item' : 'items'}
            </p>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Receipt className="size-3 text-primary" />
              <span>Saved to daily till</span>
            </div>
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            <div className="flex items-center justify-center gap-1.5 text-sm font-medium text-destructive">
              <AlertTriangle className="size-4 shrink-0" />
              <span>{errorMessage || 'Insufficient stock for one or more items.'}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Please adjust product quantities in the cart or restock.
            </p>
          </div>
        )}

        {/* Action Button */}
        <div className="mt-5 w-full">
          <Button
            type="button"
            variant={isSuccess ? 'default' : 'outline'}
            onClick={onClose}
            style={{ touchAction: 'manipulation' }}
            className="w-full text-sm font-semibold"
          >
            {isSuccess ? 'Done' : 'Got it'}
          </Button>
        </div>
      </div>
    </div>
  );
}
