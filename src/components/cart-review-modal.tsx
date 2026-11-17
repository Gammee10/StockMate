// src/components/cart-review-modal.tsx
'use client';

import { X, Minus, Plus, Trash2, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface CartProduct {
  id: string;
  name: string;
  priceCents: number;
  priceEtb: string;
  stock: number;
}

interface CartReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: { [productId: string]: number };
  products: CartProduct[];
  onIncrement: (productId: string) => void;
  onDecrement: (productId: string) => void;
  onRemove: (productId: string) => void;
  onClearAll: () => void;
}

export function CartReviewModal({
  isOpen,
  onClose,
  cart,
  products,
  onIncrement,
  onDecrement,
  onRemove,
  onClearAll,
}: CartReviewModalProps) {
  if (!isOpen) return null;

  const productMap = new Map(products.map((p) => [p.id, p]));
  const cartEntries = Object.entries(cart).filter(([, qty]) => qty > 0);

  const totalCents = cartEntries.reduce((sum, [id, qty]) => {
    const product = productMap.get(id);
    return sum + (product ? product.priceCents * qty : 0);
  }, 0);

  const totalItemsCount = cartEntries.reduce((sum, [, qty]) => sum + qty, 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cart-review-title"
      className="bg-background/80 fixed inset-0 z-50 flex items-end justify-center p-0 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <div className="animate-in fade-in-0 slide-in-from-bottom-4 flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-xl border border-border bg-card shadow-sm sm:rounded-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2">
            <ShoppingCart className="size-5 text-primary" />
            <div>
              <h2
                id="cart-review-title"
                className="text-base font-semibold tracking-tight text-foreground"
              >
                Current order ({totalItemsCount}{' '}
                {totalItemsCount === 1 ? 'item' : 'items'})
              </h2>
              <p className="text-xs text-muted-foreground">
                Adjust quantities or remove individual items
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close cart review"
            className="size-8"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Items List */}
        <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
          {cartEntries.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Your cart is currently empty.
            </div>
          ) : (
            cartEntries.map(([id, qty]) => {
              const product = productMap.get(id);
              if (!product) return null;

              const itemTotalEtb = ((product.priceCents * qty) / 100).toFixed(2);

              return (
                <div
                  key={id}
                  className="bg-muted/30 flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <p className="truncate text-sm font-medium text-foreground">
                      {product.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {product.priceEtb} ETB &times; {qty} ={' '}
                      <span className="font-semibold text-foreground">
                        {itemTotalEtb} ETB
                      </span>
                    </p>
                  </div>

                  {/* Quantity Stepper & Remove */}
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => onDecrement(id)}
                      aria-label={`Decrease quantity of ${product.name}`}
                      style={{ touchAction: 'manipulation' }}
                      className="size-8 rounded-lg"
                    >
                      <Minus className="size-3.5" />
                    </Button>

                    <span className="w-8 text-center text-sm font-semibold tabular-nums text-foreground">
                      {qty}
                    </span>

                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => onIncrement(id)}
                      aria-label={`Increase quantity of ${product.name}`}
                      style={{ touchAction: 'manipulation' }}
                      className="size-8 rounded-lg"
                    >
                      <Plus className="size-3.5" />
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemove(id)}
                      aria-label={`Remove ${product.name} from cart`}
                      style={{ touchAction: 'manipulation' }}
                      className="size-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {cartEntries.length > 0 && (
          <div className="space-y-3 border-t border-border bg-card p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Order total:
              </span>
              <span className="text-lg font-semibold tabular-nums text-foreground">
                {(totalCents / 100).toFixed(2)}{' '}
                <span className="text-xs font-normal text-muted-foreground">ETB</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClearAll}
                style={{ touchAction: 'manipulation' }}
                className="hover:bg-destructive/10 text-xs text-destructive"
              >
                Clear all
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={onClose}
                style={{ touchAction: 'manipulation' }}
                className="flex-1 text-xs font-semibold"
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
