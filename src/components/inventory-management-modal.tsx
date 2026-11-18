// src/components/inventory-management-modal.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Plus,
  Loader2,
  AlertTriangle,
  RotateCcw,
  Archive,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toCents } from '@/lib/money';
import { fetchAllProducts } from '@/lib/fetch-all-products';

export interface ProductItem {
  id: string;
  name: string;
  priceCents: number;
  priceEtb: string;
  stock: number;
  lowStockThreshold: number;
  isLowStock: boolean;
}

interface InventoryManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductsUpdated?: () => void;
}

export function InventoryManagementModal({
  isOpen,
  onClose,
  onProductsUpdated,
}: InventoryManagementModalProps) {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Add Product Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [priceEtb, setPriceEtb] = useState('');
  const [stock, setStock] = useState('10');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Restock and Archive Action States
  const [actionProductId, setActionProductId] = useState<string | null>(null);
  const [productToArchive, setProductToArchive] = useState<ProductItem | null>(null);

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchAllProducts();
      setProducts(items);
    } catch {
      setError('Failed to load inventory. Please retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchCatalog();
      setShowAddForm(false);
      setSuccessMessage(null);
      setFormError(null);
      setProductToArchive(null);
    }
  }, [isOpen, fetchCatalog]);

  if (!isOpen) return null;

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
      if (onProductsUpdated) onProductsUpdated();
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
      setSuccessMessage(`Restocked +${amount} for ${product.name}`);
      if (onProductsUpdated) onProductsUpdated();
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
      setSuccessMessage(`Archived "${productToArchive.name}" from counter`);
      setProductToArchive(null);
      if (onProductsUpdated) onProductsUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive product');
    } finally {
      setActionProductId(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="inventory-modal-title"
      className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
    >
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-xl border border-border bg-card shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4 sm:p-6">
          <div>
            <h2
              id="inventory-modal-title"
              className="text-xl font-semibold tracking-tight text-foreground"
            >
              Inventory management
            </h2>
            <p className="text-xs text-muted-foreground">
              Add products, 1-tap quick restock, and low-stock monitor
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close inventory management"
            className="size-8"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Content body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {error && (
            <div
              role="alert"
              className="border-destructive/30 bg-destructive/10 flex items-center justify-between rounded-lg border p-3 text-sm text-destructive"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchCatalog}
                className="hover:bg-destructive/20 h-7 px-2 text-xs text-destructive"
              >
                <RotateCcw className="mr-1 size-3" />
                <span>Retry</span>
              </Button>
            </div>
          )}

          {successMessage && (
            <div
              role="status"
              className="border-success/30 bg-success/15 flex items-center justify-between rounded-lg border p-3 text-sm text-success"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSuccessMessage(null)}
                className="hover:bg-success/20 h-6 px-2 text-xs text-success"
              >
                Dismiss
              </Button>
            </div>
          )}

          {/* Add Product Toggle Button */}
          {!showAddForm && (
            <Button
              variant="outline"
              onClick={() => setShowAddForm(true)}
              style={{ touchAction: 'manipulation' }}
              className="w-full gap-2 border-dashed py-5 text-sm font-medium"
            >
              <Plus className="size-4" />
              <span>Add new product to catalog</span>
            </Button>
          )}

          {/* Add Product Form */}
          {showAddForm && (
            <form
              onSubmit={handleCreateProduct}
              className="bg-muted/40 space-y-3 rounded-lg border border-border p-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Add new product</h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddForm(false)}
                  className="h-7 text-xs"
                >
                  Cancel
                </Button>
              </div>

              {formError && (
                <p className="text-xs font-medium text-destructive">{formError}</p>
              )}

              <div className="space-y-1">
                <label
                  htmlFor="product-name"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Product name
                </label>
                <Input
                  id="product-name"
                  type="text"
                  placeholder="e.g. Cooking Oil 1L"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="space-y-1">
                  <label
                    htmlFor="product-price"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Price in ETB
                  </label>
                  <Input
                    id="product-price"
                    type="text"
                    inputMode="decimal"
                    placeholder="250.00"
                    value={priceEtb}
                    onChange={(e) => setPriceEtb(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="product-stock"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Initial stock
                  </label>
                  <Input
                    id="product-stock"
                    type="number"
                    min="0"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="product-threshold"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Low stock alert
                  </label>
                  <Input
                    id="product-threshold"
                    type="number"
                    min="0"
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="default"
                disabled={isSubmitting}
                style={{ touchAction: 'manipulation' }}
                className="w-full gap-2 text-sm font-semibold"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Saving product...</span>
                  </>
                ) : (
                  <span>Save product</span>
                )}
              </Button>
            </form>
          )}

          {/* Product Items List */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              Current products ({products.length})
            </h3>

            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 rounded-lg" />
                <Skeleton className="h-16 rounded-lg" />
                <Skeleton className="h-16 rounded-lg" />
              </div>
            ) : products.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No active products in catalog. Add your first item above.
              </div>
            ) : (
              <div className="space-y-2">
                {products.map((p) => {
                  const isOperating = actionProductId === p.id;

                  return (
                    <div
                      key={p.id}
                      className="shadow-xs flex items-center justify-between rounded-lg border border-border bg-card p-3"
                    >
                      <div className="min-w-0 flex-1 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-foreground">
                            {p.name}
                          </span>
                          {p.stock === 0 ? (
                            <Badge variant="destructive" className="shrink-0 text-xs">
                              Out of stock
                            </Badge>
                          ) : p.isLowStock ? (
                            <Badge variant="warning" className="shrink-0 text-xs">
                              <AlertTriangle className="mr-0.5 size-2.5" />
                              Low: {p.stock}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="shrink-0 text-xs">
                              Stock: {p.stock}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {p.priceEtb} ETB &bull; Alert at &le; {p.lowStockThreshold}
                        </p>
                      </div>

                      {/* 1-Tap Quick Restock Actions */}
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isOperating}
                          onClick={() => handleQuickRestock(p, 5)}
                          style={{ touchAction: 'manipulation' }}
                          className="h-8 px-2 text-xs font-semibold"
                          aria-label={`Restock 5 units of ${p.name}`}
                        >
                          +5
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isOperating}
                          onClick={() => handleQuickRestock(p, 10)}
                          style={{ touchAction: 'manipulation' }}
                          className="h-8 px-2 text-xs font-semibold"
                          aria-label={`Restock 10 units of ${p.name}`}
                        >
                          +10
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={isOperating}
                          onClick={() => setProductToArchive(p)}
                          className="size-8 text-muted-foreground hover:text-destructive"
                          aria-label={`Archive ${p.name}`}
                        >
                          <Archive className="size-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Confirmation Dialog for Soft-Archiving */}
        {productToArchive && (
          <div className="bg-muted/60 border-t border-border p-4">
            <p className="text-sm font-medium text-foreground">
              Archive &quot;{productToArchive.name}&quot;?
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              The product will be removed from the counter screen without affecting past
              sales records.
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setProductToArchive(null)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleArchiveConfirm}
                disabled={actionProductId === productToArchive.id}
                className="text-xs"
              >
                {actionProductId === productToArchive.id ? (
                  <Loader2 className="mr-1 size-3 animate-spin" />
                ) : null}
                <span>Confirm archive</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
