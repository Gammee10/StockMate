import { describe, it, expect } from 'vitest';
import {
  buildCheckoutPayload,
  formatSaleReceiptFeedback,
  decrementCartQuantity,
  removeCartItem,
  incrementCartQuantity,
} from './counter';

describe('Counter Sales Helper (Slice 3: Dual Cash & Digital Tracking)', () => {
  describe('buildCheckoutPayload', () => {
    it('defaults paymentMethod to CASH for fast 1-tap checkout (AC 3.2)', () => {
      const cart = { prod_1: 2, prod_2: 1 };
      const payload = buildCheckoutPayload(cart);

      expect(payload).toEqual({
        items: [
          { productId: 'prod_1', quantity: 2 },
          { productId: 'prod_2', quantity: 1 },
        ],
        paymentMethod: 'CASH',
      });
    });

    it('creates payload with DIGITAL when mobile payment is toggled (AC 3.1 & AC 3.3)', () => {
      const cart = { prod_1: 3 };
      const payload = buildCheckoutPayload(cart, 'DIGITAL');

      expect(payload).toEqual({
        items: [{ productId: 'prod_1', quantity: 3 }],
        paymentMethod: 'DIGITAL',
      });
    });

    it('filters out zero or negative quantity items from cart', () => {
      const cart = { prod_1: 2, prod_2: 0 };
      const payload = buildCheckoutPayload(cart, 'DIGITAL');

      expect(payload.items).toEqual([{ productId: 'prod_1', quantity: 2 }]);
    });
  });

  describe('formatSaleReceiptFeedback', () => {
    it('formats visual confirmation for CASH sale (AC 3.4)', () => {
      const feedback = formatSaleReceiptFeedback({
        totalEtb: '150.00',
        count: 2,
        paymentMethod: 'CASH',
      });

      expect(feedback.paymentLabel).toBe('Cash');
      expect(feedback.summaryText).toBe('Sale recorded: 150.00 ETB (Cash) • 2 items');
    });

    it('formats visual confirmation for DIGITAL sale (AC 3.4)', () => {
      const feedback = formatSaleReceiptFeedback({
        totalEtb: '85.50',
        count: 1,
        paymentMethod: 'DIGITAL',
      });

      expect(feedback.paymentLabel).toBe('Digital: Telebirr / CBE');
      expect(feedback.summaryText).toBe(
        'Sale recorded: 85.50 ETB (Digital: Telebirr / CBE) • 1 item'
      );
    });
  });

  describe('Single-Item Cart Deselection & Quantity Adjustment (Slice 5.1)', () => {
    describe('decrementCartQuantity', () => {
      it('decrements item quantity when quantity > 1', () => {
        const cart = { prod_1: 3, prod_2: 1 };
        const updated = decrementCartQuantity(cart, 'prod_1');

        expect(updated).toEqual({ prod_1: 2, prod_2: 1 });
        expect(cart).toEqual({ prod_1: 3, prod_2: 1 }); // Immutable
      });

      it('completely removes item from cart when quantity is 1 (AC 3: Deselection)', () => {
        const cart = { prod_1: 1, prod_2: 2 };
        const updated = decrementCartQuantity(cart, 'prod_1');

        expect(updated).toEqual({ prod_2: 2 });
        expect(updated.prod_1).toBeUndefined();
      });

      it('does nothing if product does not exist in cart', () => {
        const cart = { prod_1: 2 };
        const updated = decrementCartQuantity(cart, 'non_existent');

        expect(updated).toEqual({ prod_1: 2 });
      });
    });

    describe('removeCartItem', () => {
      it('removes item entirely regardless of quantity and keeps other items intact', () => {
        const cart = { prod_1: 5, prod_2: 2, prod_3: 1 };
        const updated = removeCartItem(cart, 'prod_1');

        expect(updated).toEqual({ prod_2: 2, prod_3: 1 });
        expect(updated.prod_1).toBeUndefined();
      });
    });

    describe('incrementCartQuantity', () => {
      it('increments existing item quantity by 1', () => {
        const cart = { prod_1: 2 };
        const updated = incrementCartQuantity(cart, 'prod_1');

        expect(updated).toEqual({ prod_1: 3 });
      });

      it('adds new item with quantity 1 if not previously in cart', () => {
        const cart = { prod_1: 2 };
        const updated = incrementCartQuantity(cart, 'prod_2');

        expect(updated).toEqual({ prod_1: 2, prod_2: 1 });
      });
    });
  });
});
