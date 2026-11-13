// src/use-cases/checkout.ts
import 'server-only';
import { db } from '@/server/db';
import { AppError } from '@/lib/errors';
import { isUniqueViolation } from '@/server/errors';
import {
  findSaleByIdempotencyKey,
  createSaleRecord,
} from '@/modules/sales/service';
import {
  getProductsForCheckout,
  decrementProductStockAtomic,
} from '@/server/catalog/service';
import type { CheckoutInput, CheckoutResult } from '@/modules/sales/types';

export async function executeCheckout(
  input: CheckoutInput
): Promise<CheckoutResult> {
  const { storeId, idempotencyKey, items, paymentMethod = 'CASH' } = input;

  // 1. Invariant #4: Check if sale was already completed with this idempotency key
  const existingSale = await findSaleByIdempotencyKey(storeId, idempotencyKey);
  if (existingSale) {
    return {
      cached: true,
      sale: existingSale,
    };
  }

  // 2. Load catalog products to strictly calculate prices on server (Invariant #2)
  const productIds = items.map((item) => item.productId);
  const products = await getProductsForCheckout(storeId, productIds);

  const productMap = new Map(products.map((p) => [p.id, p]));
  for (const item of items) {
    if (!productMap.has(item.productId)) {
      throw new AppError(
        'NOT_FOUND',
        `Product ${item.productId} not found in store catalog.`
      );
    }
  }

  // 3. Compute server-side totals in integer cents (Invariant #1)
  let totalAmountCents = 0;
  const lineItems = items.map((item) => {
    const product = productMap.get(item.productId)!;
    const unitPriceCents = product.priceCents;
    totalAmountCents += unitPriceCents * item.quantity;

    return {
      productId: item.productId,
      quantity: item.quantity,
      unitPriceCents,
    };
  });

  // 4. Invariant #5: Execute atomic conditional stock decrement and sale creation in transaction
  try {
    const sale = await db.$transaction(async (tx) => {
      // 4a. Atomically decrement stock for each line item (UPDATE ... WHERE stock >= quantity)
      for (const item of items) {
        await decrementProductStockAtomic(
          storeId,
          item.productId,
          item.quantity,
          tx
        );
      }

      // 4b. Create sale & sale items
      return await createSaleRecord(
        {
          storeId,
          idempotencyKey,
          totalAmountCents,
          paymentMethod,
          items: lineItems,
        },
        tx
      );
    });

    return {
      cached: false,
      sale,
    };
  } catch (err) {
    // If concurrent requests raced with identical idempotencyKey, return the winner's sale
    if (isUniqueViolation(err)) {
      const winnerSale = await findSaleByIdempotencyKey(
        storeId,
        idempotencyKey
      );
      if (winnerSale) {
        return {
          cached: true,
          sale: winnerSale,
        };
      }
    }
    throw err;
  }
}
