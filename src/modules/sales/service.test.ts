import { describe, it, expect, vi, beforeEach } from 'vitest';
import { voidSaleRecord } from './service';
import { db } from '@/server/db';
import { AppError } from '@/lib/errors';

const { mockSale } = vi.hoisted(() => {
  const mockSale = {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    groupBy: vi.fn(),
    create: vi.fn(),
  };
  return { mockSale };
});

vi.mock('@/server/db', () => ({
  db: {
    sale: mockSale,
  },
}));

describe('Sales Service: voidSaleRecord (Task 2.1)', () => {
  const storeId = 'store_test_service_1';
  const saleId = 'sale_test_service_1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('atomically transitions status to VOIDED via scoped updateMany and returns updated sale', async () => {
    mockSale.updateMany.mockResolvedValueOnce({ count: 1 });
    const updatedSaleData = {
      id: saleId,
      storeId,
      status: 'VOIDED',
      totalAmountCents: 15000,
      paymentMethod: 'CASH',
      items: [
        {
          id: 'item_1',
          productId: 'prod_1',
          quantity: 2,
          unitPriceCents: 7500,
        },
      ],
    };
    mockSale.findFirst.mockResolvedValueOnce(updatedSaleData);

    const result = await voidSaleRecord(storeId, saleId, db as never);

    // Verified: updateMany requires id, storeId, and status: 'COMPLETED'
    expect(mockSale.updateMany).toHaveBeenCalledWith({
      where: {
        id: saleId,
        storeId,
        status: 'COMPLETED',
      },
      data: {
        status: 'VOIDED',
      },
    });

    // Verified: reads back via findSaleById
    expect(mockSale.findFirst).toHaveBeenCalledWith({
      where: {
        id: saleId,
        storeId,
      },
      include: {
        items: true,
      },
    });

    expect(result).toEqual(updatedSaleData);
  });

  it('throws CONFLICT AppError when updateMany count is 0 (already voided or concurrent race)', async () => {
    mockSale.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(voidSaleRecord(storeId, saleId, db as never)).rejects.toThrowError(
      new AppError('CONFLICT', 'Sale is already voided')
    );

    // findFirst should not be called if update failed
    expect(mockSale.findFirst).not.toHaveBeenCalled();
  });

  it('throws NOT_FOUND AppError if sale cannot be retrieved after status transition', async () => {
    mockSale.updateMany.mockResolvedValueOnce({ count: 1 });
    mockSale.findFirst.mockResolvedValueOnce(null);

    await expect(voidSaleRecord(storeId, saleId, db as never)).rejects.toThrowError(
      new AppError('NOT_FOUND', 'Sale not found or does not belong to this store')
    );
  });
});
