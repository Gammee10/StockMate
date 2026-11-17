// src/app/page.tsx
'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  ShoppingCart,
  AlertTriangle,
  RotateCcw,
  Minus,
  Plus,
  Loader2,
  Banknote,
  Smartphone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { NavigationShell } from '@/components/navigation-shell';
import { CartReviewModal } from '@/components/cart-review-modal';
import { CheckoutFeedbackModal } from '@/components/checkout-feedback-modal';
import {
  buildCheckoutPayload,
  formatSaleReceiptFeedback,
  decrementCartQuantity,
  removeCartItem,
  incrementCartQuantity,
  type PaymentMethod,
  type SaleReceiptFeedback,
} from '@/modules/sales/counter';

export interface Product {
  id: string;
  name: string;
  priceCents: number;
  priceEtb: string;
  stock: number;
  lowStockThreshold: number;
  isLowStock: boolean;
  storeName?: string;
}

export default function CounterPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [storeName, setStoreName] = useState<string>("Dawit's Kiosk");
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<{ [productId: string]: number }>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isCartReviewOpen, setIsCartReviewOpen] = useState(false);
  const [saleSuccess, setSaleSuccess] = useState<SaleReceiptFeedback | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackModal, setFeedbackModal] = useState<{
    isOpen: boolean;
    type: 'success' | 'error';
    feedback?: SaleReceiptFeedback | null;
    errorMessage?: string | null;
  }>({
    isOpen: false,
    type: 'success',
    feedback: null,
    errorMessage: null,
  });
  const [, startTransition] = useTransition();

  const refetchProducts = () => {
    fetch('/api/catalog/products')
      .then((res) => res.json())
      .then((data) => {
        if (data.products) {
          setProducts(data.products);
          if (data.products[0]?.storeName) {
            setStoreName(data.products[0].storeName);
          }
        }
      })
      .catch((err) => {
        console.error('Fetch error:', err);
      });
  };

  // Load active catalog and store metadata
  useEffect(() => {
    refetchProducts();
    setLoading(false);
  }, []);

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
    const payload = buildCheckoutPayload(cart, paymentMethod);

    if (payload.items.length === 0 || isCheckingOut) return;

    setIsCheckingOut(true);
    setErrorMessage(null);

    // Invariant #4: Generate client-side UUID for Idempotency-Key
    const idempotencyKey = crypto.randomUUID();

    try {
      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const rawMsg =
          errorData.error?.message ||
          (response.status === 409
            ? 'Insufficient stock for one or more items.'
            : 'Checkout failed. Please try again.');

        // Client-side fallback to ensure any "Insufficient stock for product id <id>" is converted to product name if present
        let displayMsg = rawMsg;
        const idMatch = rawMsg.match(
          /Insufficient stock for product id ([a-zA-Z0-9_-]+)/
        );
        if (idMatch && idMatch[1]) {
          const matchedProd = products.find((p) => p.id === idMatch[1]);
          if (matchedProd) {
            displayMsg = `Insufficient stock for "${matchedProd.name}".`;
          }
        }

        setErrorMessage(displayMsg);
        setFeedbackModal({
          isOpen: true,
          type: 'error',
          feedback: null,
          errorMessage: displayMsg,
        });
        setIsCheckingOut(false);
        return;
      }

      const data = await response.json();
      const sale = data.data;

      // AC 2.5 & AC 3.4: Immediate visual confirmation with payment method
      const totalEtb = (sale.totalAmountCents / 100).toFixed(2);
      const totalCount = payload.items.reduce(
        (sum, item) => sum + item.quantity,
        0
      );

      const feedback = formatSaleReceiptFeedback({
        totalEtb,
        count: totalCount,
        paymentMethod: sale.paymentMethod || paymentMethod,
      });

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
      setIsCheckingOut(false);
    } catch (err) {
      console.error('Checkout network error:', err);
      const networkMsg = 'Network connection error. Please retry.';
      setErrorMessage(networkMsg);
      setFeedbackModal({
        isOpen: true,
        type: 'error',
        feedback: null,
        errorMessage: networkMsg,
      });
      setIsCheckingOut(false);
    }
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
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {products.map((product) => {
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
                        ? 'border-primary bg-primary/10 shadow-sm'
                        : 'border-border bg-card hover:border-primary/50'
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
                          className="flex items-center rounded-lg border border-primary/30 bg-background/90 p-0.5 shadow-sm"
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
        <footer className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 p-4 backdrop-blur-sm sm:static sm:mt-6 sm:rounded-xl sm:border sm:p-4">
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
                    : 'border-border bg-card text-foreground hover:bg-muted/50'
                )}
              >
                <Banknote className="size-5 shrink-0" />
                <div className="text-left leading-tight">
                  <div>Cash</div>
                  <div className="text-xs font-normal opacity-85">
                    Physical drawer
                  </div>
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
                    : 'border-border bg-card text-foreground hover:bg-muted/50'
                )}
              >
                <Smartphone className="size-5 shrink-0" />
                <div className="text-left leading-tight">
                  <div>Digital</div>
                  <div className="text-xs font-normal opacity-85">
                    Telebirr / CBE
                  </div>
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
            decrementCartItem(
              { stopPropagation: () => {} } as React.MouseEvent,
              id
            )
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
          onClose={() =>
            setFeedbackModal((prev) => ({ ...prev, isOpen: false }))
          }
        />
      </main>
    </NavigationShell>
  );
}
