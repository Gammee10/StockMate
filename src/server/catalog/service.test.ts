import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createStoreProduct,
  updateStoreProduct,
  quickRestockProductAtomic,
  archiveStoreProduct,
  decrementProductStockAtomic,
  incrementProductStockAtomic,
  recordStockMovement,
  listStoreProducts,
} from './service';
import { db } from '@/server/db';
import { AppError } from '@/lib/errors';

vi.mock('@/server/db', () => ({
  db: {
    product: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    $executeRaw: vi.fn(),
  },
}));

describe('Catalog Service: CRUD, Restock & Archival', () => {
  const storeId = 'store_test_catalog_123';
  const productId = 'prod_test_456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createStoreProduct', () => {
    it('creates product with storeId scope and formats ETB display (Invariant #1 & #3)', async () => {
      const mockCreatedProduct = {
        id: productId,
        storeId,
        name: 'Teff Flour 5kg',
        priceCents: 45000,
        stock: 15,
        lowStockThreshold: 5,
        isArchived: false,
        updatedAt: new Date(),
      };

      vi.mocked(db.product.create).mockResolvedValueOnce(mockCreatedProduct as never);

      const result = await createStoreProduct(storeId, {
        name: 'Teff Flour 5kg',
        priceCents: 45000,
        stock: 15,
        lowStockThreshold: 5,
      });

      expect(db.product.create).toHaveBeenCalledWith({
        data: {
          storeId,
          name: 'Teff Flour 5kg',
          priceCents: 45000,
          costCents: null,
          stock: 15,
          lowStockThreshold: 5,
          isArchived: false,
        },
      });

      expect(result).toMatchObject({
        id: productId,
        name: 'Teff Flour 5kg',
        priceCents: 45000,
        priceEtb: '450.00',
        costCents: null,
        stock: 15,
        lowStockThreshold: 5,
        isLowStock: false,
      });
    });

    it('creates product with optional costCents and persists it', async () => {
      vi.mocked(db.product.create).mockResolvedValueOnce({
        id: productId,
        storeId,
        name: 'Cooking Oil 1L',
        priceCents: 25000,
        costCents: 21000,
        stock: 20,
        lowStockThreshold: 5,
        isArchived: false,
        updatedAt: new Date(),
      } as never);

      const result = await createStoreProduct(storeId, {
        name: 'Cooking Oil 1L',
        priceCents: 25000,
        costCents: 21000,
        stock: 20,
        lowStockThreshold: 5,
      });

      expect(db.product.create).toHaveBeenCalledWith({
        data: {
          storeId,
          name: 'Cooking Oil 1L',
          priceCents: 25000,
          costCents: 21000,
          stock: 20,
          lowStockThreshold: 5,
          isArchived: false,
        },
      });

      expect(result.costCents).toBe(21000);
    });

    it('marks isLowStock true when initial stock <= lowStockThreshold', async () => {
      vi.mocked(db.product.create).mockResolvedValueOnce({
        id: productId,
        storeId,
        name: 'Matches',
        priceCents: 500,
        stock: 2,
        lowStockThreshold: 5,
        isArchived: false,
        updatedAt: new Date(),
      } as never);

      const result = await createStoreProduct(storeId, {
        name: 'Matches',
        priceCents: 500,
        stock: 2,
        lowStockThreshold: 5,
      });

      expect(result.isLowStock).toBe(true);
    });
  });

  describe('updateStoreProduct', () => {
    it('updates product scoped by storeId and productId', async () => {
      vi.mocked(db.product.findFirst).mockResolvedValueOnce({
        id: productId,
        storeId,
        isArchived: false,
      } as never);

      vi.mocked(db.product.update).mockResolvedValueOnce({
        id: productId,
        storeId,
        name: 'Updated Sugar 1kg',
        priceCents: 13000,
        stock: 40,
        lowStockThreshold: 5,
        isArchived: false,
        updatedAt: new Date(),
      } as never);

      const result = await updateStoreProduct(storeId, productId, {
        name: 'Updated Sugar 1kg',
        priceCents: 13000,
      });

      expect(db.product.findFirst).toHaveBeenCalledWith({
        where: { id: productId, storeId, isArchived: false },
      });

      expect(db.product.update).toHaveBeenCalledWith({
        where: { id: productId },
        data: {
          name: 'Updated Sugar 1kg',
          priceCents: 13000,
        },
      });

      expect(result.name).toBe('Updated Sugar 1kg');
      expect(result.priceEtb).toBe('130.00');
      expect(result.costCents).toBeNull();
    });

    it('updates costCents when provided in input', async () => {
      vi.mocked(db.product.findFirst).mockResolvedValueOnce({
        id: productId,
        storeId,
        isArchived: false,
      } as never);

      vi.mocked(db.product.update).mockResolvedValueOnce({
        id: productId,
        storeId,
        name: 'Updated Sugar 1kg',
        priceCents: 13000,
        costCents: 11000,
        stock: 40,
        lowStockThreshold: 5,
        isArchived: false,
        updatedAt: new Date(),
      } as never);

      const result = await updateStoreProduct(storeId, productId, {
        costCents: 11000,
      });

      expect(db.product.update).toHaveBeenCalledWith({
        where: { id: productId },
        data: {
          costCents: 11000,
        },
      });

      expect(result.costCents).toBe(11000);
    });

    it('throws NOT_FOUND when product does not exist in store', async () => {
      vi.mocked(db.product.findFirst).mockResolvedValueOnce(null);

      await expect(
        updateStoreProduct(storeId, productId, { name: 'Nonexistent' })
      ).rejects.toThrow(AppError);
    });
  });

  describe('quickRestockProductAtomic', () => {
    it('increments stock using atomic SQL update and returns refreshed product (Invariant #5)', async () => {
      vi.mocked(db.$executeRaw).mockResolvedValueOnce(1); // 1 row updated
      vi.mocked(db.product.findFirst).mockResolvedValueOnce({
        id: productId,
        storeId,
        name: 'Mineral Water 1L',
        priceCents: 3500,
        stock: 25, // 15 + 10 = 25
        lowStockThreshold: 10,
        isArchived: false,
        updatedAt: new Date(),
      } as never);

      const result = await quickRestockProductAtomic(storeId, productId, 10);

      expect(db.$executeRaw).toHaveBeenCalled();
      expect(result).toMatchObject({
        id: productId,
        stock: 25,
        isLowStock: false,
      });
    });

    it('throws NOT_FOUND when atomic update matches 0 rows (invalid product or store)', async () => {
      vi.mocked(db.$executeRaw).mockResolvedValueOnce(0); // 0 rows updated

      await expect(quickRestockProductAtomic(storeId, productId, 10)).rejects.toThrow(
        AppError
      );
    });
  });

  describe('archiveStoreProduct', () => {
    it('soft-archives product (isArchived: true) without hard-deleting (AC 5.4)', async () => {
      vi.mocked(db.product.findFirst).mockResolvedValueOnce({
        id: productId,
        storeId,
        isArchived: false,
      } as never);

      vi.mocked(db.product.update).mockResolvedValueOnce({
        id: productId,
        storeId,
        name: 'Discontinued Snack',
        priceCents: 2000,
        stock: 0,
        lowStockThreshold: 5,
        isArchived: true,
        updatedAt: new Date(),
      } as never);

      const result = await archiveStoreProduct(storeId, productId);

      expect(db.product.update).toHaveBeenCalledWith({
        where: { id: productId },
        data: { isArchived: true },
      });
      expect(result.isArchived).toBe(true);
    });

    it('throws NOT_FOUND when attempting to archive product from another store', async () => {
      vi.mocked(db.product.findFirst).mockResolvedValueOnce(null);

      await expect(archiveStoreProduct(storeId, productId)).rejects.toThrow(AppError);
    });
  });

  describe('recordStockMovement', () => {
    it('creates a stockMovement row via tx.stockMovement.create', async () => {
      const mockTx = {
        stockMovement: {
          create: vi.fn().mockResolvedValueOnce({
            id: 'mov_1',
            storeId,
            productId,
            type: 'SALE',
            quantityDelta: -2,
            stockBefore: 10,
            stockAfter: 8,
            saleId: 'sale_1',
            createdAt: new Date(),
          }),
        },
      };

      const result = await recordStockMovement(mockTx as never, {
        storeId,
        productId,
        type: 'SALE',
        quantityDelta: -2,
        stockBefore: 10,
        stockAfter: 8,
        saleId: 'sale_1',
      });

      expect(mockTx.stockMovement.create).toHaveBeenCalledWith({
        data: {
          storeId,
          productId,
          type: 'SALE',
          quantityDelta: -2,
          stockBefore: 10,
          stockAfter: 8,
          saleId: 'sale_1',
        },
      });
      expect(result.id).toBe('mov_1');
    });
  });

  describe('decrementProductStockAtomic', () => {
    it('executes atomic SQL decrement with RETURNING stock and records SALE movement', async () => {
      const mockTx = {
        $queryRaw: vi.fn().mockResolvedValueOnce([{ stock: 8 }]),
        stockMovement: {
          create: vi.fn().mockResolvedValueOnce({ id: 'mov_sale_1' }),
        },
      };

      const result = await decrementProductStockAtomic(
        storeId,
        productId,
        2,
        mockTx as never,
        'Cooking Oil 1L',
        'sale_123'
      );

      expect(mockTx.$queryRaw).toHaveBeenCalled();
      expect(mockTx.stockMovement.create).toHaveBeenCalledWith({
        data: {
          storeId,
          productId,
          type: 'SALE',
          quantityDelta: -2,
          stockBefore: 10,
          stockAfter: 8,
          saleId: 'sale_123',
        },
      });
      expect(result).toEqual({ stock: 8 });
    });

    it('formats human-readable error with product name when stock is insufficient', async () => {
      const mockTx = {
        $queryRaw: vi.fn().mockResolvedValueOnce([]),
        stockMovement: {
          create: vi.fn(),
        },
      };

      await expect(
        decrementProductStockAtomic(
          storeId,
          productId,
          5,
          mockTx as never,
          'Cooking Oil 1L'
        )
      ).rejects.toThrow('Insufficient stock for "Cooking Oil 1L"');
      expect(mockTx.stockMovement.create).not.toHaveBeenCalled();
    });

    it('falls back to product id when product name is not provided', async () => {
      const mockTx = {
        $queryRaw: vi.fn().mockResolvedValueOnce([]),
        stockMovement: {
          create: vi.fn(),
        },
      };

      await expect(
        decrementProductStockAtomic(storeId, productId, 5, mockTx as never)
      ).rejects.toThrow(`Insufficient stock for product id ${productId}`);
      expect(mockTx.stockMovement.create).not.toHaveBeenCalled();
    });
  });

  describe('incrementProductStockAtomic', () => {
    it('executes atomic SQL increment with RETURNING stock and records VOID_RESTORE movement', async () => {
      const mockTx = {
        $queryRaw: vi.fn().mockResolvedValueOnce([{ stock: 10 }]),
        stockMovement: {
          create: vi.fn().mockResolvedValueOnce({ id: 'mov_void_1' }),
        },
      };

      const result = await incrementProductStockAtomic(
        storeId,
        productId,
        2,
        mockTx as never,
        'sale_123'
      );

      expect(mockTx.$queryRaw).toHaveBeenCalled();
      expect(mockTx.stockMovement.create).toHaveBeenCalledWith({
        data: {
          storeId,
          productId,
          type: 'VOID_RESTORE',
          quantityDelta: 2,
          stockBefore: 8,
          stockAfter: 10,
          saleId: 'sale_123',
        },
      });
      expect(result).toEqual({ stock: 10 });
    });

    it('throws NOT_FOUND when atomic update matches 0 rows (invalid product or store)', async () => {
      const mockTx = {
        $queryRaw: vi.fn().mockResolvedValueOnce([]),
        stockMovement: {
          create: vi.fn(),
        },
      };

      await expect(
        incrementProductStockAtomic(storeId, productId, 2, mockTx as never, 'sale_123')
      ).rejects.toThrow(`Product id ${productId} not found for store ${storeId}`);
      expect(mockTx.stockMovement.create).not.toHaveBeenCalled();
    });
  });

  describe('listStoreProducts', () => {
    it('scopes findMany strictly to storeId, excludes archived items, and caps limit at 100', async () => {
      const mockProducts = [
        {
          id: 'p1',
          name: 'Cooking Oil 1L',
          priceCents: 25000,
          stock: 12,
          lowStockThreshold: 5,
        },
        {
          id: 'p2',
          name: 'Sugar 1kg',
          priceCents: 10000,
          stock: 4,
          lowStockThreshold: 5,
        },
      ];

      vi.mocked(db.product.findMany).mockResolvedValueOnce(mockProducts as never);

      const result = await listStoreProducts(storeId, { limit: 150 });

      expect(db.product.findMany).toHaveBeenCalledWith({
        where: {
          storeId,
          isArchived: false,
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        take: 100, // Capped at 100
      });

      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toEqual({
        id: 'p1',
        name: 'Cooking Oil 1L',
        priceCents: 25000,
        priceEtb: '250.00',
        costCents: null,
        stock: 12,
        lowStockThreshold: 5,
        isLowStock: false,
      });
      expect(result.items[1].isLowStock).toBe(true);
      expect(result.nextCursor).toBeNull();
    });

    it('passes search query q and cursor with skip: 1', async () => {
      vi.mocked(db.product.findMany).mockResolvedValueOnce([]);

      await listStoreProducts(storeId, {
        q: 'oil',
        cursor: 'p1',
        limit: 20,
      });

      expect(db.product.findMany).toHaveBeenCalledWith({
        where: {
          storeId,
          isArchived: false,
          name: { contains: 'oil', mode: 'insensitive' },
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        take: 20,
        cursor: { id: 'p1' },
        skip: 1,
      });
    });

    it('returns nextCursor as the last item id when items count equals limit', async () => {
      const mockProducts = Array.from({ length: 5 }, (_, i) => ({
        id: `p-${i + 1}`,
        name: `Product ${i + 1}`,
        priceCents: 1000,
        stock: 10,
        lowStockThreshold: 5,
      }));

      vi.mocked(db.product.findMany).mockResolvedValueOnce(mockProducts as never);

      const result = await listStoreProducts(storeId, { limit: 5 });

      expect(result.items).toHaveLength(5);
      expect(result.nextCursor).toBe('p-5');
    });
  });
});
