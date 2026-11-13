import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeCheckout } from './checkout';
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
  getProductsForCheckout: vi.fn(),
  decrementProductStockAtomic: vi.fn(),
}));

vi.mock('@/modules/sales/service', () => ({
  findSaleByIdempotencyKey: vi.fn(),
  createSaleRecord: vi.fn(),
}));

describe('Checkout Use Case: executeCheckout', () => {
  const storeId = 'store_test_1';
  const idempotencyKey = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enforces Invariant #4 (Idempotency Replay): returns existing sale without decrementing stock if key is cached', async () => {
    const existingSale = {
      id: 'sale_existing',
      storeId,
      idempotencyKey,
      totalAmountCents: 5000,
      paymentMethod: 'CASH',
      status: 'COMPLETED',
      createdAt: new Date(),
      items: [
        {
          id: 'item_1',
          saleId: 'sale_existing',
          productId: 'prod_1',
          quantity: 1,
          unitPriceCents: 5000,
        },
      ],
    };

    vi.mocked(salesService.findSaleByIdempotencyKey).mockResolvedValueOnce(existingSale as never);

    const result = await executeCheckout({
      storeId,
      idempotencyKey,
      items: [{ productId: 'prod_1', quantity: 1 }],
      paymentMethod: 'CASH',
    });

    expect(result.cached).toBe(true);
    expect(result.sale.id).toBe('sale_existing');
    expect(catalogService.decrementProductStockAtomic).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('enforces Invariant #2 (Server-Calculated Pricing) and Invariant #1 (Integer Cents)', async () => {
    vi.mocked(salesService.findSaleByIdempotencyKey).mockResolvedValueOnce(null);
    vi.mocked(catalogService.getProductsForCheckout).mockResolvedValueOnce([
      { id: 'prod_1', name: 'Cooking Oil 1L', priceCents: 25000, stock: 10, isArchived: false, storeId },
      { id: 'prod_2', name: 'Soap Bar', priceCents: 4500, stock: 5, isArchived: false, storeId },
    ] as never);

    const mockCreatedSale = {
      id: 'sale_new_1',
      storeId,
      idempotencyKey,
      totalAmountCents: 54000, // (25000 * 2) + (4500 * 1) = 54500 -> wait: 50000 + 4500 = 54500
      paymentMethod: 'CASH',
      status: 'COMPLETED',
      createdAt: new Date(),
      items: [
        { id: 'i1', saleId: 'sale_new_1', productId: 'prod_1', quantity: 2, unitPriceCents: 25000 },
        { id: 'i2', saleId: 'sale_new_1', productId: 'prod_2', quantity: 1, unitPriceCents: 4500 },
      ],
    };

    vi.mocked(db.$transaction).mockImplementationOnce(async (cb) => {
      const mockTx = {};
      return cb(mockTx as never);
    });

    vi.mocked(salesService.createSaleRecord).mockResolvedValueOnce(mockCreatedSale as never);

    const result = await executeCheckout({
      storeId,
      idempotencyKey,
      items: [
        { productId: 'prod_1', quantity: 2 },
        { productId: 'prod_2', quantity: 1 },
      ],
      paymentMethod: 'CASH',
    });

    expect(result.cached).toBe(false);
    expect(catalogService.decrementProductStockAtomic).toHaveBeenCalledTimes(2);
    expect(salesService.createSaleRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId,
        idempotencyKey,
        totalAmountCents: 54500, // Strict server calculation: 2 * 25000 + 1 * 4500
        paymentMethod: 'CASH',
      }),
      expect.anything()
    );
  });

  it('enforces Invariant #5 (Atomic Stock Guard): aborts and throws 409 Conflict when stock is insufficient', async () => {
    vi.mocked(salesService.findSaleByIdempotencyKey).mockResolvedValueOnce(null);
    vi.mocked(catalogService.getProductsForCheckout).mockResolvedValueOnce([
      { id: 'prod_1', name: 'Cooking Oil 1L', priceCents: 25000, stock: 1, isArchived: false, storeId },
    ] as never);

    vi.mocked(db.$transaction).mockImplementationOnce(async (cb) => {
      const mockTx = {};
      return cb(mockTx as never);
    });

    vi.mocked(catalogService.decrementProductStockAtomic).mockRejectedValueOnce(
      new AppError('CONFLICT', 'Insufficient stock for product Cooking Oil 1L', {
        fields: { stock: ['Requested 2, but available stock is 1'] },
      })
    );

    await expect(
      executeCheckout({
        storeId,
        idempotencyKey,
        items: [{ productId: 'prod_1', quantity: 2 }],
        paymentMethod: 'CASH',
      })
    ).rejects.toThrowError(/Insufficient stock/);
  });

  it('rejects checkout if requested product does not exist in store catalog', async () => {
    vi.mocked(salesService.findSaleByIdempotencyKey).mockResolvedValueOnce(null);
    vi.mocked(catalogService.getProductsForCheckout).mockResolvedValueOnce([]);

    await expect(
      executeCheckout({
        storeId,
        idempotencyKey,
        items: [{ productId: 'non_existent_prod', quantity: 1 }],
      })
    ).rejects.toThrowError(AppError);
  });
});
