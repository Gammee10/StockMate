'use client';

import * as React from 'react';
import { Banknote, Minus, Plus, Receipt, Smartphone, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Modal, ModalBody, ModalHeader, ModalTitle } from '@/components/ui/modal';
import { cn } from '@/lib/utils';
import type { CartProduct } from '@/types/catalog';
import type { PaymentMethod } from '@/types/sales';

export interface CartReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: Record<string, number>;
  products: CartProduct[];
  totalCents: number;
  totalItemsCount: number;
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  onIncrement: (productId: string) => void;
  onDecrement: (productId: string) => void;
  onRemove: (productId: string) => void;
  onClearCart: () => void;
  onCheckout: () => void;
  isCheckingOut: boolean;
  tenderInput: string;
  onTenderInputChange: (value: string) => void;
}

function formatEtb(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getSmartTenderNotes(totalCents: number): number[] {
  const totalEtb = Math.ceil(totalCents / 100);
  if (totalEtb <= 0) return [500, 1000, 2000];
  const rounded100 = Math.ceil(totalEtb / 100) * 100;
  const set = new Set<number>();
  if (rounded100 > totalEtb) set.add(rounded100);
  for (const bill of [50, 100, 200, 500, 1000, 2000, 5000]) {
    if (bill > totalEtb) set.add(bill);
  }
  const sorted = Array.from(set)
    .sort((a, b) => a - b)
    .slice(0, 3);
  while (sorted.length < 3) {
    sorted.push((sorted[sorted.length - 1] ?? 1000) + 1000);
  }
  return sorted;
}

/**
 * Mobile cart review and checkout sheet modal mirroring the docked desktop ticket rail.
 */
export function CartReviewModal({
  isOpen,
  onClose,
  cart,
  products,
  totalCents,
  totalItemsCount,
  paymentMethod,
  onPaymentMethodChange,
  onIncrement,
  onDecrement,
  onRemove,
  onClearCart,
  onCheckout,
  isCheckingOut,
  tenderInput,
  onTenderInputChange,
}: CartReviewModalProps) {
  const lineItems = React.useMemo(
    () =>
      products
        .filter((p) => (cart[p.id] ?? 0) > 0)
        .map((product) => ({
          product,
          qty: cart[product.id] ?? 0,
          lineCents: product.priceCents * (cart[product.id] ?? 0),
        })),
    [products, cart]
  );

  const parsedTenderEtb = Number(tenderInput);
  const hasCustomTender =
    tenderInput.trim().length > 0 &&
    !Number.isNaN(parsedTenderEtb) &&
    parsedTenderEtb >= 0;
  const tenderedCents = hasCustomTender ? Math.round(parsedTenderEtb * 100) : totalCents;
  const cashDiffCents = tenderedCents - totalCents;
  const smartNotes = React.useMemo(() => getSmartTenderNotes(totalCents), [totalCents]);
  const isCashShort = paymentMethod === 'CASH' && totalCents > 0 && cashDiffCents < 0;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      position="sheet"
      size="md"
      ariaLabelledBy="cart-review-title"
      className="flex flex-col"
    >
      <ModalHeader onClose={onClose}>
        <div className="flex items-center justify-between gap-2 pr-2">
          <div className="flex items-center gap-2">
            <ModalTitle id="cart-review-title">Current sale</ModalTitle>
            <Badge variant="secondary" className="font-mono tabular-nums">
              {totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'}
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={totalItemsCount === 0 || isCheckingOut}
            onClick={onClearCart}
            className="text-destructive hover:border-destructive-border hover:bg-destructive-soft hover:text-destructive"
          >
            <X className="size-3.5" aria-hidden="true" />
            <span>Drop all</span>
          </Button>
        </div>
      </ModalHeader>

      <ModalBody className="flex-1 space-y-2">
        {lineItems.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No items in sale"
            description="Tap products on the counter to start a ticket."
          />
        ) : (
          <div className="divide-y divide-border/70">
            {lineItems.map(({ product, qty, lineCents }) => (
              <div
                key={product.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {product.name}
                  </p>
                  <p className="font-mono text-xs tabular-nums text-muted-foreground">
                    {product.priceEtb} ETB × {qty}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={isCheckingOut}
                    onClick={() => onDecrement(product.id)}
                    aria-label={`Remove one ${product.name}`}
                    className="size-8"
                  >
                    <Minus className="size-3.5" aria-hidden="true" />
                  </Button>
                  <span className="w-6 text-center font-mono text-xs font-semibold tabular-nums text-foreground">
                    {qty}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={isCheckingOut || qty >= product.stock}
                    onClick={() => onIncrement(product.id)}
                    aria-label={`Add one ${product.name}`}
                    className="size-8"
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                  </Button>
                </div>

                <div className="w-24 shrink-0 text-right">
                  <p className="font-mono text-xs font-semibold tabular-nums text-foreground">
                    {formatEtb(lineCents)} ETB
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isCheckingOut}
                    onClick={() => onRemove(product.id)}
                    className="h-6 px-1.5 text-xs text-muted-foreground hover:text-destructive"
                  >
                    Drop
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ModalBody>

      <div className="space-y-3 border-t border-dashed border-border-strong bg-card p-4">
        <div
          role="radiogroup"
          aria-label="Payment method"
          className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted p-1"
        >
          <Button
            variant={paymentMethod === 'CASH' ? 'outline' : 'ghost'}
            role="radio"
            aria-checked={paymentMethod === 'CASH'}
            disabled={isCheckingOut}
            onClick={() => onPaymentMethodChange('CASH')}
            className={cn(
              'h-10 text-xs font-semibold',
              paymentMethod === 'CASH' ? 'border-border-strong bg-card shadow-sm' : ''
            )}
          >
            <Banknote
              className={cn('size-4', paymentMethod === 'CASH' ? 'text-primary' : '')}
              aria-hidden="true"
            />
            <span>Cash</span>
          </Button>
          <Button
            variant={paymentMethod === 'DIGITAL' ? 'outline' : 'ghost'}
            role="radio"
            aria-checked={paymentMethod === 'DIGITAL'}
            disabled={isCheckingOut}
            onClick={() => onPaymentMethodChange('DIGITAL')}
            className={cn(
              'h-10 text-xs font-semibold',
              paymentMethod === 'DIGITAL' ? 'border-border-strong bg-card shadow-sm' : ''
            )}
          >
            <Smartphone
              className={cn('size-4', paymentMethod === 'DIGITAL' ? 'text-primary' : '')}
              aria-hidden="true"
            />
            <span>Digital</span>
          </Button>
        </div>

        {paymentMethod === 'CASH' && totalCents > 0 ? (
          <div className="space-y-2 rounded-lg border border-border bg-background p-3">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="mobile-tender-input"
                className="text-xs font-medium text-muted-foreground"
              >
                Cash received
              </label>
              <div className="flex items-center gap-1.5">
                <Input
                  id="mobile-tender-input"
                  type="number"
                  min="0"
                  step="1"
                  value={tenderInput}
                  onChange={(e) => onTenderInputChange(e.target.value)}
                  placeholder="Exact"
                  className="h-8 w-24 text-right font-mono text-xs tabular-nums"
                />
                <span className="font-mono text-xs text-subtle-foreground">ETB</span>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              <Button
                variant={!hasCustomTender ? 'soft' : 'outline'}
                size="sm"
                onClick={() => onTenderInputChange('')}
                className="text-xs"
              >
                Exact
              </Button>
              {smartNotes.map((bill) => (
                <Button
                  key={bill}
                  variant={
                    hasCustomTender && parsedTenderEtb === bill ? 'soft' : 'outline'
                  }
                  size="sm"
                  onClick={() => onTenderInputChange(String(bill))}
                  className="font-mono text-xs tabular-nums"
                >
                  {bill}
                </Button>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-border pt-2 text-xs">
              <span className="text-muted-foreground">Change due</span>
              <span
                className={cn(
                  'font-mono font-semibold tabular-nums',
                  isCashShort ? 'text-destructive' : 'text-primary'
                )}
              >
                {isCashShort
                  ? `Short ${formatEtb(Math.abs(cashDiffCents))} ETB`
                  : `${formatEtb(cashDiffCents)} ETB`}
              </span>
            </div>
          </div>
        ) : null}

        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium text-muted-foreground">Total due</span>
          <span className="font-mono text-2xl font-semibold tabular-nums text-foreground">
            {formatEtb(totalCents)} ETB
          </span>
        </div>

        <Button
          size="counter"
          loading={isCheckingOut}
          loadingText="Recording sale..."
          disabled={totalItemsCount === 0 || isCashShort}
          onClick={onCheckout}
          className="w-full"
        >
          <span className="tabular-nums">
            {totalItemsCount === 0
              ? 'Select items to charge'
              : `Charge ${formatEtb(totalCents)} ETB`}
          </span>
        </Button>
      </div>
    </Modal>
  );
}
