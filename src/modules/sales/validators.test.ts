import { describe, it, expect } from 'vitest';
import { checkoutBodySchema, idempotencyKeySchema } from './validators';

describe('Sales Validators', () => {
  describe('idempotencyKeySchema', () => {
    it('accepts valid UUID-v4 strings', () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const result = idempotencyKeySchema.safeParse(validUuid);
      expect(result.success).toBe(true);
    });

    it('rejects invalid or non-UUID strings', () => {
      expect(idempotencyKeySchema.safeParse('not-a-uuid').success).toBe(false);
      expect(idempotencyKeySchema.safeParse('').success).toBe(false);
      expect(idempotencyKeySchema.safeParse(12345).success).toBe(false);
    });
  });

  describe('checkoutBodySchema', () => {
    it('accepts valid items with productId and positive integer quantity', () => {
      const payload = {
        items: [
          { productId: 'prod_1', quantity: 2 },
          { productId: 'prod_2', quantity: 1 },
        ],
        paymentMethod: 'CASH',
      };
      const result = checkoutBodySchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.items).toHaveLength(2);
        expect(result.data.paymentMethod).toBe('CASH');
      }
    });

    it('defaults paymentMethod to CASH if omitted', () => {
      const payload = {
        items: [{ productId: 'prod_1', quantity: 1 }],
      };
      const result = checkoutBodySchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.paymentMethod).toBe('CASH');
      }
    });

    it('rejects empty items array', () => {
      const payload = { items: [] };
      const result = checkoutBodySchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects non-positive, zero, or floating point quantities', () => {
      expect(
        checkoutBodySchema.safeParse({ items: [{ productId: 'p1', quantity: 0 }] })
          .success
      ).toBe(false);
      expect(
        checkoutBodySchema.safeParse({ items: [{ productId: 'p1', quantity: -2 }] })
          .success
      ).toBe(false);
      expect(
        checkoutBodySchema.safeParse({ items: [{ productId: 'p1', quantity: 1.5 }] })
          .success
      ).toBe(false);
    });

    it('rejects missing or empty productId', () => {
      expect(
        checkoutBodySchema.safeParse({ items: [{ productId: '', quantity: 1 }] }).success
      ).toBe(false);
    });
  });
});
