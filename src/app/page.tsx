'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  ShoppingCart,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  LogOut,
} from 'lucide-react';

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
      <header className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            StockMate Counter
          </h1>
          <p className="text-xs text-slate-400">
            {products[0]?.storeName || "Dawit's Kiosk"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-950/80 px-2.5 py-1 text-xs font-medium text-emerald-400 ring-1 ring-inset ring-emerald-800/60">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Supabase Live</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 transition hover:text-white active:scale-95"
            title="Lock Terminal"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* Product Grid */}
      <section className="flex-1">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Fast-Tap Counter Grid
          </h2>
          <span className="text-xs text-slate-500">Live Database Rows</span>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {products.map((product) => {
              const inCartQty = cart[product.id] || 0;
              return (
                <button
                  key={product.id}
                  onClick={() => addToCart(product.id)}
                  className={`relative flex min-h-[110px] flex-col justify-between rounded-2xl border p-3.5 text-left transition-all active:scale-[0.97] ${
                    inCartQty > 0
                      ? 'border-emerald-500 bg-emerald-950/40 shadow-lg shadow-emerald-950/30 ring-2 ring-emerald-500/50'
                      : 'border-slate-800 bg-slate-900/90 hover:border-slate-700'
                  }`}
                >
                  {/* Low Stock Warning Badge */}
                  {product.isLowStock && (
                    <span className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-amber-950/90 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400 ring-1 ring-amber-700/50">
                      <AlertTriangle className="h-3 w-3" />
                      Low: {product.stock}
                    </span>
                  )}

                  <div>
                    <h3 className="line-clamp-2 text-sm font-bold text-slate-100">
                      {product.name}
                    </h3>
                  </div>

                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-base font-extrabold text-emerald-400">
                      {product.priceEtb}{' '}
                      <span className="text-[10px] font-normal text-slate-400">ETB</span>
                    </span>
                    {inCartQty > 0 && (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-xs font-black text-slate-950">
                        {inCartQty}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Floating Counter Checkout Bar */}
      <footer className="fixed bottom-0 left-0 right-0 border-t border-slate-800 bg-slate-900/95 p-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="relative">
              <ShoppingCart className="h-6 w-6 text-slate-400" />
              {totalItemsCount > 0 && (
                <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-slate-950">
                  {totalItemsCount}
                </span>
              )}
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400">
                Cart Total
              </div>
              <div className="text-xl font-black text-white">
                {(totalCents / 100).toFixed(2)}{' '}
                <span className="text-xs font-normal text-slate-400">ETB</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {totalItemsCount > 0 && (
              <button
                onClick={clearCart}
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 transition-colors active:scale-95"
                title="Reset Cart"
              >
                <RotateCcw className="h-5 w-5" />
              </button>
            )}
            <button
              disabled={totalItemsCount === 0}
              className={`flex h-12 items-center justify-center rounded-xl px-6 text-base font-bold transition-all active:scale-95 ${
                totalItemsCount > 0
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/25 hover:bg-emerald-400'
                  : 'cursor-not-allowed bg-slate-800 text-slate-600'
              }`}
            >
              1-Tap Checkout
            </button>
          </div>
        </div>
      </footer>
    </main>
  );
}
