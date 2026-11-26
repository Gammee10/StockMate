// src/hooks/use-catalog.ts
'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  archiveCatalogProduct,
  createCatalogProduct,
  fetchAllProducts,
  restockCatalogProduct,
  validateCreateProductForm,
} from '@/lib/api';
import type { CreateProductFormInput, ProductItem } from '@/types/catalog';

interface UseCatalogOptions {
  autoLoad?: boolean;
  onProductsUpdated?: () => void;
}

export function useCatalog(options: UseCatalogOptions = {}) {
  const { autoLoad = true, onProductsUpdated } = options;

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(autoLoad);
  const [error, setError] = useState<string | null>(null);
  const [actionProductId, setActionProductId] = useState<string | null>(null);

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchAllProducts();
      setProducts(items);
    } catch (err) {
      void err;
      setError('Failed to load inventory. Please retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoLoad) {
      fetchCatalog();
    }
  }, [autoLoad, fetchCatalog]);

  const createProduct = useCallback(
    async (
      formInput: CreateProductFormInput
    ): Promise<{ ok: true; name: string } | { ok: false; error: string }> => {
      const parsed = validateCreateProductForm(formInput);
      if (!parsed.ok) {
        return { ok: false, error: parsed.error };
      }

      try {
        await createCatalogProduct(parsed.data);
        await fetchCatalog();
        onProductsUpdated?.();
        return { ok: true, name: parsed.data.name };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Error creating product',
        };
      }
    },
    [fetchCatalog, onProductsUpdated]
  );

  const quickRestock = useCallback(
    async (
      product: ProductItem,
      amount: number
    ): Promise<{ ok: true } | { ok: false; error: string }> => {
      setActionProductId(product.id);
      setError(null);

      try {
        const updated = await restockCatalogProduct(product.id, amount);
        setProducts((prev) =>
          prev.map((p) => (p.id === product.id ? { ...p, ...updated } : p))
        );
        onProductsUpdated?.();
        return { ok: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to restock item';
        setError(message);
        return { ok: false, error: message };
      } finally {
        setActionProductId(null);
      }
    },
    [onProductsUpdated]
  );

  const archiveProduct = useCallback(
    async (
      product: ProductItem
    ): Promise<{ ok: true } | { ok: false; error: string }> => {
      setActionProductId(product.id);
      setError(null);

      try {
        await archiveCatalogProduct(product.id);
        setProducts((prev) => prev.filter((p) => p.id !== product.id));
        onProductsUpdated?.();
        return { ok: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to archive product';
        setError(message);
        return { ok: false, error: message };
      } finally {
        setActionProductId(null);
      }
    },
    [onProductsUpdated]
  );

  return {
    products,
    setProducts,
    loading,
    error,
    setError,
    actionProductId,
    fetchCatalog,
    createProduct,
    quickRestock,
    archiveProduct,
  };
}
