// src/server/catalog/service.ts
import 'server-only';
import type { Prisma } from '@prisma/client';
import { db } from '@/server/db';
import { AppError } from '@/lib/errors';
import type { CreateProductInput, UpdateProductInput, CatalogProductView } from './types';

type DbOrTx = typeof db | Prisma.TransactionClient;

export async function getProductsCatalog(limit = 50): Promise<CatalogProductView[]> {
  const products = await db.product.findMany({
    where: { isArchived: false },
    take: Math.min(limit, 100),
    include: {
      store: {
        select: { name: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    priceCents: p.priceCents,
    priceEtb: (p.priceCents / 100).toFixed(2),
    stock: p.stock,
    lowStockThreshold: p.lowStockThreshold,
    isLowStock: p.stock <= p.lowStockThreshold,
    storeName: p.store.name,
  }));
}

export async function getStoreProducts(
  storeId: string,
  limit = 100
): Promise<CatalogProductView[]> {
  const products = await db.product.findMany({
    where: {
      storeId,
      isArchived: false,
    },
    take: Math.min(limit, 200),
    orderBy: { name: 'asc' },
  });

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    priceCents: p.priceCents,
    priceEtb: (p.priceCents / 100).toFixed(2),
    stock: p.stock,
    lowStockThreshold: p.lowStockThreshold,
    isLowStock: p.stock <= p.lowStockThreshold,
  }));
}

export async function getProductsForCheckout(
  storeId: string,
  productIds: string[],
  client: DbOrTx = db
) {
  return client.product.findMany({
    where: {
      id: { in: productIds },
      storeId,
      isArchived: false,
    },
    take: 50,
    select: {
      id: true,
      name: true,
      priceCents: true,
      stock: true,
      isArchived: true,
      storeId: true,
    },
  });
}

/**
 * Creates a new product for a specific store (AC 5.1).
 * Invariant #1: Prices are stored as integer cents.
 * Invariant #3: storeId is strictly derived from verified session token.
 */
export async function createStoreProduct(
  storeId: string,
  input: CreateProductInput
): Promise<CatalogProductView> {
  const lowStockThreshold = input.lowStockThreshold ?? 5;

  const product = await db.product.create({
    data: {
      storeId,
      name: input.name,
      priceCents: input.priceCents,
      stock: input.stock,
      lowStockThreshold,
      isArchived: false,
    },
  });

  return {
    id: product.id,
    name: product.name,
    priceCents: product.priceCents,
    priceEtb: (product.priceCents / 100).toFixed(2),
    stock: product.stock,
    lowStockThreshold: product.lowStockThreshold,
    isLowStock: product.stock <= product.lowStockThreshold,
  };
}

/**
 * Updates product details scoped by storeId (AC 5.2).
 */
export async function updateStoreProduct(
  storeId: string,
  productId: string,
  input: UpdateProductInput
): Promise<CatalogProductView> {
  // backend-check-ignore unscoped-read: query is scoped by storeId and id
  const existing = await db.product.findFirst({
    where: {
      id: productId,
      storeId,
      isArchived: false,
    },
  });

  if (!existing) {
    throw new AppError('NOT_FOUND', `Product ${productId} not found in store`, {
      fields: {
        productId: ['Product does not exist in store inventory'],
      },
    });
  }

  const updateData: {
    name?: string;
    priceCents?: number;
    stock?: number;
    lowStockThreshold?: number;
    isArchived?: boolean;
  } = {};

  if (input.name !== undefined) updateData.name = input.name;
  if (input.priceCents !== undefined) updateData.priceCents = input.priceCents;
  if (input.stock !== undefined) updateData.stock = input.stock;
  if (input.lowStockThreshold !== undefined)
    updateData.lowStockThreshold = input.lowStockThreshold;
  if (input.isArchived !== undefined) updateData.isArchived = input.isArchived;

  // backend-check-ignore unscoped-write: storeId ownership is strictly validated before mutating
  const updated = await db.product.update({
    where: { id: productId },
    data: updateData,
  });

  return {
    id: updated.id,
    name: updated.name,
    priceCents: updated.priceCents,
    priceEtb: (updated.priceCents / 100).toFixed(2),
    stock: updated.stock,
    lowStockThreshold: updated.lowStockThreshold,
    isLowStock: updated.stock <= updated.lowStockThreshold,
  };
}

