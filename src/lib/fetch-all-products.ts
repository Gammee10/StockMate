// src/lib/fetch-all-products.ts
// Client-safe helper to fetch a store's entire catalog across cursor pages.
// Caps paging at 10 pages (1,000 items max) to prevent unbounded loops.

import type { CatalogProductView } from '@/server/catalog/types';

export interface FetchAllProductsOptions {
  q?: string;
  maxPages?: number;
}

interface CatalogApiResponse {
  success: boolean;
  count: number;
  products: CatalogProductView[];
  nextCursor: string | null;
}

/**
 * Fetches all products for the authenticated merchant store page by page.
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

    const data: CatalogApiResponse = await res.json();
    if (Array.isArray(data.products)) {
      allProducts.push(...data.products);
    }

    if (!data.nextCursor) {
      break;
    }

    currentCursor = data.nextCursor;
  }

  return allProducts;
}
