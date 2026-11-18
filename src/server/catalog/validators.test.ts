import { describe, it, expect } from 'vitest';
import {
  createProductSchema,
  updateProductSchema,
  quickRestockSchema,
  productIdParamSchema,
} from './validators';

describe('Catalog Validators', () => {
  describe('createProductSchema', () => {
    it('validates a valid create product payload', () => {
      const valid = {
        name: 'Sunflower Oil 1L',
        priceCents: 25000,
        stock: 20,
        lowStockThreshold: 5,
      };
      const result = createProductSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Sunflower Oil 1L');
        expect(result.data.priceCents).toBe(25000);
        expect(result.data.stock).toBe(20);
        expect(result.data.lowStockThreshold).toBe(5);
      }
    });

    it('defaults lowStockThreshold to 5 when omitted', () => {
      const payload = {
        name: 'Sugar 1kg',
        priceCents: 12000,
        stock: 50,
      };
      const result = createProductSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.lowStockThreshold).toBe(5);
      }
    });

    it('rejects empty or whitespace-only name', () => {
      const result = createProductSchema.safeParse({
        name: '   ',
        priceCents: 5000,
        stock: 10,
      });
      expect(result.success).toBe(false);
    });

    it('rejects name exceeding 100 characters', () => {
      const result = createProductSchema.safeParse({
        name: 'A'.repeat(101),
        priceCents: 5000,
        stock: 10,
      });
      expect(result.success).toBe(false);
    });

    it('rejects priceCents <= 0 or floating point (Invariant #1)', () => {
      expect(
        createProductSchema.safeParse({
          name: 'Soap',
          priceCents: 0,
          stock: 5,
        }).success
      ).toBe(false);

      expect(
        createProductSchema.safeParse({
          name: 'Soap',
          priceCents: -500,
          stock: 5,
        }).success
      ).toBe(false);

      expect(
        createProductSchema.safeParse({
          name: 'Soap',
          priceCents: 12.5,
          stock: 5,
        }).success
      ).toBe(false);
    });

    it('rejects negative stock or negative threshold', () => {
      expect(
        createProductSchema.safeParse({
          name: 'Soap',
          priceCents: 5000,
          stock: -1,
        }).success
      ).toBe(false);

      expect(
        createProductSchema.safeParse({
          name: 'Soap',
          priceCents: 5000,
          stock: 10,
          lowStockThreshold: -2,
        }).success
      ).toBe(false);
    });

    it('accepts optional non-negative integer costCents or null', () => {
      const withCost = createProductSchema.safeParse({
        name: 'Sugar 1kg',
        priceCents: 12000,
        costCents: 10000,
        stock: 50,
      });
      expect(withCost.success).toBe(true);
      if (withCost.success) {
        expect(withCost.data.costCents).toBe(10000);
      }

      const withNullCost = createProductSchema.safeParse({
        name: 'Sugar 1kg',
        priceCents: 12000,
        costCents: null,
        stock: 50,
      });
      expect(withNullCost.success).toBe(true);
      if (withNullCost.success) {
        expect(withNullCost.data.costCents).toBeNull();
      }
    });

    it('rejects negative or floating point costCents', () => {
      expect(
        createProductSchema.safeParse({
          name: 'Sugar 1kg',
          priceCents: 12000,
          costCents: -500,
          stock: 50,
        }).success
      ).toBe(false);

      expect(
        createProductSchema.safeParse({
          name: 'Sugar 1kg',
          priceCents: 12000,
          costCents: 100.5,
          stock: 50,
        }).success
      ).toBe(false);
    });
  });

  describe('updateProductSchema', () => {
    it('accepts partial updates', () => {
      const result = updateProductSchema.safeParse({
        priceCents: 26000,
      });
      expect(result.success).toBe(true);
    });

    it('accepts setting isArchived boolean', () => {
      const result = updateProductSchema.safeParse({
        isArchived: true,
      });
      expect(result.success).toBe(true);
    });

    it('accepts updating or clearing costCents', () => {
      const setCost = updateProductSchema.safeParse({
        costCents: 9500,
      });
      expect(setCost.success).toBe(true);
      if (setCost.success) {
        expect(setCost.data.costCents).toBe(9500);
      }

      const clearCost = updateProductSchema.safeParse({
        costCents: null,
      });
      expect(clearCost.success).toBe(true);
      if (clearCost.success) {
        expect(clearCost.data.costCents).toBeNull();
      }
    });

    it('rejects invalid fields in update', () => {
      expect(
        updateProductSchema.safeParse({
          priceCents: -100,
        }).success
      ).toBe(false);

      expect(
        updateProductSchema.safeParse({
          name: '',
        }).success
      ).toBe(false);
    });
  });

  describe('quickRestockSchema', () => {
    it('accepts positive integer restock quantities (e.g. 5, 10)', () => {
      expect(quickRestockSchema.safeParse({ quantity: 5 }).success).toBe(true);
      expect(quickRestockSchema.safeParse({ quantity: 10 }).success).toBe(true);
      expect(quickRestockSchema.safeParse({ quantity: 50 }).success).toBe(true);
    });

    it('rejects zero, negative, or decimal restock quantities', () => {
      expect(quickRestockSchema.safeParse({ quantity: 0 }).success).toBe(false);
      expect(quickRestockSchema.safeParse({ quantity: -5 }).success).toBe(false);
      expect(quickRestockSchema.safeParse({ quantity: 5.5 }).success).toBe(false);
    });

    it('rejects excessively large restock quantities (> 10000)', () => {
      expect(quickRestockSchema.safeParse({ quantity: 10001 }).success).toBe(false);
    });
  });

  describe('productIdParamSchema', () => {
    it('validates a non-empty product ID parameter', () => {
      expect(productIdParamSchema.safeParse({ id: 'prod_123' }).success).toBe(true);
      expect(productIdParamSchema.safeParse({ id: '' }).success).toBe(false);
    });
  });
});
