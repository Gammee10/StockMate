import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createStoreProduct,
  updateStoreProduct,
  quickRestockProductAtomic,
  archiveStoreProduct,
  decrementProductStockAtomic,
} from './service';
import { db } from '@/server/db';
import { AppError } from '@/lib/errors';

vi.mock('@/server/db', () => ({
  db: {
    product: {
      create: vi.fn(),
      findFirst: vi.fn(),
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
        stock: 15,
        lowStockThreshold: 5,
        isLowStock: false,
      });
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

  describe('decrementProductStockAtomic', () => {
    it('executes atomic SQL decrement inside transaction', async () => {
      const mockTx = {
        $executeRaw: vi.fn().mockResolvedValueOnce(1),
      };

      await decrementProductStockAtomic(storeId, productId, 2, mockTx as never);

      expect(mockTx.$executeRaw).toHaveBeenCalled();
    });

    it('formats human-readable error with product name when stock is insufficient', async () => {
      const mockTx = {
        $executeRaw: vi.fn().mockResolvedValueOnce(0),
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
    });

    it('falls back to product id when product name is not provided', async () => {
      const mockTx = {
        $executeRaw: vi.fn().mockResolvedValueOnce(0),
      };

      await expect(
        decrementProductStockAtomic(storeId, productId, 5, mockTx as never)
      ).rejects.toThrow(`Insufficient stock for product id ${productId}`);
    });
  });
});
