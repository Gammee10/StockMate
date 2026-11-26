'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Banknote,
  Minus,
  Package,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  ShoppingBag,
  Smartphone,
  X,
} from 'lucide-react';
import { CartReviewModal } from '@/components/cart-review-modal';
import {
  CheckoutFeedbackModal,
  type ReceiptLineSnapshot,
} from '@/components/checkout-feedback-modal';
import { NavigationShell } from '@/components/navigation-shell';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { useCheckout } from '@/hooks/use-checkout';
import { fetchAllProducts } from '@/lib/api/catalog';
import {
  decrementCartQuantity,
  filterProductsByName,
  incrementCartQuantity,
  removeCartItem,
} from '@/modules/sales/counter';
import { cn } from '@/lib/utils';
import type { Product } from '@/types/catalog';
import type { CheckoutFeedbackModalState, PaymentMethod } from '@/types/sales';

type QuickFilter = 'all' | 'incart' | 'low';

export interface CounterWorkspaceProps {
  initialProducts: Product[];
  initialStoreName?: string;
  initialSalesCount: number;
  initialError?: string | null;
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
 * Primary POS counter workspace wired to catalog and idempotent checkout endpoints.
 */
export function CounterWorkspace({
  initialProducts,
  initialStoreName,
  initialSalesCount,
  initialError = null,
}: CounterWorkspaceProps) {
  const { toast } = useToast();
  const { isCheckingOut, executeCheckout } = useCheckout();
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const ignoreNextSlashRef = React.useRef(false);

  const [products, setProducts] = React.useState<Product[]>(initialProducts);
  const [loading, setLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(initialError);
  const [salesCount, setSalesCount] = React.useState(initialSalesCount);

  const [searchQuery, setSearchQuery] = React.useState('');
  const [quickFilter, setQuickFilter] = React.useState<QuickFilter>('all');
  const [cart, setCart] = React.useState<Record<string, number>>({});
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>('CASH');
  const [tenderInput, setTenderInput] = React.useState('');

  const [isCartReviewOpen, setIsCartReviewOpen] = React.useState(false);
  const [lastReceiptLines, setLastReceiptLines] = React.useState<ReceiptLineSnapshot[]>(
    []
  );
  const [lastTenderedCents, setLastTenderedCents] = React.useState<number | null>(null);
  const [feedbackModal, setFeedbackModal] = React.useState<CheckoutFeedbackModalState>({
    isOpen: false,
    type: 'success',
    feedback: null,
    errorMessage: null,
  });

  const refreshCatalog = React.useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const fresh = await fetchAllProducts();
      setProducts(fresh);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Unable to load store catalog. Check connection and retry.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const productById = React.useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of products) map.set(p.id, p);
    return map;
  }, [products]);

  const displayedProducts = React.useMemo(() => {
    const searched = filterProductsByName(products, searchQuery);
    if (quickFilter === 'incart') {
      return searched.filter((p) => (cart[p.id] ?? 0) > 0);
    }
    if (quickFilter === 'low') {
      return searched.filter((p) => p.stock <= p.lowStockThreshold);
    }
    return searched;
  }, [products, searchQuery, quickFilter, cart]);

  const { totalCents, totalItemsCount, cartLines } = React.useMemo(() => {
    let cents = 0;
    let count = 0;
    const lines: Array<{ product: Product; qty: number; lineCents: number }> = [];

    for (const p of products) {
      const qty = cart[p.id] ?? 0;
      if (qty > 0) {
        const lineCents = p.priceCents * qty;
        cents += lineCents;
        count += qty;
        lines.push({ product: p, qty, lineCents });
      }
    }

    return { totalCents: cents, totalItemsCount: count, cartLines: lines };
  }, [products, cart]);

  const lowStockCount = React.useMemo(
    () => products.filter((p) => p.stock <= p.lowStockThreshold).length,
    [products]
  );
  const inCartCount = React.useMemo(
    () => products.filter((p) => (cart[p.id] ?? 0) > 0).length,
    [products, cart]
  );

  const parsedTenderEtb = Number(tenderInput);
  const hasCustomTender =
    tenderInput.trim().length > 0 &&
    !Number.isNaN(parsedTenderEtb) &&
    parsedTenderEtb >= 0;
  const tenderedCents = hasCustomTender ? Math.round(parsedTenderEtb * 100) : totalCents;
  const cashDiffCents = tenderedCents - totalCents;
  const isCashShort = paymentMethod === 'CASH' && totalCents > 0 && cashDiffCents < 0;
  const smartNotes = React.useMemo(() => getSmartTenderNotes(totalCents), [totalCents]);

  const handleIncrement = React.useCallback(
    (productId: string) => {
      const product = productById.get(productId);
      if (!product || product.stock === 0) return;

      const currentQty = cart[productId] ?? 0;
      if (currentQty >= product.stock) {
        toast({
          message: `Only ${product.stock} left for ${product.name}`,
          variant: 'warning',
        });
        return;
      }

      setCart((prev) => incrementCartQuantity(prev, productId));
    },
    [productById, cart, toast]
  );

  const handleDecrement = React.useCallback((productId: string) => {
    setCart((prev) => decrementCartQuantity(prev, productId));
  }, []);

  const handleRemove = React.useCallback((productId: string) => {
    setCart((prev) => removeCartItem(prev, productId));
  }, []);

  const handleClearCart = React.useCallback(() => {
    setCart({});
    setPaymentMethod('CASH');
    setTenderInput('');
    setIsCartReviewOpen(false);
  }, []);

  const handleCheckout = React.useCallback(() => {
    if (totalItemsCount === 0 || isCashShort || isCheckingOut) return;

    const snapshotLines: ReceiptLineSnapshot[] = cartLines.map(
      ({ product, qty, lineCents }) => ({
        name: product.name,
        qty,
        lineCents,
      })
    );
    const snapshotTendered = paymentMethod === 'CASH' ? tenderedCents : null;
    const purchasedQuantities = { ...cart };

    void executeCheckout({
      cart,
      paymentMethod,
      products,
      onSuccess: (feedback) => {
        setProducts((prev) =>
          prev.map((item) => {
            const sold = purchasedQuantities[item.id] ?? 0;
            if (sold === 0) return item;
            const nextStock = Math.max(0, item.stock - sold);
            return {
              ...item,
              stock: nextStock,
              isLowStock: nextStock <= item.lowStockThreshold,
            };
          })
        );
        setLastReceiptLines(snapshotLines);
        setLastTenderedCents(snapshotTendered);
        setSalesCount((prev) => prev + 1);
        setCart({});
        setPaymentMethod('CASH');
        setTenderInput('');
        setIsCartReviewOpen(false);
        setFeedbackModal({
          isOpen: true,
          type: 'success',
          feedback,
          errorMessage: null,
        });
      },
      onError: (msg) => {
        setIsCartReviewOpen(false);
        setFeedbackModal({
          isOpen: true,
          type: 'error',
          feedback: null,
          errorMessage: msg,
        });
      },
    });
  }, [
    totalItemsCount,
    isCashShort,
    isCheckingOut,
    cartLines,
    paymentMethod,
    tenderedCents,
    cart,
    products,
    executeCheckout,
  ]);

  // '/' focuses product search without inserting '/' into the input
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select';

      if (event.key === '/' && !isTyping && !feedbackModal.isOpen && !isCartReviewOpen) {
        event.preventDefault();
        ignoreNextSlashRef.current = true;
        searchInputRef.current?.focus();
        setTimeout(() => {
          ignoreNextSlashRef.current = false;
        }, 50);
      }
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [feedbackModal.isOpen, isCartReviewOpen]);

  return (
    <NavigationShell storeName={initialStoreName}>
      <div className="flex min-h-full flex-col lg:h-full lg:flex-row lg:overflow-hidden">
        {/* Catalog Stage */}
        <section className="flex min-w-0 flex-1 flex-col lg:h-full lg:overflow-hidden">
          <div className="shrink-0 space-y-3 border-b border-border/60 bg-background px-4 py-4 sm:px-6">
            <PageHeader
              title="Counter"
              badge={
                <Badge variant="outline" className="font-mono tabular-nums">
                  Today: {salesCount} {salesCount === 1 ? 'sale' : 'sales'}
                </Badge>
              }
              actions={
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void refreshCatalog()}
                    loading={loading}
                    aria-label="Refresh product catalog"
                  >
                    <RefreshCw className="size-3.5" aria-hidden="true" />
                    <span>Refresh</span>
                  </Button>

                  <Button
                    variant={totalItemsCount > 0 ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setIsCartReviewOpen(true)}
                    className="lg:hidden"
                  >
                    <ShoppingBag className="size-3.5" aria-hidden="true" />
                    <span className="tabular-nums">
                      {totalItemsCount} · {formatEtb(totalCents)} ETB
                    </span>
                  </Button>
                </div>
              }
            />

            {/* Search + Quick Filters */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground"
                  aria-hidden="true"
                />
                <Input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(event) => {
                    const nextVal = event.target.value;
                    if (ignoreNextSlashRef.current) {
                      ignoreNextSlashRef.current = false;
                      if (nextVal === '/') return;
                      if (nextVal === `${searchQuery}/`) return;
                    }
                    setSearchQuery(nextVal);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && displayedProducts.length > 0) {
                      const firstAvailable = displayedProducts.find((p) => p.stock > 0);
                      if (firstAvailable) {
                        handleIncrement(firstAvailable.id);
                        toast({
                          message: `Added ${firstAvailable.name}`,
                          variant: 'success',
                        });
                      }
                    } else if (event.key === 'Escape') {
                      setSearchQuery('');
                      event.currentTarget.blur();
                    }
                  }}
                  placeholder="Search products by name..."
                  aria-label="Search products by name"
                  className="pl-9 pr-14"
                />
                <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
                  {searchQuery ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSearchQuery('');
                        searchInputRef.current?.focus();
                      }}
                      aria-label="Clear search"
                      className="size-7"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </Button>
                  ) : (
                    <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                      /
                    </kbd>
                  )}
                </div>
              </div>

              <div
                className="flex shrink-0 flex-wrap items-center gap-1.5"
                role="group"
                aria-label="Catalog filters"
              >
                <Button
                  variant={quickFilter === 'all' ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setQuickFilter('all')}
                  className={cn(
                    quickFilter === 'all'
                      ? 'border-foreground bg-foreground text-card hover:bg-foreground/90 hover:text-card'
                      : ''
                  )}
                >
                  <span>All</span>
                  <span className="font-mono text-xs tabular-nums opacity-80">
                    {products.length}
                  </span>
                </Button>
                <Button
                  variant={quickFilter === 'incart' ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setQuickFilter('incart')}
                  className={cn(
                    quickFilter === 'incart'
                      ? 'border-foreground bg-foreground text-card hover:bg-foreground/90 hover:text-card'
                      : ''
                  )}
                >
                  <span>In cart</span>
                  <span className="font-mono text-xs tabular-nums opacity-80">
                    {inCartCount}
                  </span>
                </Button>
                <Button
                  variant={quickFilter === 'low' ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setQuickFilter('low')}
                  className={cn(
                    quickFilter === 'low'
                      ? 'border-foreground bg-foreground text-card hover:bg-foreground/90 hover:text-card'
                      : ''
                  )}
                >
                  <span>Low stock</span>
                  <span className="font-mono text-xs tabular-nums opacity-80">
                    {lowStockCount}
                  </span>
                </Button>
              </div>
            </div>
          </div>

          {/* Product Grid Area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            {loading && products.length === 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="flex h-32 flex-col justify-between rounded-xl border border-border bg-card p-3.5"
                  >
                    <Skeleton className="h-4 w-3/4" />
                    <div className="flex items-center justify-between pt-4">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                  </div>
                ))}
              </div>
            ) : errorMessage && products.length === 0 ? (
              <EmptyState
                variant="error"
                title="Unable to load counter catalog"
                description={errorMessage}
                action={<Button onClick={() => void refreshCatalog()}>Retry</Button>}
              />
            ) : products.length === 0 ? (
              <EmptyState
                icon={Package}
                title="No active products in catalog"
                description="Add products in Inventory to start ringing up sales on the counter."
                action={
                  <Link href="/inventory" className={buttonVariants()}>
                    Go to Inventory
                  </Link>
                }
              />
            ) : displayedProducts.length === 0 ? (
              <EmptyState
                icon={Search}
                title="No matching products"
                description={
                  searchQuery.trim()
                    ? `No catalog items matched "${searchQuery.trim()}".`
                    : 'No items match this quick filter.'
                }
                action={
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchQuery('');
                      setQuickFilter('all');
                    }}
                  >
                    Reset filters
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {displayedProducts.map((product) => {
                  const qty = cart[product.id] ?? 0;
                  const inCart = qty > 0;
                  const outOfStock = product.stock === 0;
                  const low = product.stock > 0 && product.isLowStock;

                  return (
                    <div
                      key={product.id}
                      className={cn(
                        'flex h-full min-h-36 flex-col justify-between overflow-hidden rounded-xl border transition-colors',
                        outOfStock
                          ? 'border-border bg-muted/70 opacity-60'
                          : inCart
                            ? 'border-primary bg-primary-soft'
                            : 'border-border bg-card hover:border-border-strong'
                      )}
                    >
                      <Button
                        variant="ghost"
                        disabled={outOfStock || isCheckingOut}
                        onClick={() => handleIncrement(product.id)}
                        aria-label={`Add ${product.name}, ${product.priceEtb} ETB, ${
                          outOfStock ? 'out of stock' : `${product.stock} in stock`
                        }`}
                        className="h-auto min-h-20 w-full flex-1 flex-col items-stretch justify-between whitespace-normal rounded-none p-3 text-left hover:bg-transparent"
                      >
                        <div className="flex w-full items-start justify-between gap-2">
                          <span className="line-clamp-2 min-w-0 flex-1 break-words text-sm font-medium leading-snug text-foreground">
                            {product.name}
                          </span>
                          {inCart ? (
                            <Badge
                              variant="default"
                              className="shrink-0 font-mono tabular-nums"
                            >
                              {qty}
                            </Badge>
                          ) : null}
                        </div>

                        <div className="flex w-full items-center justify-between gap-1.5 pt-2">
                          <span className="whitespace-nowrap font-mono text-xs font-semibold tabular-nums text-foreground sm:text-sm">
                            {product.priceEtb}{' '}
                            <span className="font-normal text-muted-foreground">ETB</span>
                          </span>
                          {outOfStock ? (
                            <Badge
                              variant="destructive"
                              className="shrink-0 whitespace-nowrap"
                            >
                              Out
                            </Badge>
                          ) : low ? (
                            <Badge
                              variant="warning"
                              className="shrink-0 whitespace-nowrap font-mono tabular-nums"
                            >
                              {product.stock} left
                            </Badge>
                          ) : (
                            <span className="shrink-0 whitespace-nowrap font-mono text-xs tabular-nums text-subtle-foreground">
                              {product.stock}
                            </span>
                          )}
                        </div>
                      </Button>

                      {inCart ? (
                        <div className="flex items-center justify-between gap-1 border-t border-primary-border bg-card/85 px-2 py-1.5">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              disabled={isCheckingOut}
                              onClick={() => handleDecrement(product.id)}
                              aria-label={`Remove one ${product.name}`}
                              className="size-8"
                            >
                              <Minus className="size-3.5" aria-hidden="true" />
                            </Button>
                            <span className="w-5 text-center font-mono text-xs font-semibold tabular-nums text-foreground">
                              {qty}
                            </span>
                            <Button
                              variant="default"
                              size="icon"
                              disabled={isCheckingOut || qty >= product.stock}
                              onClick={() => handleIncrement(product.id)}
                              aria-label={`Add one ${product.name}`}
                              className="size-8"
                            >
                              <Plus className="size-3.5" aria-hidden="true" />
                            </Button>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isCheckingOut}
                            onClick={() => handleRemove(product.id)}
                            aria-label={`Drop ${product.name} from sale`}
                            className="h-8 px-2 text-xs text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
                          >
                            Drop
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Desktop Docked Ticket Rail (>= 1024px) */}
        <aside
          aria-label="Current sale ticket"
          className="hidden w-96 shrink-0 flex-col border-l border-border bg-card lg:flex lg:h-full"
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                Current sale
              </h2>
              <Badge variant="secondary" className="font-mono tabular-nums">
                {totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'}
              </Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={totalItemsCount === 0 || isCheckingOut}
              onClick={handleClearCart}
              className="text-muted-foreground hover:border-destructive-border hover:bg-destructive-soft hover:text-destructive"
            >
              <X className="size-3.5" aria-hidden="true" />
              <span>Drop all</span>
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto px-5">
            {cartLines.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center py-8">
                <EmptyState
                  icon={Receipt}
                  title="No active ticket"
                  description="Tap a product on the counter to start a sale."
                />
              </div>
            ) : (
              <div className="divide-y divide-border/70">
                {cartLines.map(({ product, qty, lineCents }) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between gap-2.5 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {product.name}
                      </p>
                      <p className="font-mono text-xs tabular-nums text-subtle-foreground">
                        {product.priceEtb} × {qty}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={isCheckingOut}
                        onClick={() => handleDecrement(product.id)}
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
                        onClick={() => handleIncrement(product.id)}
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
                        onClick={() => handleRemove(product.id)}
                        aria-label={`Drop ${product.name} from sale`}
                        className="h-6 px-1.5 text-xs text-muted-foreground hover:text-destructive"
                      >
                        Drop
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="shrink-0 space-y-3 border-t border-dashed border-border-strong bg-card px-5 py-4">
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
                onClick={() => setPaymentMethod('CASH')}
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
                onClick={() => setPaymentMethod('DIGITAL')}
                className={cn(
                  'h-10 text-xs font-semibold',
                  paymentMethod === 'DIGITAL'
                    ? 'border-border-strong bg-card shadow-sm'
                    : ''
                )}
              >
                <Smartphone
                  className={cn(
                    'size-4',
                    paymentMethod === 'DIGITAL' ? 'text-primary' : ''
                  )}
                  aria-hidden="true"
                />
                <span>Digital</span>
              </Button>
            </div>

            {paymentMethod === 'CASH' && totalCents > 0 ? (
              <div className="space-y-2 rounded-lg border border-border bg-background p-3">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="desktop-tender-input"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Cash received
                  </label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      id="desktop-tender-input"
                      type="number"
                      min="0"
                      step="1"
                      value={tenderInput}
                      onChange={(e) => setTenderInput(e.target.value)}
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
                    onClick={() => setTenderInput('')}
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
                      onClick={() => setTenderInput(String(bill))}
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
              <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                {formatEtb(totalCents)} ETB
              </span>
            </div>

            <Button
              size="counter"
              loading={isCheckingOut}
              loadingText="Recording sale..."
              disabled={totalItemsCount === 0 || isCashShort}
              onClick={handleCheckout}
              className="w-full"
            >
              <span className="tabular-nums">
                {totalItemsCount === 0
                  ? 'Select items to charge'
                  : `Charge ${formatEtb(totalCents)} ETB`}
              </span>
            </Button>
          </div>
        </aside>
      </div>

      {/* Mobile CartReviewModal (< 1024px) */}
      <CartReviewModal
        isOpen={isCartReviewOpen}
        onClose={() => setIsCartReviewOpen(false)}
        cart={cart}
        products={products}
        totalCents={totalCents}
        totalItemsCount={totalItemsCount}
        paymentMethod={paymentMethod}
        onPaymentMethodChange={setPaymentMethod}
        onIncrement={handleIncrement}
        onDecrement={handleDecrement}
        onRemove={handleRemove}
        onClearCart={handleClearCart}
        onCheckout={handleCheckout}
        isCheckingOut={isCheckingOut}
        tenderInput={tenderInput}
        onTenderInputChange={setTenderInput}
      />

      {/* Animated CheckoutFeedbackModal */}
      <CheckoutFeedbackModal
        state={feedbackModal}
        onClose={() => setFeedbackModal((prev) => ({ ...prev, isOpen: false }))}
        onRetry={handleCheckout}
        lineItems={lastReceiptLines}
        tenderedCents={lastTenderedCents}
        storeName={initialStoreName}
      />
    </NavigationShell>
  );
}
