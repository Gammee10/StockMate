// src/types/catalog.ts
export type {
  StockMovementType,
  CreateProductInput,
  UpdateProductInput,
  CatalogProductView,
  ListStoreProductsOptions,
  ListProductsResult,
  RecordStockMovementInput,
} from '@/server/catalog/types';

export interface Product {
  id: string;
  name: string;
  priceCents: number;
  priceEtb: string;
  stock: number;
  lowStockThreshold: number;
  isLowStock: boolean;
}

export interface ProductItem extends Product {
  costCents?: number | null;
}

export interface CartProduct {
  id: string;
  name: string;
  priceCents: number;
  priceEtb: string;
  stock: number;
}

export interface FetchAllProductsOptions {
  q?: string;
  maxPages?: number;
}

export interface CatalogApiResponse {
  success: boolean;
  count: number;
  products: ProductItem[];
  nextCursor: string | null;
}

export interface CreateProductFormInput {
  name: string;
  priceEtb: string;
  costPriceEtb: string;
  stock: string;
  lowStockThreshold: string;
}