/**
 * Quick restock product atomically (AC 5.3).
 * Enforces Invariant #5: Uses atomic SQL increment to prevent race conditions.
 */
export async function quickRestockProductAtomic(
  storeId: string,
  productId: string,
  quantity: number
): Promise<CatalogProductView> {
  const count = await db.$executeRaw`
    UPDATE products
    SET stock = stock + ${quantity}, updated_at = NOW()
    WHERE id = ${productId}
      AND store_id = ${storeId}
      AND is_archived = false
  `;

  if (count === 0) {
    throw new AppError(
      'NOT_FOUND',
      `Product ${productId} not found for store ${storeId}`,
      {
        fields: {
          productId: ['Product does not exist in store inventory or is archived'],
        },
      }
    );
  }

  // backend-check-ignore unscoped-read: query is scoped by storeId and id
  const product = await db.product.findFirst({
    where: {
      id: productId,
      storeId,
    },
  });

  if (!product) {
    throw new AppError('NOT_FOUND', `Product ${productId} not found`);
  }

  return {
    id: product.id,
    name: product.name,
    priceCents: product.priceCents,
    priceEtb: (product.priceCents / 100).toFixed(2),
    stock: product.stock,
    lowStockThreshold: product.lowStockThreshold,
    isLowStock: product.stock <= product.lowStockThreshold,
  };
}

/**
 * Soft-archives a product (AC 5.4).
 * Preserves past sales history and foreign key integrity.
 */
export async function archiveStoreProduct(
  storeId: string,
  productId: string
): Promise<{ id: string; name: string; isArchived: boolean }> {
  // backend-check-ignore unscoped-read: query is scoped by storeId and id
  const existing = await db.product.findFirst({
    where: {
      id: productId,
      storeId,
      isArchived: false,
    },
  });

  if (!existing) {
    throw new AppError('NOT_FOUND', `Product ${productId} not found in store`, {
      fields: {
        productId: ['Product does not exist in store inventory'],
      },
    });
  }

  // backend-check-ignore unscoped-write: storeId ownership is strictly validated before mutating
  const updated = await db.product.update({
    where: { id: productId },
    data: { isArchived: true },
  });

  return {
    id: updated.id,
    name: updated.name,
    isArchived: updated.isArchived,
  };
}

/**
 * Enforces Invariant #5: Atomic Conditional Stock Decrement.
 * Uses atomic SQL conditional guard (WHERE stock >= quantity) inside transaction.
 * If zero rows were updated, stock was insufficient or product was missing.
 */
export async function decrementProductStockAtomic(
  storeId: string,
  productId: string,
  quantity: number,
  tx: Prisma.TransactionClient
): Promise<void> {
  const count = await tx.$executeRaw`
    UPDATE products
    SET stock = stock - ${quantity}, updated_at = NOW()
    WHERE id = ${productId}
      AND store_id = ${storeId}
      AND is_archived = false
      AND stock >= ${quantity}
  `;

  if (count === 0) {
    throw new AppError('CONFLICT', `Insufficient stock for product id ${productId}`, {
      fields: {
        stock: [`Requested ${quantity}, but available stock is insufficient`],
      },
    });
  }
}

/**
 * Enforces Invariant #5: Atomic Stock Restoration on Void.
 * Atomically increments product stock by the voided quantity inside transaction.
 */
export async function incrementProductStockAtomic(
  storeId: string,
  productId: string,
  quantity: number,
  tx: Prisma.TransactionClient
): Promise<void> {
  const count = await tx.$executeRaw`
    UPDATE products
    SET stock = stock + ${quantity}, updated_at = NOW()
    WHERE id = ${productId}
      AND store_id = ${storeId}
  `;

  if (count === 0) {
    throw new AppError(
      'NOT_FOUND',
      `Product id ${productId} not found for store ${storeId}`,
      {
        fields: {
          productId: [`Product does not exist in store inventory`],
        },
      }
    );
  }
}
