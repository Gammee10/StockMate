// src/server/catalog/service.ts
import 'server-only';
import type { Prisma, StockMovement } from '@prisma/client';
import { db } from '@/server/db';
import { AppError } from '@/lib/errors';
import type {
  CreateProductInput,
  UpdateProductInput,
  CatalogProductView,
  ListStoreProductsOptions,
  ListProductsResult,
  RecordStockMovementInput,
} from './types';

type DbOrTx = typeof db | Prisma.TransactionClient;

/**
 * Returns a paginated slice of active products strictly scoped to the store (Invariant #3).
 * Supports cursor-based pagination and optional case-insensitive substring search.
 */
export async function listStoreProducts(
  storeId: string,
  options: ListStoreProductsOptions = {}
): Promise<ListProductsResult> {
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 100);
  const cursor = options.cursor?.trim();
  const q = options.q?.trim();

  const where: Prisma.ProductWhereInput = {
    storeId,
    isArchived: false,
    ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
  };

  const products = await db.product.findMany({
    where,
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const items: CatalogProductView[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    priceCents: p.priceCents,
    priceEtb: (p.priceCents / 100).toFixed(2),
    costCents: p.costCents ?? null,
    stock: p.stock,
    lowStockThreshold: p.lowStockThreshold,
    isLowStock: p.stock <= p.lowStockThreshold,
  }));

  const nextCursor = items.length === limit ? items[items.length - 1].id : null;

  return { items, nextCursor };
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
 * Records INITIAL stock movement if initial stock > 0 (Task 1.5b).
 */
export async function createStoreProduct(
  storeId: string,
  input: CreateProductInput
): Promise<CatalogProductView> {
  const lowStockThreshold = input.lowStockThreshold ?? 5;

  return db.$transaction(
    async (tx) => {
      const product = await tx.product.create({
        data: {
          storeId,
          name: input.name,
          priceCents: input.priceCents,
          costCents: input.costCents ?? null,
          stock: input.stock,
          lowStockThreshold,
          isArchived: false,
        },
      });

      if (input.stock > 0) {
        await recordStockMovement(tx, {
          storeId,
          productId: product.id,
          type: 'INITIAL',
          quantityDelta: input.stock,
          stockBefore: 0,
          stockAfter: input.stock,
        });
      }

      return {
        id: product.id,
        name: product.name,
        priceCents: product.priceCents,
        priceEtb: (product.priceCents / 100).toFixed(2),
        costCents: product.costCents ?? null,
        stock: product.stock,
        lowStockThreshold: product.lowStockThreshold,
        isLowStock: product.stock <= product.lowStockThreshold,
      };
    },
    { maxWait: 10000, timeout: 20000 }
  );
}

/**
 * Updates product details scoped by storeId (AC 5.2).
 * Locks row with FOR UPDATE on stock changes and writes ADJUSTMENT movement (Task 1.5b).
 */
