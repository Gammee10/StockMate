'use client';

import * as React from 'react';
import { Archive, Package, Pencil, Plus, RefreshCw, Search, X } from 'lucide-react';
import { NavigationShell } from '@/components/navigation-shell';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import {
  Modal,
  ModalBody,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import {
  archiveCatalogProduct,
  createCatalogProduct,
  fetchAllProducts,
  restockCatalogProduct,
  updateCatalogProduct,
  validateCreateProductForm,
} from '@/lib/api/catalog';
import { formatBirrAmount } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { CreateProductFormInput, ProductItem } from '@/types/catalog';

export interface InventoryWorkspaceProps {
  initialStoreName?: string;
  initialProducts: ProductItem[];
  initialError?: string | null;
}

const DEFAULT_FORM_INPUT: CreateProductFormInput = {
  name: '',
  priceEtb: '',
  costPriceEtb: '',
  stock: '10',
  lowStockThreshold: '5',
};

/**
 * Interactive Inventory workspace wired to catalog list, create, update, atomic restock,
 * and soft-archival endpoints.
 */
export function InventoryWorkspace({
  initialStoreName,
  initialProducts,
  initialError = null,
}: InventoryWorkspaceProps) {
  const { toast } = useToast();

  const [products, setProducts] = React.useState<ProductItem[]>(initialProducts);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(initialError);
  const [actionProductId, setActionProductId] = React.useState<string | null>(null);

  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterLowStockOnly, setFilterLowStockOnly] = React.useState(false);

  // Add / Edit Product dialog state
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingProduct, setEditingProduct] = React.useState<ProductItem | null>(null);
  const [formInput, setFormInput] =
    React.useState<CreateProductFormInput>(DEFAULT_FORM_INPUT);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Archive dialog state
  const [productToArchive, setProductToArchive] = React.useState<ProductItem | null>(
    null
  );
  const [archiveError, setArchiveError] = React.useState<string | null>(null);

  const fetchCatalog = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchAllProducts();
      setProducts(items);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load inventory. Please retry.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const filteredProducts = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (filterLowStockOnly && !p.isLowStock) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, searchQuery, filterLowStockOnly]);

  const lowStockCount = React.useMemo(
    () => products.filter((p) => p.isLowStock).length,
    [products]
  );

  const totalUnits = React.useMemo(
    () => products.reduce((sum, p) => sum + p.stock, 0),
    [products]
  );

  const openAddModal = () => {
    setEditingProduct(null);
    setFormInput(DEFAULT_FORM_INPUT);
    setFormError(null);
    setFormOpen(true);
  };

  const openEditModal = (product: ProductItem) => {
    setEditingProduct(product);
    setFormInput({
      name: product.name,
      priceEtb: product.priceEtb,
      costPriceEtb:
        product.costCents !== null && product.costCents !== undefined
          ? formatBirrAmount(product.costCents)
          : '',
      stock: String(product.stock),
      lowStockThreshold: String(product.lowStockThreshold),
    });
    setFormError(null);
    setFormOpen(true);
  };

  const handleSaveProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;

    const validated = validateCreateProductForm(formInput);
    if (!validated.ok) {
      setFormError(validated.error);
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      if (editingProduct) {
        const updated = await updateCatalogProduct(editingProduct.id, {
          name: validated.data.name,
          priceCents: validated.data.priceCents,
          costCents: validated.data.costCents ?? null,
          stock: validated.data.stock,
          lowStockThreshold: validated.data.lowStockThreshold,
        });
        setProducts((prev) =>
          prev.map((item) =>
            item.id === editingProduct.id ? { ...item, ...updated } : item
          )
        );
        setFormOpen(false);
        toast({ message: `Updated ${updated.name}`, variant: 'success' });
      } else {
        await createCatalogProduct(validated.data);
        setFormOpen(false);
        await fetchCatalog();
        toast({ message: `Added ${validated.data.name}`, variant: 'success' });
      }
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : editingProduct
            ? 'Failed to update product.'
            : 'Failed to create product.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickRestock = async (product: ProductItem, amount: number) => {
    setActionProductId(product.id);
    setError(null);

    try {
      const updated = await restockCatalogProduct(product.id, amount);
      setProducts((prev) =>
        prev.map((item) => (item.id === product.id ? { ...item, ...updated } : item))
      );
      toast({ message: `Restocked +${amount} ${product.name}`, variant: 'success' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restock product.');
    } finally {
      setActionProductId(null);
    }
  };

  const handleConfirmArchive = async () => {
    if (!productToArchive || actionProductId) return;
    setActionProductId(productToArchive.id);
    setArchiveError(null);

    try {
      await archiveCatalogProduct(productToArchive.id);
      const archivedName = productToArchive.name;
      setProducts((prev) => prev.filter((item) => item.id !== productToArchive.id));
      setProductToArchive(null);
      toast({ message: `Archived ${archivedName}`, variant: 'warning' });
    } catch (err) {
      setArchiveError(err instanceof Error ? err.message : 'Failed to archive product.');
    } finally {
      setActionProductId(null);
    }
  };

  return (
    <NavigationShell storeName={initialStoreName}>
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          title="Inventory"
          description="Active store catalog, quick +5 / +10 restocks, item edits, and soft archival."
          badge={
            <Badge variant="outline" className="font-mono tabular-nums">
              {products.length} {products.length === 1 ? 'SKU' : 'SKUs'}
            </Badge>
          }
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                loading={loading}
                onClick={() => void fetchCatalog()}
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
                <span>Refresh</span>
              </Button>
              <Button size="sm" onClick={openAddModal}>
                <Plus className="size-3.5" aria-hidden="true" />
                <span>Add product</span>
              </Button>
            </div>
          }
        />

        {/* Aggregate KPI Strip */}
        <dl className="grid grid-cols-3 gap-3">
          <Card className="p-4">
            <dt className="text-xs font-medium text-muted-foreground">Active products</dt>
            <dd className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground sm:text-2xl">
              {products.length}
            </dd>
          </Card>
          <Card className="p-4">
            <dt className="text-xs font-medium text-muted-foreground">Low / out</dt>
            <dd
              className={cn(
                'mt-1 font-mono text-lg font-semibold tabular-nums sm:text-2xl',
                lowStockCount > 0 ? 'text-warning' : 'text-foreground'
              )}
            >
              {lowStockCount}
            </dd>
          </Card>
          <Card className="p-4">
            <dt className="text-xs font-medium text-muted-foreground">Total units</dt>
            <dd className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground sm:text-2xl">
              {totalUnits.toLocaleString('en-US')}
            </dd>
          </Card>
        </dl>

        {error ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive-border bg-destructive-soft px-4 py-2.5 text-xs font-medium text-destructive"
          >
            <span>{error}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => void fetchCatalog()}>
                Retry
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setError(null)}
                aria-label="Dismiss error"
              >
                Dismiss
              </Button>
            </div>
          </div>
        ) : null}

        <Card>
          <CardHeader className="border-b border-border">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Catalog items</CardTitle>
                <CardDescription>
                  Updates immediately sync to the POS Counter and Analytics.
                </CardDescription>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative min-w-0 sm:w-64">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter products..."
                    aria-label="Filter products by name"
                    className="pl-9 pr-9"
                  />
                  {searchQuery ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear filter"
                      className="absolute right-1 top-1/2 size-7 -translate-y-1/2"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </Button>
                  ) : null}
                </div>

                <div
                  className="flex items-center gap-1.5"
                  role="group"
                  aria-label="Stock filter"
                >
                  <Button
                    variant={!filterLowStockOnly ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => setFilterLowStockOnly(false)}
                    className={cn(
                      !filterLowStockOnly
                        ? 'border-foreground bg-foreground text-card hover:bg-foreground/90 hover:text-card'
                        : ''
                    )}
                  >
                    All items
                  </Button>
                  <Button
                    variant={filterLowStockOnly ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => setFilterLowStockOnly(true)}
                    className={cn(
                      filterLowStockOnly
                        ? 'border-warning bg-warning-soft text-warning hover:bg-warning-soft'
                        : ''
                    )}
                  >
                    Low stock ({lowStockCount})
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {loading && products.length === 0 ? (
              <div className="divide-y divide-border p-4">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-4 py-3">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-8 w-36" />
                  </div>
                ))}
              </div>
            ) : error && products.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  variant="error"
                  title="Unable to load inventory"
                  description={error}
                  action={<Button onClick={() => void fetchCatalog()}>Retry</Button>}
                />
              </div>
            ) : products.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={Package}
                  title="No products in catalog"
                  description="Add your first store product with selling price and stock level."
                  action={
                    <Button onClick={openAddModal}>
                      <Plus className="size-4" aria-hidden="true" />
                      <span>Add product</span>
                    </Button>
                  }
                />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={Search}
                  title="No matching products"
                  description={
                    searchQuery.trim()
                      ? `No inventory items matched "${searchQuery.trim()}".`
                      : 'No products are currently low or out of stock.'
                  }
                  action={
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearchQuery('');
                        setFilterLowStockOnly(false);
                      }}
                    >
                      Reset filters
                    </Button>
                  }
                />
              </div>
            ) : (
              <Table className="[&_tr>*:first-child]:pl-4 [&_tr>*:last-child]:pr-4">
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">
                      Price
                    </TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => {
                    const busy = actionProductId === product.id;
                    const out = product.stock === 0;
                    const low = product.stock > 0 && product.isLowStock;

                    return (
                      <TableRow key={product.id}>
                        <TableCell className="min-w-0">
                          <p className="break-anywhere font-medium text-foreground">
                            {product.name}
                          </p>
                          <p className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground sm:hidden">
                            {product.priceEtb} ETB
                            {product.costCents !== null && product.costCents !== undefined
                              ? ` · Cost ${formatBirrAmount(product.costCents)}`
                              : ''}
                          </p>
                        </TableCell>

                        <TableCell className="hidden text-right font-mono tabular-nums sm:table-cell">
                          <p className="font-medium text-foreground">
                            {product.priceEtb} ETB
                          </p>
                          {product.costCents !== null &&
                          product.costCents !== undefined ? (
                            <p className="text-xs text-subtle-foreground">
                              Cost {formatBirrAmount(product.costCents)} ETB
                            </p>
                          ) : null}
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="inline-flex flex-col items-end gap-1">
                            <Badge
                              variant={out ? 'destructive' : low ? 'warning' : 'success'}
                              className="whitespace-nowrap font-mono tabular-nums"
                            >
                              {out ? '0 (Out)' : `${product.stock} units`}
                            </Badge>
                            <span className="font-mono text-xs tabular-nums text-subtle-foreground">
                              Alert ≤{product.lowStockThreshold}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() => void handleQuickRestock(product, 5)}
                              aria-label={`Restock ${product.name} by 5`}
                              className="font-mono text-xs tabular-nums"
                            >
                              +5
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() => void handleQuickRestock(product, 10)}
                              aria-label={`Restock ${product.name} by 10`}
                              className="font-mono text-xs tabular-nums"
                            >
                              +10
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={busy}
                              onClick={() => openEditModal(product)}
                              aria-label={`Edit ${product.name}`}
                              className="size-8"
                            >
                              <Pencil className="size-3.5" aria-hidden="true" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={busy}
                              onClick={() => {
                                setArchiveError(null);
                                setProductToArchive(product);
                              }}
                              aria-label={`Archive ${product.name}`}
                              className="size-8 text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
                            >
                              <Archive className="size-3.5" aria-hidden="true" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add / Edit Product Modal */}
      <Modal
        open={formOpen}
        onClose={() => {
          if (!isSubmitting) setFormOpen(false);
        }}
        size="md"
        ariaLabelledBy="product-form-title"
      >
        <ModalHeader onClose={isSubmitting ? undefined : () => setFormOpen(false)}>
          <ModalTitle id="product-form-title">
            {editingProduct ? 'Edit product' : 'Add product'}
          </ModalTitle>
          <ModalDescription>
            {editingProduct
              ? 'Update product pricing, stock level, or low-stock alert threshold.'
              : 'All monetary amounts are converted to integer cents on the server.'}
          </ModalDescription>
        </ModalHeader>

        <form onSubmit={(e) => void handleSaveProduct(e)}>
          <ModalBody className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="prod-name"
                className="block text-xs font-medium text-muted-foreground"
              >
                Product name
              </label>
              <Input
                id="prod-name"
                type="text"
                maxLength={100}
                value={formInput.name}
                disabled={isSubmitting}
                error={Boolean(formError)}
                onChange={(e) =>
                  setFormInput((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g. White Teff (5kg)"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label
                  htmlFor="prod-price"
                  className="block text-xs font-medium text-muted-foreground"
                >
                  Selling price (ETB)
                </label>
                <Input
                  id="prod-price"
                  type="text"
                  inputMode="decimal"
                  value={formInput.priceEtb}
                  disabled={isSubmitting}
                  error={Boolean(formError)}
                  onChange={(e) =>
                    setFormInput((prev) => ({ ...prev, priceEtb: e.target.value }))
                  }
                  placeholder="250.00"
                  className="font-mono tabular-nums"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="prod-cost"
                  className="block text-xs font-medium text-muted-foreground"
                >
                  Wholesale cost (ETB, optional)
                </label>
                <Input
                  id="prod-cost"
                  type="text"
                  inputMode="decimal"
                  value={formInput.costPriceEtb}
                  disabled={isSubmitting}
                  onChange={(e) =>
                    setFormInput((prev) => ({ ...prev, costPriceEtb: e.target.value }))
                  }
                  placeholder="180.00"
                  className="font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label
                  htmlFor="prod-stock"
                  className="block text-xs font-medium text-muted-foreground"
                >
                  {editingProduct ? 'Stock on hand' : 'Initial stock'}
                </label>
                <Input
                  id="prod-stock"
                  type="number"
                  min="0"
                  step="1"
                  value={formInput.stock}
                  disabled={isSubmitting}
                  onChange={(e) =>
                    setFormInput((prev) => ({ ...prev, stock: e.target.value }))
                  }
                  className="font-mono tabular-nums"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="prod-threshold"
                  className="block text-xs font-medium text-muted-foreground"
                >
                  Low stock alert at
                </label>
                <Input
                  id="prod-threshold"
                  type="number"
                  min="0"
                  step="1"
                  value={formInput.lowStockThreshold}
                  disabled={isSubmitting}
                  onChange={(e) =>
                    setFormInput((prev) => ({
                      ...prev,
                      lowStockThreshold: e.target.value,
                    }))
                  }
                  className="font-mono tabular-nums"
                />
              </div>
            </div>

            {formError ? (
              <p
                role="alert"
                className="break-words rounded-md border border-destructive-border bg-destructive-soft px-3 py-2 text-xs font-medium text-destructive"
              >
                {formError}
              </p>
            ) : null}
          </ModalBody>

          <ModalFooter>
            <Button
              variant="outline"
              disabled={isSubmitting}
              onClick={() => setFormOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={isSubmitting}
              loadingText={editingProduct ? 'Saving changes...' : 'Adding product...'}
            >
              {editingProduct ? 'Save changes' : 'Save product'}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Soft-Archive Confirmation Modal */}
      <Modal
        open={Boolean(productToArchive)}
        onClose={() => {
          if (!actionProductId) {
            setProductToArchive(null);
            setArchiveError(null);
          }
        }}
        size="sm"
        ariaLabelledBy="archive-title"
      >
        <ModalHeader
          onClose={
            actionProductId
              ? undefined
              : () => {
                  setProductToArchive(null);
                  setArchiveError(null);
                }
          }
        >
          <ModalTitle id="archive-title">Archive product?</ModalTitle>
          <ModalDescription>
            This removes the item from active Counter sales while preserving past ledger
            history.
          </ModalDescription>
        </ModalHeader>

        {productToArchive ? (
          <ModalBody className="space-y-3">
            <div className="rounded-lg border border-border bg-background p-3 text-xs">
              <p className="break-anywhere font-medium text-foreground">
                {productToArchive.name}
              </p>
              <p className="mt-1 font-mono tabular-nums text-muted-foreground">
                {productToArchive.priceEtb} ETB · {productToArchive.stock} in stock
              </p>
            </div>
            {archiveError ? (
              <p
                role="alert"
                className="break-words rounded-md border border-destructive-border bg-destructive-soft px-3 py-2 text-xs font-medium text-destructive"
              >
                {archiveError}
              </p>
            ) : null}
          </ModalBody>
        ) : null}

        <ModalFooter>
          <Button
            variant="outline"
            disabled={Boolean(actionProductId)}
            onClick={() => {
              setProductToArchive(null);
              setArchiveError(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            loading={Boolean(actionProductId)}
            loadingText="Archiving..."
            onClick={() => void handleConfirmArchive()}
          >
            Archive product
          </Button>
        </ModalFooter>
      </Modal>
    </NavigationShell>
  );
}
