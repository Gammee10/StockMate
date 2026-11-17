// src/app/inventory/page.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  RotateCcw,
  Package,
  Plus,
  AlertTriangle,
  Loader2,
  X,
  Archive,
  Search,
  CheckCircle2,
} from 'lucide-react';
import { NavigationShell } from '@/components/navigation-shell';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { toCents } from '@/lib/money';

export interface ProductItem {
  id: string;
  name: string;
  priceCents: number;
  priceEtb: string;
  stock: number;
  lowStockThreshold: number;
  isLowStock: boolean;
  storeName?: string;
}

export default function InventoryPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLowStockOnly, setFilterLowStockOnly] = useState(false);

  // Add Product Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [priceEtb, setPriceEtb] = useState('');
  const [stock, setStock] = useState('10');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Action States
  const [actionProductId, setActionProductId] = useState<string | null>(null);
  const [productToArchive, setProductToArchive] = useState<ProductItem | null>(null);

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/catalog/products');
      if (!res.ok) {
        throw new Error('Failed to load catalog');
      }
      const json = await res.json();
      if (json.products) {
        setProducts(json.products);
      }
    } catch {
      setError('Failed to load inventory. Please retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError('Product name is required');
      return;
    }

    const priceCents = toCents(priceEtb);
    if (priceCents === null || priceCents <= 0) {
      setFormError('Enter a valid positive price in ETB (e.g. 250.00)');
      return;
    }

    const stockNum = parseInt(stock, 10);
    if (isNaN(stockNum) || stockNum < 0) {
      setFormError('Stock must be a non-negative whole number');
      return;
    }

    const thresholdNum = parseInt(lowStockThreshold, 10);
    if (isNaN(thresholdNum) || thresholdNum < 0) {
      setFormError('Threshold must be a non-negative whole number');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/catalog/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          priceCents,
          stock: stockNum,
          lowStockThreshold: thresholdNum,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error?.message || 'Failed to create product');
      }

      setName('');
      setPriceEtb('');
      setStock('10');
      setLowStockThreshold('5');
      setShowAddForm(false);
      setSuccessMessage(`Added "${trimmedName}" to inventory`);
      await fetchCatalog();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error creating product');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickRestock = async (product: ProductItem, amount: number) => {
    setActionProductId(product.id);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/catalog/products/${product.id}/restock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: amount }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error?.message || 'Restock failed');
      }

      const json = await res.json();
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, ...json.data } : p))
      );
      setSuccessMessage(`Restocked +${amount} units for ${product.name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restock item');
    } finally {
      setActionProductId(null);
    }
  };

  const handleArchiveConfirm = async () => {
    if (!productToArchive) return;
    setActionProductId(productToArchive.id);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/catalog/products/${productToArchive.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error?.message || 'Archival failed');
      }

      setProducts((prev) => prev.filter((p) => p.id !== productToArchive.id));
      setSuccessMessage(`Archived "${productToArchive.name}" from catalog`);
      setProductToArchive(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive product');
    } finally {
      setActionProductId(null);
    }
  };

  // Filtered catalog
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesLowStock = filterLowStockOnly ? p.isLowStock : true;
      return matchesSearch && matchesLowStock;
    });
  }, [products, searchQuery, filterLowStockOnly]);

  const totalUnits = useMemo(() => {
    return products.reduce((sum, p) => sum + p.stock, 0);
  }, [products]);

  const lowStockCount = useMemo(() => {
    return products.filter((p) => p.isLowStock).length;
  }, [products]);

  return (
    <NavigationShell>
      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        <PageHeader
          title="Inventory & stock management"
          description="Track stock levels across fast-tap items, replenish inventory with 1-tap quick restocks, and manage catalog items."
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchCatalog}
                disabled={loading}
                className="gap-1.5 text-xs"
                style={{ touchAction: 'manipulation' }}
              >
                <RotateCcw className={loading ? 'size-3.5 animate-spin' : 'size-3.5'} />
                <span>Refresh</span>
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setFormError(null);
                  setShowAddForm(true);
                }}
                className="gap-1.5 text-xs font-semibold"
                style={{ touchAction: 'manipulation' }}
              >
                <Plus className="size-3.5" />
                <span>Add product</span>
              </Button>
            </div>
          }
        />

        {/* Success message banner */}
        {successMessage && (
          <div
            role="status"
            className="flex items-center justify-between rounded-lg border border-success/30 bg-success/15 p-4 text-sm font-medium text-success"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSuccessMessage(null)}
              className="h-7 text-xs text-success hover:bg-success/20"
            >
              Dismiss
            </Button>
          </div>
        )}

        {/* Error message banner */}
        {error && (
          <div
            role="alert"
            className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchCatalog}
              className="h-7 text-xs text-destructive hover:bg-destructive/20"
            >
              Retry
            </Button>
          </div>
        )}

        {/* Stats Row */}
        <section aria-labelledby="inventory-stats-heading">
          <h2 id="inventory-stats-heading" className="sr-only">
            Inventory overview
          </h2>
          <dl className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <dt className="text-sm font-medium text-muted-foreground">Active products</dt>
                <Package className="size-4 text-muted-foreground" />
              </div>
              <dd className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-foreground">
                {loading ? <Skeleton className="h-8 w-16" /> : products.length}
              </dd>
              <p className="mt-1 text-xs text-muted-foreground">Available on checkout counter</p>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <dt className="text-sm font-medium text-muted-foreground">Low stock alerts</dt>
                <AlertTriangle className="size-4 text-muted-foreground" />
              </div>
              <dd className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-foreground">
                {loading ? <Skeleton className="h-8 w-16" /> : lowStockCount}
              </dd>
              <p className="mt-1 text-xs text-muted-foreground">Items requiring immediate restock</p>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <dt className="text-sm font-medium text-muted-foreground">Total stock units</dt>
                <Package className="size-4 text-muted-foreground" />
              </div>
              <dd className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-foreground">
                {loading ? <Skeleton className="h-8 w-20" /> : `${totalUnits} units`}
              </dd>
              <p className="mt-1 text-xs text-muted-foreground">Combined inventory in store</p>
            </div>
          </dl>
        </section>

        {/* Filter & Search Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search products by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={!filterLowStockOnly ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setFilterLowStockOnly(false)}
              className="h-8 text-xs font-medium"
            >
              All items ({products.length})
            </Button>
            <Button
              variant={filterLowStockOnly ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setFilterLowStockOnly(true)}
              className="h-8 text-xs font-medium gap-1.5"
            >
              <AlertTriangle className="size-3 text-warning" />
              <span>Low stock ({lowStockCount})</span>
            </Button>
          </div>
        </div>

        {/* Catalog Table */}
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {loading ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <div className="mb-2 flex size-10 items-center justify-center rounded-lg border border-border bg-muted">
                <Package className="size-5 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                No products found
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {searchQuery || filterLowStockOnly
                  ? 'Try clearing your search query or filter.'
                  : 'Get started by adding your first product to the catalog.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="text-right">Quick restock</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((p) => {
                  const isOperating = actionProductId === p.id;

                  return (
                    <TableRow key={p.id}>
                      {/* Product Name (Main Cell) */}
                      <TableCell className="font-medium text-foreground">
                        <div>{p.name}</div>
                        <div className="text-muted-foreground sm:hidden flex items-center gap-2 mt-0.5 text-xs">
                          <span className="font-semibold text-foreground">{p.priceEtb} ETB</span>
                          {p.isLowStock && (
                            <Badge variant="warning" className="h-4 px-1 text-xs">
                              Low
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      {/* Price in ETB (Desktop) */}
                      <TableCell className="hidden sm:table-cell text-right font-semibold tabular-nums text-foreground">
                        {p.priceEtb} ETB
                      </TableCell>

                      {/* Current Stock */}
                      <TableCell className="tabular-nums">
                        <span className="font-semibold text-foreground">{p.stock}</span>
                        <span className="text-xs text-muted-foreground ml-1">units</span>
                      </TableCell>

                      {/* Low Stock Badge (Desktop) */}
                      <TableCell className="hidden sm:table-cell">
                        {p.isLowStock ? (
                          <Badge variant="warning" className="gap-1">
                            <AlertTriangle className="size-3" />
                            <span>Low (&le; {p.lowStockThreshold})</span>
                          </Badge>
                        ) : (
                          <Badge variant="outline">Adequate</Badge>
                        )}
                      </TableCell>

                      {/* 1-Tap Quick Restock (+5, +10) */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isOperating}
                            onClick={() => handleQuickRestock(p, 5)}
                            className="h-7 px-2 text-xs font-semibold"
                            style={{ touchAction: 'manipulation' }}
                          >
                            +5
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isOperating}
                            onClick={() => handleQuickRestock(p, 10)}
                            className="h-7 px-2 text-xs font-semibold"
                            style={{ touchAction: 'manipulation' }}
                          >
                            +10
                          </Button>
                        </div>
                      </TableCell>

                      {/* Archival Action */}
                      <TableCell className="hidden sm:table-cell text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={isOperating}
                          onClick={() => setProductToArchive(p)}
                          aria-label={`Archive ${p.name}`}
                          className="size-7 text-muted-foreground hover:text-destructive"
                        >
                          <Archive className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Add Product Dialog */}
        {showAddForm && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-product-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm animate-in fade-in-0 duration-150"
          >
            <div className="relative flex w-full max-w-md flex-col rounded-xl border border-border bg-card p-6 shadow-sm animate-in zoom-in-95 duration-200">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="size-5 text-foreground" />
                  <h3 id="add-product-title" className="text-base font-semibold text-foreground">
                    Add new product
                  </h3>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowAddForm(false)}
                  className="size-7"
                >
                  <X className="size-4" />
                </Button>
              </div>

              <form onSubmit={handleCreateProduct} className="space-y-4">
                {formError && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
                    {formError}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="product-name" className="text-xs font-medium text-foreground">
                    Product name
                  </label>
                  <Input
                    id="product-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Cooking Oil 1L"
                    className="text-xs"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="product-price" className="text-xs font-medium text-foreground">
                    Price in ETB
                  </label>
                  <Input
                    id="product-price"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={priceEtb}
                    onChange={(e) => setPriceEtb(e.target.value)}
                    placeholder="e.g. 250.00"
                    className="text-xs"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label htmlFor="product-stock" className="text-xs font-medium text-foreground">
                      Initial stock
                    </label>
                    <Input
                      id="product-stock"
                      type="number"
                      min="0"
                      value={stock}
                      onChange={(e) => setStock(e.target.value)}
                      className="text-xs"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="product-threshold" className="text-xs font-medium text-foreground">
                      Low stock alert
                    </label>
                    <Input
                      id="product-threshold"
                      type="number"
                      min="0"
                      value={lowStockThreshold}
                      onChange={(e) => setLowStockThreshold(e.target.value)}
                      className="text-xs"
                      required
                    />
                  </div>
                </div>

                <div className="mt-5 flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddForm(false)}
                    disabled={isSubmitting}
                    className="flex-1 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 text-xs font-semibold"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save product</span>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Archive Confirmation Dialog */}
        {productToArchive && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="archive-modal-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm animate-in fade-in-0 duration-150"
          >
            <div className="relative flex w-full max-w-md flex-col rounded-xl border border-border bg-card p-6 shadow-sm animate-in zoom-in-95 duration-200">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Archive className="size-5 text-destructive shrink-0" />
                  <h3 id="archive-modal-title" className="text-base font-semibold text-foreground">
                    Archive product
                  </h3>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setProductToArchive(null)}
                  className="size-7"
                >
                  <X className="size-4" />
                </Button>
              </div>

              <div className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  Are you sure you want to archive <strong className="text-foreground">{productToArchive.name}</strong>? It will immediately disappear from the active cashier counter.
                </p>
                <p className="text-xs text-muted-foreground">
                  Past sales receipts and till records will continue to display this item with total accuracy.
                </p>
              </div>

              <div className="mt-5 flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setProductToArchive(null)}
                  className="flex-1 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleArchiveConfirm}
                  disabled={actionProductId === productToArchive.id}
                  className="flex-1 text-xs"
                >
                  {actionProductId === productToArchive.id ? (
                    <>
                      <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                      <span>Archiving...</span>
                    </>
                  ) : (
                    <span>Confirm archive</span>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </NavigationShell>
  );
}
