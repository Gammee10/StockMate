// src/server/catalog/types.ts
export interface CreateProductInput {
  name: string;
  priceCents: number;
  stock: number;
  lowStockThreshold?: number;
}

export interface UpdateProductInput {
  name?: string;
  priceCents?: number;
  stock?: number;
  lowStockThreshold?: number;
  isArchived?: boolean;
}

export interface CatalogProductView {
  id: string;
  name: string;
  priceCents: number;
  priceEtb: string;
  stock: number;
  lowStockThreshold: number;
  isLowStock: boolean;
  storeName?: string;
}
