// src/use-cases/void-sale.ts
import 'server-only';
import { db } from '@/server/db';
import { AppError } from '@/lib/errors';
import { findSaleById, voidSaleRecord } from '@/modules/sales/service';
import { incrementProductStockAtomic } from '@/server/catalog/service';
import { isWithinVoidWindow } from '@/modules/sales/timezone';
import type { SaleWithItems } from '@/modules/sales/types';

export interface VoidSaleInput {
  storeId: string;
  saleId: string;
  now?: Date;
}

/**
 * Executes the 15-minute void sale workflow (AC 4.3).
 * Restores product stock atomically via conditional SQL inside an interactive transaction.
 * Configured with { maxWait: 10000, timeout: 20000 } to avoid pooler timeouts.
 */
export async function executeVoidSale(input: VoidSaleInput): Promise<SaleWithItems> {
  const sale = await findSaleById(input.storeId, input.saleId);

  if (!sale) {
    throw new AppError('NOT_FOUND', 'Sale not found or does not belong to this store');
  }

  if (sale.status === 'VOIDED') {
    throw new AppError('CONFLICT', 'Sale is already voided');
  }

  if (sale.status !== 'COMPLETED') {
    throw new AppError('BAD_REQUEST', 'Only completed sales can be voided');
  }

  const currentInstant = input.now ?? new Date();
  if (!isWithinVoidWindow(sale.createdAt, 15, currentInstant)) {
    throw new AppError('BAD_REQUEST', 'Cannot void sale after 15 minutes have elapsed');
  }

  return db.$transaction(
    async (tx) => {
      // Invariant #5: Atomically restore stock for every item in the sale
      for (const item of sale.items) {
        await incrementProductStockAtomic(
          input.storeId,
          item.productId,
          item.quantity,
          tx,
          sale.id
        );
      }

      // Mark the sale as VOIDED
      return voidSaleRecord(input.storeId, input.saleId, tx);
    },
    { maxWait: 10000, timeout: 20000 }
  );
}
