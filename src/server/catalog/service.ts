// src/server/catalog/service.ts
import 'server-only';
import type { Prisma } from '@prisma/client';
import { db } from '@/server/db';
import { AppError } from '@/lib/errors';

type DbOrTx = typeof db | Prisma.TransactionClient;

export async function getProductsCatalog(limit = 50) {
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

export async function getStoreProducts(storeId: string, limit = 100) {
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
    throw new AppError(
      'CONFLICT',
      `Insufficient stock for product id ${productId}`,
      {
        fields: {
          stock: [`Requested ${quantity}, but available stock is insufficient`],
        },
      }
    );
  }
}
