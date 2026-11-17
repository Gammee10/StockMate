import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeVoidSale } from './void-sale';
import { AppError } from '@/lib/errors';
import { db } from '@/server/db';
import * as catalogService from '@/server/catalog/service';
import * as salesService from '@/modules/sales/service';

vi.mock('@/server/db', () => ({
  db: {
    $transaction: vi.fn(),
  },
}));

vi.mock('@/server/catalog/service', () => ({
  incrementProductStockAtomic: vi.fn(),
}));

vi.mock('@/modules/sales/service', () => ({
  findSaleById: vi.fn(),
  voidSaleRecord: vi.fn(),
}));

describe('Void Sale Use Case: executeVoidSale', () => {
  const storeId = 'store_test_void_1';
  const saleId = 'sale_test_123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('atomically restores inventory and voids sale within 15-minute window (Invariant #5, AC 4.3)', async () => {
    const freshCreatedAt = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
    const existingSale = {
      id: saleId,
      storeId,
      idempotencyKey: 'idemp_1',
      totalAmountCents: 50000,
      paymentMethod: 'CASH',
      status: 'COMPLETED',
      createdAt: freshCreatedAt,
      items: [
        {
          id: 'item_1',
          saleId,
          productId: 'prod_1',
          quantity: 2,
          unitPriceCents: 25000,
        },
        {
          id: 'item_2',
          saleId,
          productId: 'prod_2',
          quantity: 1,
          unitPriceCents: 5000,
        },
      ],
    };

    const voidedSale = {
      ...existingSale,
      status: 'VOIDED',
      updatedAt: new Date(),
    };

    vi.mocked(salesService.findSaleById).mockResolvedValueOnce(existingSale as never);

    vi.mocked(db.$transaction).mockImplementationOnce(async (cb, options) => {
      // Ensure resilience timeout options are passed to prevent pooler timeouts
      expect(options).toEqual(
        expect.objectContaining({ maxWait: 10000, timeout: 20000 })
      );
      const mockTx = {};
      return cb(mockTx as never);
    });

    vi.mocked(salesService.voidSaleRecord).mockResolvedValueOnce(voidedSale as never);

    const result = await executeVoidSale({ storeId, saleId });

    expect(result.status).toBe('VOIDED');
    // Invariant #5: Inventory restored atomically for each line item
    expect(catalogService.incrementProductStockAtomic).toHaveBeenCalledTimes(2);
    expect(catalogService.incrementProductStockAtomic).toHaveBeenCalledWith(
      storeId,
      'prod_1',
      2,
      expect.anything()
    );
    expect(catalogService.incrementProductStockAtomic).toHaveBeenCalledWith(
      storeId,
      'prod_2',
      1,
      expect.anything()
    );
    expect(salesService.voidSaleRecord).toHaveBeenCalledWith(
      storeId,
      saleId,
      expect.anything()
    );
  });

  it('rejects voiding if sale was completed more than 15 minutes ago (AC 4.3)', async () => {
    const expiredCreatedAt = new Date(Date.now() - 16 * 60 * 1000); // 16 minutes ago
    const existingSale = {
      id: saleId,
      storeId,
      idempotencyKey: 'idemp_expired',
      totalAmountCents: 5000,
      paymentMethod: 'CASH',
      status: 'COMPLETED',
      createdAt: expiredCreatedAt,
      items: [{ id: 'item_1', saleId, productId: 'prod_1', quantity: 1, unitPriceCents: 5000 }],
    };

    vi.mocked(salesService.findSaleById).mockResolvedValueOnce(existingSale as never);

    await expect(
      executeVoidSale({ storeId, saleId })
    ).rejects.toThrowError(AppError);

    expect(db.$transaction).not.toHaveBeenCalled();
    expect(catalogService.incrementProductStockAtomic).not.toHaveBeenCalled();
  });

  it('rejects voiding if sale is already VOIDED (409 Conflict)', async () => {
    const freshCreatedAt = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago
    const alreadyVoidedSale = {
      id: saleId,
      storeId,
      idempotencyKey: 'idemp_voided',
      totalAmountCents: 5000,
      paymentMethod: 'CASH',
      status: 'VOIDED',
      createdAt: freshCreatedAt,
      items: [{ id: 'item_1', saleId, productId: 'prod_1', quantity: 1, unitPriceCents: 5000 }],
    };

    vi.mocked(salesService.findSaleById).mockResolvedValueOnce(alreadyVoidedSale as never);

    await expect(
      executeVoidSale({ storeId, saleId })
    ).rejects.toThrowError(AppError);

    expect(db.$transaction).not.toHaveBeenCalled();
    expect(catalogService.incrementProductStockAtomic).not.toHaveBeenCalled();
  });

  it('rejects voiding if sale does not exist or belongs to another store (404 Not Found)', async () => {
    vi.mocked(salesService.findSaleById).mockResolvedValueOnce(null);

    await expect(
      executeVoidSale({ storeId, saleId })
    ).rejects.toThrowError(AppError);

    expect(db.$transaction).not.toHaveBeenCalled();
    expect(catalogService.incrementProductStockAtomic).not.toHaveBeenCalled();
  });
});
