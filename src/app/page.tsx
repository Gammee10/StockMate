// src/app/page.tsx
'use client';

import { useState, useTransition, useMemo } from 'react';
import {
  ShoppingCart,
  AlertTriangle,
  RotateCcw,
  Minus,
  Plus,
  Loader2,
  Banknote,
  Smartphone,
  Search,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { NavigationShell } from '@/components/navigation-shell';
import { CartReviewModal } from '@/components/cart-review-modal';
import { CheckoutFeedbackModal } from '@/components/checkout-feedback-modal';
import {
  decrementCartQuantity,
  removeCartItem,
  incrementCartQuantity,
  filterProductsByName,
} from '@/modules/sales/counter';
import { useCatalog, useCheckout, useStoreName } from '@/hooks';
import type { Product } from '@/types/catalog';
import type {
  CheckoutFeedbackModalState,
  PaymentMethod,
  SaleReceiptFeedback,
} from '@/types/sales';

export type { Product };

export default function CounterPage() {
  const { products, setProducts, loading } = useCatalog();
  const storeName = useStoreName('Your store');
  const { isCheckingOut, executeCheckout } = useCheckout();
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<{ [productId: string]: number }>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [isCartReviewOpen, setIsCartReviewOpen] = useState(false);
  const [saleSuccess, setSaleSuccess] = useState<SaleReceiptFeedback | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackModal, setFeedbackModal] = useState<CheckoutFeedbackModalState>({
    isOpen: false,
    type: 'success',
    feedback: null,
    errorMessage: null,
  });
  const [, startTransition] = useTransition();

  // Filtered products by search query
  const displayedProducts = useMemo(
    () => filterProductsByName(products, searchQuery),
    [products, searchQuery]
  );

  const addToCart = (productId: string) => {
    // Clear flash feedback on new tap to reset counter
    if (feedbackModal.isOpen) {
      setFeedbackModal((prev) => ({ ...prev, isOpen: false }));
    }
    if (saleSuccess) setSaleSuccess(null);
    if (errorMessage) setErrorMessage(null);

    startTransition(() => {
      setCart((prev) => incrementCartQuantity(prev, productId));
    });
  };

  const decrementCartItem = (e: React.MouseEvent, productId: string) => {
    e.stopPropagation();
    startTransition(() => {
      setCart((prev) => decrementCartQuantity(prev, productId));
    });
  };

  const removeFromCart = (productId: string) => {
    startTransition(() => {
      setCart((prev) => removeCartItem(prev, productId));
    });
  };

  const clearCart = () => {
    setCart({});
    setPaymentMethod('CASH');
    setErrorMessage(null);
    if (feedbackModal.isOpen) {
      setFeedbackModal((prev) => ({ ...prev, isOpen: false }));
    }
  };

  // 1-Tap Checkout Handler (AC 2.1 - AC 2.5, AC 3.1 - AC 3.4)
  const handleCheckout = async () => {
    setErrorMessage(null);

    await executeCheckout({
      cart,
      paymentMethod,
      products,
      onSuccess: (feedback) => {
        setSaleSuccess(feedback);
        setFeedbackModal({
          isOpen: true,
          type: 'success',
          feedback,
          errorMessage: null,
        });

        // Update in-memory stock for responsive inventory display
        setProducts((prev) =>
          prev.map((p) => {
            const bought = cart[p.id] || 0;
            if (bought === 0) return p;
            const nextStock = Math.max(0, p.stock - bought);
            return {
              ...p,
              stock: nextStock,
              isLowStock: nextStock <= p.lowStockThreshold,
            };
          })
        );

        // Reset cart and default back to CASH immediately (< 500ms) (AC 3.2)
        setCart({});
        setPaymentMethod('CASH');
      },
      onError: (displayMsg) => {
        setErrorMessage(displayMsg);
        setFeedbackModal({
          isOpen: true,
          type: 'error',
          feedback: null,
          errorMessage: displayMsg,
        });
      },
    });
  };

  const totalCents = Object.entries(cart).reduce((sum, [id, qty]) => {
    const product = products.find((p) => p.id === id);
    return sum + (product ? product.priceCents * qty : 0);
  }, 0);

  const totalItemsCount = Object.values(cart).reduce((sum, q) => sum + q, 0);

  return (
    <NavigationShell storeName={storeName}>
      <main className="mx-auto flex min-h-[calc(100vh-80px)] max-w-lg flex-col justify-between p-4 pb-56">
        {/* Screen-reader feedback announcement */}
        <div className="sr-only" aria-live="polite">
          {feedbackModal.isOpen &&
            feedbackModal.type === 'success' &&
            feedbackModal.feedback?.summaryText}
          {feedbackModal.isOpen &&
            feedbackModal.type === 'error' &&
            feedbackModal.errorMessage}
        </div>

        {/* Product Grid */}
        <section className="flex-1">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              Fast-tap counter items
            </h2>
            <span className="text-xs text-muted-foreground">Tap tile to add</span>
          </div>

          {/* Search Box (Task 1.2) */}
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search counter items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9 pr-9 text-xs"
              style={{ touchAction: 'manipulation' }}
              aria-label="Search counter items"
            />
            {searchQuery && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSearchQuery('')}
                className="absolute right-1 top-1 size-7 p-0 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </Button>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <Card className="flex flex-col items-center justify-center p-8 text-center">
              <ShoppingCart className="mb-2 size-8 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">
                No active products in catalog
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add products in the Inventory tab to start selling.
              </p>
            </Card>
          ) : displayedProducts.length === 0 ? (
            <Card className="flex flex-col items-center justify-center p-8 text-center">
              <Search className="mb-2 size-8 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">
                No items match &quot;{searchQuery}&quot;
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Check the spelling or try searching for another product.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSearchQuery('')}
                className="mt-3 text-xs"
              >
                Clear search
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {displayedProducts.map((product) => {
                const inCartQty = cart[product.id] || 0;
                const isSelected = inCartQty > 0;

                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addToCart(product.id)}
                    style={{ touchAction: 'manipulation' }}
                    className={cn(
                      'relative flex min-h-28 flex-col justify-between rounded-xl border p-3 text-left transition-colors',
                      isSelected
                        ? 'bg-primary/10 border-primary shadow-sm'
                        : 'hover:border-primary/50 border-border bg-card'
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        {product.isLowStock ? (
                          <Badge variant="warning" className="h-5 px-1.5 text-xs">
                            <AlertTriangle className="mr-1 size-3" />
                            <span>Low: {product.stock}</span>
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Stock: {product.stock}
                          </span>
                        )}
                      </div>
                      <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-foreground">
                        {product.name}
                      </h3>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <div className="text-sm font-semibold tabular-nums text-foreground">
                        {product.priceEtb}{' '}
                        <span className="text-xs text-muted-foreground">ETB</span>
                      </div>

                      {/* Inline Card Stepper when selected */}
                      {isSelected && (
                        <div
                          className="border-primary/30 bg-background/90 flex items-center rounded-lg border p-0.5 shadow-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => decrementCartItem(e, product.id)}
                            aria-label={`Decrease quantity of ${product.name}`}
                            className="size-7 text-foreground hover:bg-muted"
                            style={{ touchAction: 'manipulation' }}
                          >
                            <Minus className="size-3.5" />
                          </Button>
                          <span className="min-w-5 px-1 text-center text-xs font-semibold tabular-nums text-foreground">
                            {inCartQty}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              addToCart(product.id);
                            }}
                            aria-label={`Increase quantity of ${product.name}`}
                            className="size-7 text-foreground hover:bg-muted"
                            style={{ touchAction: 'manipulation' }}
                          >
                            <Plus className="size-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Floating Kiosk Checkout Bar */}
        <footer className="bg-card/95 fixed bottom-0 left-0 right-0 z-40 border-t border-border p-4 backdrop-blur-sm sm:static sm:mt-6 sm:rounded-xl sm:border sm:p-4">
          <div className="mx-auto max-w-lg space-y-3">
            {/* Dual Payment Selector (AC 3.1 & AC 3.2) */}
            <div
              className="grid grid-cols-2 gap-2"
              role="radiogroup"
              aria-label="Payment method"
            >
              <button
                type="button"
                role="radio"
                aria-checked={paymentMethod === 'CASH'}
                onClick={() => setPaymentMethod('CASH')}
                style={{ touchAction: 'manipulation' }}
                className={cn(
                  'flex min-h-14 items-center justify-center gap-2 rounded-xl border p-2 text-sm font-semibold transition-colors',
                  paymentMethod === 'CASH'
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'hover:bg-muted/50 border-border bg-card text-foreground'
                )}
              >
                <Banknote className="size-5 shrink-0" />
                <div className="text-left leading-tight">
                  <div>Cash</div>
                  <div className="text-xs font-normal opacity-85">Physical drawer</div>
                </div>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={paymentMethod === 'DIGITAL'}
                onClick={() => setPaymentMethod('DIGITAL')}
                style={{ touchAction: 'manipulation' }}
                className={cn(
                  'flex min-h-14 items-center justify-center gap-2 rounded-xl border p-2 text-sm font-semibold transition-colors',
                  paymentMethod === 'DIGITAL'
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'hover:bg-muted/50 border-border bg-card text-foreground'
                )}
              >
                <Smartphone className="size-5 shrink-0" />
                <div className="text-left leading-tight">
                  <div>Digital</div>
                  <div className="text-xs font-normal opacity-85">Telebirr / CBE</div>
                </div>
              </button>
            </div>

            {/* Total and Checkout Controls */}
            <div className="flex items-center justify-between gap-3 pt-1">
              {/* Cart review trigger */}
              <button
                type="button"
                onClick={() => setIsCartReviewOpen(true)}
                disabled={totalItemsCount === 0}
                style={{ touchAction: 'manipulation' }}
                className={cn(
                  'flex flex-col text-left transition-opacity',
                  totalItemsCount === 0 ? 'opacity-40' : 'hover:opacity-80'
                )}
              >
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="flex size-4 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {totalItemsCount}
                  </span>
                  <span>Cart total &bull; View items</span>
                </div>
                <div className="text-xl font-semibold tabular-nums text-foreground">
                  {(totalCents / 100).toFixed(2)}{' '}
                  <span className="text-xs text-muted-foreground">ETB</span>
                </div>
              </button>

              <div className="flex items-center gap-2">
                {totalItemsCount > 0 && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={clearCart}
                    aria-label="Clear cart"
                    className="size-11 rounded-xl"
                    style={{ touchAction: 'manipulation' }}
                  >
                    <RotateCcw className="size-5" />
                  </Button>
                )}

                <Button
                  size="kiosk"
                  disabled={totalItemsCount === 0 || isCheckingOut}
                  onClick={handleCheckout}
                  className="min-w-36 font-semibold"
                  style={{ touchAction: 'manipulation' }}
                >
                  {isCheckingOut ? (
                    <>
                      <Loader2 className="mr-2 size-5 animate-spin" />
                      <span>Processing</span>
                    </>
                  ) : (
                    <span>
                      Checkout {paymentMethod === 'DIGITAL' ? '(Digital)' : '(Cash)'}
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </footer>

        {/* Cart Review Drawer / Modal */}
        <CartReviewModal
          isOpen={isCartReviewOpen}
          onClose={() => setIsCartReviewOpen(false)}
          cart={cart}
          products={products}
          onIncrement={addToCart}
          onDecrement={(id) =>
            decrementCartItem({ stopPropagation: () => {} } as React.MouseEvent, id)
          }
          onRemove={removeFromCart}
          onClearAll={clearCart}
        />

        {/* Animated Checkout Feedback Modal */}
        <CheckoutFeedbackModal
          isOpen={feedbackModal.isOpen}
          type={feedbackModal.type}
          feedback={feedbackModal.feedback}
          errorMessage={feedbackModal.errorMessage}
          onClose={() => setFeedbackModal((prev) => ({ ...prev, isOpen: false }))}
        />
      </main>
    </NavigationShell>
  );
}
