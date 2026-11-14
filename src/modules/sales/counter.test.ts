import { describe, it, expect } from 'vitest';
import {
  buildCheckoutPayload,
  formatSaleReceiptFeedback,
  type PaymentMethod,
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
});
