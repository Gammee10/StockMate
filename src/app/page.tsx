'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  ShoppingCart,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  LogOut,
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
  storeName: string;
}

export default function CounterPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<{ [productId: string]: number }>({});
  const [, startTransition] = useTransition();

  useEffect(() => {
    fetch('/api/catalog/products')
      .then((res) => res.json())
      .then((data) => {
        if (data.products) {
          setProducts(data.products);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Fetch error:', err);
        setLoading(false);
      });
  }, []);

  const addToCart = (productId: string) => {
    startTransition(() => {
      setCart((prev) => ({
        ...prev,
        [productId]: (prev[productId] || 0) + 1,
      }));
    });
  };

  const clearCart = () => {
    setCart({});
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  const totalCents = Object.entries(cart).reduce((sum, [id, qty]) => {
    const product = products.find((p) => p.id === id);
    return sum + (product ? product.priceCents * qty : 0);
  }, 0);

  const totalItemsCount = Object.values(cart).reduce((sum, q) => sum + q, 0);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-between p-4 pb-28">
      {/* Header */}
      <header className="mb-4 flex items-center justify-between border-b border-border pb-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            StockMate counter
          </h1>
          <p className="text-xs text-muted-foreground">
            {products[0]?.storeName || "Dawit's Kiosk"}
          </p>
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

      {/* Product Grid */}
      <section className="flex-1">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Fast-tap counter items
          </h2>
          <span className="text-xs text-muted-foreground">Tap to add</span>
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
              return (
                <Card
                  key={product.id}
                  onClick={() => addToCart(product.id)}
                  className={cn(
                    'relative flex min-h-28 cursor-pointer flex-col justify-between p-3 transition-colors',
                    inCartQty > 0
                      ? 'bg-primary/5 border-primary ring-1 ring-primary'
                      : 'hover:bg-muted/50'
                  )}
                  style={{ touchAction: 'manipulation' }}
                >
                  <div className="space-y-1">
                    {product.isLowStock && (
                      <Badge variant="warning" className="px-1.5 py-0 text-xs">
                        <AlertTriangle className="mr-1 size-3" />
                        Low: {product.stock}
                      </Badge>
                    )}
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

      {/* Floating Counter Checkout Bar */}
      <footer className="bg-background/80 fixed bottom-0 left-0 right-0 border-t border-border p-4 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="relative">
              <ShoppingCart className="size-5 text-muted-foreground" />
              {totalItemsCount > 0 && (
                <span className="absolute -right-2 -top-2 flex size-4 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {totalItemsCount}
                </span>
              )}
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Cart total</div>
              <div className="text-lg font-semibold tabular-nums text-foreground">
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
                className="size-10"
              >
                <RotateCcw className="size-4" />
              </Button>
            )}
            <Button disabled={totalItemsCount === 0} className="h-10 px-6 font-semibold">
              Checkout ({totalItemsCount})
            </Button>
          </div>
        </div>
      </footer>
    </main>
  );
}
