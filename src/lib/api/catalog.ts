// src/lib/api/catalog.ts
import { toCents } from '@/lib/money';
import type {
  CatalogApiResponse,
  CatalogProductView,
  CreateProductFormInput,
  CreateProductInput,
  FetchAllProductsOptions,
  UpdateProductInput,
} from '@/types/catalog';
import { throwApiError } from './client';

/**
 * Fetches all active products for the authenticated merchant store page by page.
 * Stops when nextCursor is null or when maxPages (default 10) is reached.
 */
export async function fetchAllProducts(
  options: FetchAllProductsOptions = {}
): Promise<CatalogProductView[]> {
  const maxPages = options.maxPages ?? 10;
  const allProducts: CatalogProductView[] = [];
  let currentCursor: string | null = null;
  let pageCount = 0;

  while (pageCount < maxPages) {
    pageCount++;
    const params = new URLSearchParams({ limit: '100' });
    if (currentCursor) {
      params.set('cursor', currentCursor);
    }
    if (options.q?.trim()) {
      params.set('q', options.q.trim());
    }

    const res = await fetch(`/api/catalog/products?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch product catalog (status ${res.status})`);
    }

    const data = (await res.json()) as CatalogApiResponse;
    if (Array.isArray(data.products)) {
      allProducts.push(
        ...data.products.map((item) => ({
          ...item,
          costCents: item.costCents ?? null,
        }))
      );
    }

    if (!data.nextCursor) {
      break;
    }

    currentCursor = data.nextCursor;
  }

  return allProducts;
}

export type ProductFormValidationResult =
  { ok: true; data: CreateProductInput } | { ok: false; error: string };

/**
 * Validates and normalizes product form fields into integer cents before POST /api/catalog/products.
 */
export function validateCreateProductForm(
  input: CreateProductFormInput
): ProductFormValidationResult {
  const trimmedName = input.name.trim();
  if (!trimmedName) {
    return { ok: false, error: 'Product name is required' };
  }

  const priceCents = toCents(input.priceEtb);
  if (priceCents === null || priceCents <= 0) {
    return {
      ok: false,
      error: 'Enter a valid positive price in ETB (e.g. 250.00)',
    };
  }

  let costCents: number | null = null;
  if (input.costPriceEtb.trim()) {
    const parsedCost = toCents(input.costPriceEtb);
    if (parsedCost === null || parsedCost < 0) {
      return {
        ok: false,
        error: 'Enter a valid non-negative cost price in ETB or leave blank',
      };
    }
    costCents = parsedCost;
  }

  const stockNum = parseInt(input.stock, 10);
  if (isNaN(stockNum) || stockNum < 0) {
    return { ok: false, error: 'Stock must be a non-negative whole number' };
  }

  const thresholdNum = parseInt(input.lowStockThreshold, 10);
  if (isNaN(thresholdNum) || thresholdNum < 0) {
    return { ok: false, error: 'Threshold must be a non-negative whole number' };
  }

  return {
    ok: true,
    data: {
      name: trimmedName,
      priceCents,
      costCents,
      stock: stockNum,
      lowStockThreshold: thresholdNum,
    },
  };
}

export async function createCatalogProduct(
  input: CreateProductInput
): Promise<CatalogProductView> {
  const res = await fetch('/api/catalog/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    return throwApiError(res, 'Failed to create product');
  }

  const json = (await res.json()) as { data: CatalogProductView };
  return json.data;
}

export async function updateCatalogProduct(
  productId: string,
  input: UpdateProductInput
): Promise<CatalogProductView> {
  const res = await fetch(`/api/catalog/products/${productId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    return throwApiError(res, 'Failed to update product');
  }

  const json = (await res.json()) as { data: CatalogProductView };
  return json.data;
}

export async function restockCatalogProduct(
  productId: string,
  quantity: number
): Promise<CatalogProductView> {
  const res = await fetch(`/api/catalog/products/${productId}/restock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quantity }),
  });

  if (!res.ok) {
    return throwApiError(res, 'Restock failed');
  }

  const json = (await res.json()) as { data: CatalogProductView };
  return json.data;
}

export async function archiveCatalogProduct(
  productId: string
): Promise<CatalogProductView> {
  const res = await fetch(`/api/catalog/products/${productId}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    return throwApiError(res, 'Archival failed');
  }

  const json = (await res.json()) as { data: CatalogProductView };
  return json.data;
}
