import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  voidSaleRecord,
  findSaleByIdempotencyKey,
  findSaleById,
  getTodaySalesSummary,
  getTodayRecentSales,
  createSaleRecord,
} from './service';
import { db } from '@/server/db';
import { AppError } from '@/lib/errors';

const { mockSale } = vi.hoisted(() => {
  const mockSale = {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
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

describe('Sales Service: Store Isolation & Database Queries', () => {
  const storeId = 'store_test_service_1';
  const saleId = 'sale_test_service_1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('voidSaleRecord', () => {
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

  describe('findSaleByIdempotencyKey', () => {
    it('queries sale strictly scoped by compound unique storeId and idempotencyKey', async () => {
      mockSale.findUnique.mockResolvedValueOnce({ id: saleId, storeId });

      const result = await findSaleByIdempotencyKey(storeId, 'idem_key_1', db as never);

      expect(mockSale.findUnique).toHaveBeenCalledWith({
        where: {
          storeId_idempotencyKey: {
            storeId,
            idempotencyKey: 'idem_key_1',
          },
        },
        include: {
          items: true,
        },
      });
      expect(result).toEqual({ id: saleId, storeId });
    });
  });

  describe('findSaleById', () => {
    it('queries sale strictly scoped by id and storeId', async () => {
      mockSale.findFirst.mockResolvedValueOnce({ id: saleId, storeId });

      const result = await findSaleById(storeId, saleId, db as never);

      expect(mockSale.findFirst).toHaveBeenCalledWith({
        where: {
          id: saleId,
          storeId,
        },
        include: {
          items: true,
        },
      });
      expect(result).toEqual({ id: saleId, storeId });
    });
  });

  describe('getTodaySalesSummary', () => {
    it('aggregates sales strictly scoped by storeId and startOfDayUtc', async () => {
      mockSale.groupBy.mockResolvedValueOnce([
        {
          status: 'COMPLETED',
          paymentMethod: 'CASH',
          _sum: { totalAmountCents: 5000 },
          _count: { id: 1 },
        },
      ]);
      const startOfDay = new Date('2026-11-19T00:00:00.000Z');

      const summary = await getTodaySalesSummary(storeId, startOfDay, db as never);

      expect(mockSale.groupBy).toHaveBeenCalledWith({
        by: ['status', 'paymentMethod'],
        where: {
          storeId,
          createdAt: {
            gte: startOfDay,
          },
        },
        _sum: {
          totalAmountCents: true,
        },
        _count: {
          id: true,
        },
      });
      expect(summary.totalRevenueCents).toBe(5000);
      expect(summary.cashRevenueCents).toBe(5000);
    });
  });

  describe('getTodayRecentSales', () => {
    it('queries recent sales strictly scoped by storeId and startOfDayUtc with bounded limit', async () => {
      mockSale.findMany.mockResolvedValueOnce([]);
      const startOfDay = new Date('2026-11-19T00:00:00.000Z');

      await getTodayRecentSales(storeId, startOfDay, 50, db as never);

      expect(mockSale.findMany).toHaveBeenCalledWith({
        where: {
          storeId,
          createdAt: {
            gte: startOfDay,
          },
        },
        include: {
          items: {
            include: {
              product: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 50,
      });
    });
  });

  describe('createSaleRecord', () => {
    it('creates sale record strictly bound to storeId', async () => {
      mockSale.create.mockResolvedValueOnce({ id: 'sale_created', storeId });

      await createSaleRecord(
        {
          storeId,
          idempotencyKey: 'idem_key_1',
          totalAmountCents: 5000,
          paymentMethod: 'CASH',
          items: [{ productId: 'p1', quantity: 1, unitPriceCents: 5000 }],
        },
        db as never
      );

      expect(mockSale.create).toHaveBeenCalledWith({
        data: {
          storeId,
          idempotencyKey: 'idem_key_1',
          totalAmountCents: 5000,
          paymentMethod: 'CASH',
          items: {
            create: [{ productId: 'p1', quantity: 1, unitPriceCents: 5000 }],
          },
        },
        include: {
          items: true,
        },
      });
    });
  });
});
