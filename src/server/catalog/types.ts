// src/server/catalog/types.ts
export interface CreateProductInput {
  name: string;
  priceCents: number;
  costCents?: number | null;
  stock: number;
  lowStockThreshold?: number;
}

export interface UpdateProductInput {
  name?: string;
  priceCents?: number;
  costCents?: number | null;
  stock?: number;
  lowStockThreshold?: number;
  isArchived?: boolean;
}

export interface CatalogProductView {
  id: string;
  name: string;
  priceCents: number;
  priceEtb: string;
  costCents: number | null;
  stock: number;
  lowStockThreshold: number;
  isLowStock: boolean;
}

export interface ListStoreProductsOptions {
  cursor?: string;
  limit?: number;
  q?: string;
}

export interface ListProductsResult {
  items: CatalogProductView[];
  nextCursor: string | null;
}