export async function updateStoreProduct(
  storeId: string,
  productId: string,
  input: UpdateProductInput
): Promise<CatalogProductView> {
  return db.$transaction(
    async (tx) => {
      let stockDelta: { before: number; after: number; delta: number } | null = null;

      if (input.stock !== undefined) {
        const rows = await tx.$queryRaw<Array<{ stock: number }>>`
          SELECT stock FROM products
          WHERE id = ${productId} AND store_id = ${storeId} AND is_archived = false
          FOR UPDATE
        `;

        if (!rows || rows.length === 0) {
          throw new AppError('NOT_FOUND', `Product ${productId} not found in store`, {
            fields: {
              productId: ['Product does not exist in store inventory'],
            },
          });
        }

        const stockBefore = rows[0].stock;
        const stockAfter = input.stock;
        const delta = stockAfter - stockBefore;
        if (delta !== 0) {
          stockDelta = { before: stockBefore, after: stockAfter, delta };
        }
      } else {
        // backend-check-ignore unscoped-read: query is scoped by storeId and id
        const existing = await tx.product.findFirst({
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
      }

      const updateData: {
        name?: string;
        priceCents?: number;
        costCents?: number | null;
        stock?: number;
        lowStockThreshold?: number;
        isArchived?: boolean;
      } = {};

      if (input.name !== undefined) updateData.name = input.name;
      if (input.priceCents !== undefined) updateData.priceCents = input.priceCents;
      if (input.costCents !== undefined) updateData.costCents = input.costCents;
      if (input.stock !== undefined) updateData.stock = input.stock;
      if (input.lowStockThreshold !== undefined)
        updateData.lowStockThreshold = input.lowStockThreshold;
      if (input.isArchived !== undefined) updateData.isArchived = input.isArchived;

      // backend-check-ignore unscoped-write: updateMany is strictly scoped by id and storeId
      const updateResult = await tx.product.updateMany({
        where: { id: productId, storeId },
        data: updateData,
      });

      if (updateResult.count === 0) {
        throw new AppError('NOT_FOUND', `Product ${productId} not found in store`, {
          fields: {
            productId: ['Product does not exist in store inventory'],
          },
        });
      }

      // backend-check-ignore unscoped-read: query is scoped by storeId and id
      const updated = await tx.product.findFirst({
        where: { id: productId, storeId },
      });

      if (!updated) {
        throw new AppError('NOT_FOUND', `Product ${productId} not found in store`, {
          fields: {
            productId: ['Product does not exist in store inventory'],
          },
        });
      }

      if (stockDelta) {
        await recordStockMovement(tx, {
          storeId,
          productId,
          type: 'ADJUSTMENT',
          quantityDelta: stockDelta.delta,
          stockBefore: stockDelta.before,
          stockAfter: stockDelta.after,
        });
      }

      return {
        id: updated.id,
        name: updated.name,
        priceCents: updated.priceCents,
        priceEtb: (updated.priceCents / 100).toFixed(2),
        costCents: updated.costCents ?? null,
        stock: updated.stock,
        lowStockThreshold: updated.lowStockThreshold,
        isLowStock: updated.stock <= updated.lowStockThreshold,
      };
    },
    { maxWait: 10000, timeout: 20000 }
  );
}

/**
 * Quick restock product atomically (AC 5.3).
 * Enforces Invariant #5: Uses atomic SQL increment to prevent race conditions.
 * Uses RETURNING stock and records RESTOCK stock movement (Task 1.5b).
 */
export async function quickRestockProductAtomic(
  storeId: string,
  productId: string,
  quantity: number
): Promise<CatalogProductView> {
  return db.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<Array<{ stock: number }>>`
        UPDATE products
        SET stock = stock + ${quantity}, updated_at = NOW()
        WHERE id = ${productId}
          AND store_id = ${storeId}
          AND is_archived = false
        RETURNING stock
      `;

      if (!rows || rows.length === 0) {
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

      const stockAfter = rows[0].stock;
      const stockBefore = stockAfter - quantity;

      await recordStockMovement(tx, {
        storeId,
        productId,
        type: 'RESTOCK',
        quantityDelta: quantity,
        stockBefore,
        stockAfter,
      });

      // backend-check-ignore unscoped-read: query is scoped by storeId and id
      const product = await tx.product.findFirst({
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
        costCents: product.costCents ?? null,
        stock: product.stock,
        lowStockThreshold: product.lowStockThreshold,
        isLowStock: product.stock <= product.lowStockThreshold,
      };
    },
    { maxWait: 10000, timeout: 20000 }
  );
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

  // backend-check-ignore unscoped-write: updateMany is strictly scoped by id, storeId, and isArchived
  const updateResult = await db.product.updateMany({
    where: {
      id: productId,
      storeId,
      isArchived: false,
    },
    data: { isArchived: true },
  });

  if (updateResult.count === 0) {
    throw new AppError('NOT_FOUND', `Product ${productId} not found in store`, {
      fields: {
        productId: ['Product does not exist in store inventory'],
      },
    });
  }

  return {
    id: existing.id,
    name: existing.name,
    isArchived: true,
  };
}

/**
 * Records an append-only stock movement entry (Task 1.5a).
 * Catalog module owns inventory mutations and history records.
 */
export async function recordStockMovement(
  tx: Prisma.TransactionClient,
  input: RecordStockMovementInput
): Promise<StockMovement> {
  return tx.stockMovement.create({
    data: {
      storeId: input.storeId,
      productId: input.productId,
      type: input.type,
      quantityDelta: input.quantityDelta,
      stockBefore: input.stockBefore,
      stockAfter: input.stockAfter,
      saleId: input.saleId ?? null,
    },
  });
}

/**
 * Enforces Invariant #5: Atomic Conditional Stock Decrement.
 * Uses atomic SQL conditional guard (WHERE stock >= quantity) inside transaction.
 * Uses RETURNING stock to compute delta and record SALE stock movement.
 * If zero rows were updated, stock was insufficient or product was missing.
 */
export async function decrementProductStockAtomic(
  storeId: string,
  productId: string,
  quantity: number,
  tx: Prisma.TransactionClient,
  productName?: string,
  saleId?: string
): Promise<{ stock: number }> {
  const rows = await tx.$queryRaw<Array<{ stock: number }>>`
    UPDATE products
    SET stock = stock - ${quantity}, updated_at = NOW()
    WHERE id = ${productId}
      AND store_id = ${storeId}
      AND is_archived = false
      AND stock >= ${quantity}
    RETURNING stock
  `;

  if (!rows || rows.length === 0) {
    const itemLabel = productName ? `"${productName}"` : `product id ${productId}`;
    throw new AppError('CONFLICT', `Insufficient stock for ${itemLabel}`, {
      fields: {
        stock: [`Requested ${quantity}, but available stock is insufficient`],
      },
    });
  }

  const stockAfter = rows[0].stock;
  const stockBefore = stockAfter + quantity;

  await recordStockMovement(tx, {
    storeId,
    productId,
    type: 'SALE',
    quantityDelta: -quantity,
    stockBefore,
    stockAfter,
    saleId,
  });

  return { stock: stockAfter };
}

/**
 * Enforces Invariant #5: Atomic Stock Restoration on Void.
 * Atomically increments product stock by the voided quantity inside transaction.
 * Uses RETURNING stock to compute delta and record VOID_RESTORE stock movement.
 */
export async function incrementProductStockAtomic(
  storeId: string,
  productId: string,
  quantity: number,
  tx: Prisma.TransactionClient,
  saleId?: string
): Promise<{ stock: number }> {
  const rows = await tx.$queryRaw<Array<{ stock: number }>>`
    UPDATE products
    SET stock = stock + ${quantity}, updated_at = NOW()
    WHERE id = ${productId}
      AND store_id = ${storeId}
    RETURNING stock
  `;

  if (!rows || rows.length === 0) {
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

  const stockAfter = rows[0].stock;
  const stockBefore = stockAfter - quantity;

  await recordStockMovement(tx, {
    storeId,
    productId,
    type: 'VOID_RESTORE',
    quantityDelta: quantity,
    stockBefore,
    stockAfter,
    saleId,
  });

  return { stock: stockAfter };
}
