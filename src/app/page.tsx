'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  ShoppingCart,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  LogOut,
  Minus,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  priceCents: number;
  priceEtb: string;
  stock: number;
  lowStockThreshold: number;
  isLowStock: boolean;
  storeName?: string;
}

interface SaleSuccessFeedback {
  totalEtb: string;
  count: number;
}

export default function CounterPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [storeName, setStoreName] = useState<string>("Dawit's Kiosk");
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<{ [productId: string]: number }>({});
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [saleSuccess, setSaleSuccess] = useState<SaleSuccessFeedback | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Load active catalog and store metadata
  useEffect(() => {
    fetch('/api/catalog/products')
      .then((res) => res.json())
      .then((data) => {
        if (data.products) {
          setProducts(data.products);
          if (data.products[0]?.storeName) {
            setStoreName(data.products[0].storeName);
          }
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Fetch error:', err);
        setLoading(false);
      });
  }, []);

  const addToCart = (productId: string) => {
    // Clear flash feedback on new tap to reset counter
    if (saleSuccess) setSaleSuccess(null);
    if (errorMessage) setErrorMessage(null);

    startTransition(() => {
      setCart((prev) => ({
        ...prev,
        [productId]: (prev[productId] || 0) + 1,
      }));
    });
  };

  const decrementCartItem = (e: React.MouseEvent, productId: string) => {
    e.stopPropagation();
    startTransition(() => {
      setCart((prev) => {
        const currentQty = prev[productId] || 0;
        if (currentQty <= 1) {
          const next = { ...prev };
          delete next[productId];
          return next;
        }
        return {
          ...prev,
          [productId]: currentQty - 1,
        };
      });
    });
  };

  const clearCart = () => {
    setCart({});
    setErrorMessage(null);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  // 1-Tap Checkout Handler (AC 2.1 - AC 2.5)
  const handleCheckout = async () => {
    const items = Object.entries(cart).map(([productId, quantity]) => ({
      productId,
      quantity,
    }));

    if (items.length === 0 || isCheckingOut) return;

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
        body: JSON.stringify({
          items,
          paymentMethod: 'CASH',
        }),
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const msg =
          errorData.error?.message ||
          (response.status === 409
            ? 'Insufficient stock for one or more items.'
            : 'Checkout failed. Please try again.');
        setErrorMessage(msg);
        setIsCheckingOut(false);
        return;
      }

      const data = await response.json();
      const sale = data.data;

      // AC 2.5: Immediate visual confirmation, clear cart, ready in < 500ms
      const totalEtb = (sale.totalAmountCents / 100).toFixed(2);
      const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);

      setSaleSuccess({
        totalEtb,
        count: totalCount,
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

      // Reset cart immediately (< 500ms)
      setCart({});
      setIsCheckingOut(false);
    } catch (err) {
      console.error('Checkout network error:', err);
      setErrorMessage('Network connection error. Please retry.');
      setIsCheckingOut(false);
    }
  };

  const totalCents = Object.entries(cart).reduce((sum, [id, qty]) => {
    const product = products.find((p) => p.id === id);
    return sum + (product ? product.priceCents * qty : 0);
  }, 0);

  const totalItemsCount = Object.values(cart).reduce((sum, q) => sum + q, 0);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-between p-4 pb-36">
      {/* Header */}
      <header className="mb-4 flex items-center justify-between border-b border-border pb-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            StockMate counter
          </h1>
          <p className="text-xs text-muted-foreground">{storeName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success">
            <CheckCircle2 className="mr-1 size-3" />
            <span>Online</span>
          </Badge>
          <Button
            variant="outline"
            size="icon"
            onClick={handleLogout}
            aria-label="Sign out"
            className="size-8"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>

      {/* Instant Feedback Banners (AC 2.5) */}
      <div className="mb-3 space-y-2">
        {saleSuccess && (
          <div
            role="status"
            aria-live="polite"
            className="border-success/30 bg-success/15 flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium text-success"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>
                Sale recorded: {saleSuccess.totalEtb} ETB ({saleSuccess.count}{' '}
                {saleSuccess.count === 1 ? 'item' : 'items'})
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSaleSuccess(null)}
              className="hover:bg-success/20 h-6 px-2 text-xs text-success hover:text-success"
            >
              Dismiss
            </Button>
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="border-destructive/30 bg-destructive/15 flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium text-destructive"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setErrorMessage(null)}
              className="hover:bg-destructive/20 h-6 px-2 text-xs text-destructive hover:text-destructive"
            >
              Dismiss
            </Button>
          </div>
        )}
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
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-xl border border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No products available in catalog.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {products.map((product) => {
              const inCartQty = cart[product.id] || 0;
              const isOutOfStock = product.stock <= 0;

              return (
                <Card
                  key={product.id}
                  onClick={() => !isOutOfStock && addToCart(product.id)}
                  className={cn(
                    'relative flex min-h-28 select-none flex-col justify-between p-3 transition-colors',
                    isOutOfStock
                      ? 'bg-muted/20 cursor-not-allowed opacity-50'
                      : 'hover:bg-muted/50 cursor-pointer active:scale-[0.98]',
                    inCartQty > 0 && 'bg-primary/5 border-primary ring-1 ring-primary'
                  )}
                  style={{ touchAction: 'manipulation' }}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      {isOutOfStock ? (
                        <Badge variant="destructive" className="px-1.5 py-0 text-xs">
                          Out of stock
                        </Badge>
                      ) : product.isLowStock ? (
                        <Badge variant="warning" className="px-1.5 py-0 text-xs">
                          <AlertTriangle className="mr-1 size-3" />
                          Low: {product.stock}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Stock: {product.stock}
                        </span>
                      )}

                      {inCartQty > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={(e) => decrementCartItem(e, product.id)}
                          aria-label={`Remove one ${product.name}`}
                          className="hover:bg-destructive/20 size-6 rounded-full hover:text-destructive"
                          style={{ touchAction: 'manipulation' }}
                        >
                          <Minus className="size-3.5" />
                        </Button>
                      )}
                    </div>

                    <h3 className="line-clamp-2 text-sm font-medium text-foreground">
                      {product.name}
                    </h3>
                  </div>

                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-base font-semibold tabular-nums text-foreground">
                      {product.priceEtb}{' '}
                      <span className="text-xs font-normal text-muted-foreground">
                        ETB
                      </span>
                    </span>

                    {inCartQty > 0 && (
                      <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                        {inCartQty}
                      </span>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Floating Counter Checkout Bar (Touch targets >= 64 dp) */}
      <footer className="bg-background/95 fixed bottom-0 left-0 right-0 border-t border-border p-4 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <ShoppingCart className="size-6 text-muted-foreground" />
              {totalItemsCount > 0 && (
                <span className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {totalItemsCount}
                </span>
              )}
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Cart total</div>
              <div className="text-xl font-semibold tabular-nums text-foreground">
                {(totalCents / 100).toFixed(2)}{' '}
                <span className="text-xs font-normal text-muted-foreground">ETB</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {totalItemsCount > 0 && (
              <Button
                variant="outline"
                size="icon"
                onClick={clearCart}
                aria-label="Reset cart"
                className="size-16 shrink-0 rounded-xl"
                style={{ touchAction: 'manipulation' }}
                disabled={isCheckingOut}
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
                <span>Checkout ({totalItemsCount})</span>
              )}
            </Button>
          </div>
        </div>
      </footer>
    </main>
  );
}
