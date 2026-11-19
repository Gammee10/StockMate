import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkProductionSeedGuard,
  cleanDemoData,
  seedDemoData,
  DEMO_PHONE,
  DEMO_PIN,
} from '../../prisma/seed';
import type { PrismaClient } from '@prisma/client';

describe('Seed Script Safety Guard & Scoped Deletions', () => {
  describe('checkProductionSeedGuard', () => {
    it('allows execution in non-production environments', () => {
      expect(checkProductionSeedGuard({})).toBe(true);
      expect(checkProductionSeedGuard({ NODE_ENV: 'development' })).toBe(true);
      expect(checkProductionSeedGuard({ NODE_ENV: 'test' })).toBe(true);
    });

    it('blocks execution in production when ALLOW_DEMO_SEED is not set', () => {
      expect(checkProductionSeedGuard({ NODE_ENV: 'production' })).toBe(false);
      expect(
        checkProductionSeedGuard({ NODE_ENV: 'production', ALLOW_DEMO_SEED: 'false' })
      ).toBe(false);
      expect(
        checkProductionSeedGuard({ NODE_ENV: 'production', ALLOW_DEMO_SEED: '0' })
      ).toBe(false);
    });

    it('allows execution in production ONLY when ALLOW_DEMO_SEED is explicitly "true"', () => {
      expect(
        checkProductionSeedGuard({ NODE_ENV: 'production', ALLOW_DEMO_SEED: 'true' })
      ).toBe(true);
    });
  });

  describe('cleanDemoData (Scoped Deletion)', () => {
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        user: {
          findUnique: vi.fn(),
          delete: vi.fn(),
        },
        store: {
          deleteMany: vi.fn(),
        },
        product: {
          deleteMany: vi.fn(),
        },
        sale: {
          deleteMany: vi.fn(),
        },
        saleItem: {
          deleteMany: vi.fn(),
        },
        stockMovement: {
          deleteMany: vi.fn(),
        },
      };
    });

    it('safely performs no deletions when demo user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      await cleanDemoData(mockPrisma as unknown as PrismaClient);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { phone: DEMO_PHONE },
        include: { stores: true },
      });
      expect(mockPrisma.stockMovement.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.saleItem.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.sale.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.product.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.store.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.user.delete).not.toHaveBeenCalled();
    });

    it('strictly scopes deletions to the demo user and their stores in proper relational order', async () => {
      const demoUser = {
        id: 'usr_demo_1',
        phone: DEMO_PHONE,
        stores: [
          { id: 'str_demo_1', name: "Dawit's Kiosk" },
          { id: 'str_demo_2', name: 'Secondary Store' },
        ],
      };
      mockPrisma.user.findUnique.mockResolvedValueOnce(demoUser);

      await cleanDemoData(mockPrisma as unknown as PrismaClient);

      // Verify each store had child rows deleted with scoped where
      for (const store of demoUser.stores) {
        expect(mockPrisma.stockMovement.deleteMany).toHaveBeenCalledWith({
          where: { storeId: store.id },
        });
        expect(mockPrisma.saleItem.deleteMany).toHaveBeenCalledWith({
          where: { sale: { storeId: store.id } },
        });
        expect(mockPrisma.sale.deleteMany).toHaveBeenCalledWith({
          where: { storeId: store.id },
        });
        expect(mockPrisma.product.deleteMany).toHaveBeenCalledWith({
          where: { storeId: store.id },
        });
        expect(mockPrisma.store.deleteMany).toHaveBeenCalledWith({
          where: { id: store.id },
        });
      }

      // Verify user was deleted by id
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({
        where: { id: demoUser.id },
      });

      // Verify NO unscoped deleteMany() was ever called (all have where conditions)
      for (const model of ['stockMovement', 'saleItem', 'sale', 'product', 'store']) {
        const calls = mockPrisma[model].deleteMany.mock.calls;
        for (const call of calls) {
          expect(call[0]).toBeDefined();
          expect(call[0].where).toBeDefined();
        }
      }
    });
  });

  describe('seedDemoData (Batched Insertion & Generator Integration)', () => {
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        user: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'usr_demo_123', phone: DEMO_PHONE }),
          delete: vi.fn(),
        },
        store: {
          create: vi.fn().mockResolvedValue({ id: 'str_demo_123', name: "Dawit's Kiosk" }),
          deleteMany: vi.fn(),
        },
        product: {
          createMany: vi.fn().mockResolvedValue({ count: 40 }),
          deleteMany: vi.fn(),
        },
        sale: {
          createMany: vi.fn().mockResolvedValue({ count: 100 }),
          deleteMany: vi.fn(),
        },
        saleItem: {
          createMany: vi.fn().mockResolvedValue({ count: 100 }),
          deleteMany: vi.fn(),
        },
        stockMovement: {
          createMany: vi.fn().mockResolvedValue({ count: 100 }),
          deleteMany: vi.fn(),
        },
      };
    });

    it('creates demo user and store and inserts generated data in batches with createMany', async () => {
      const fixedNow = new Date('2026-11-19T00:00:00.000Z');
      const result = await seedDemoData(mockPrisma as unknown as PrismaClient, {
        now: fixedNow,
        seed: 42,
      });

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            phone: DEMO_PHONE,
          }),
        })
      );

      expect(mockPrisma.store.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "Dawit's Kiosk",
            userId: 'usr_demo_123',
          }),
        })
      );

      // Verify products inserted in batches
      expect(mockPrisma.product.createMany).toHaveBeenCalled();
      const productBatch = mockPrisma.product.createMany.mock.calls[0][0].data;
      expect(productBatch.length).toBeLessThanOrEqual(100);
      expect(productBatch[0].storeId).toBe('str_demo_123');

      // Verify sales inserted without nested items relation property
      expect(mockPrisma.sale.createMany).toHaveBeenCalled();
      const saleBatch = mockPrisma.sale.createMany.mock.calls[0][0].data;
      expect(saleBatch.length).toBeLessThanOrEqual(100);
      expect(saleBatch[0].items).toBeUndefined();
      expect(saleBatch[0].storeId).toBe('str_demo_123');

      // Verify sale items inserted
      expect(mockPrisma.saleItem.createMany).toHaveBeenCalled();
      const itemBatch = mockPrisma.saleItem.createMany.mock.calls[0][0].data;
      expect(itemBatch.length).toBeLessThanOrEqual(100);

      // Verify stock movements inserted
      expect(mockPrisma.stockMovement.createMany).toHaveBeenCalled();
      const movementBatch = mockPrisma.stockMovement.createMany.mock.calls[0][0].data;
      expect(movementBatch.length).toBeLessThanOrEqual(100);
      expect(movementBatch[0].storeId).toBe('str_demo_123');

      expect(result.summary.productCount).toBe(40);
    });
  });
});
