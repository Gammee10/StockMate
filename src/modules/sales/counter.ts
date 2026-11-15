import type { PaymentMethod } from './types';

export type { PaymentMethod };

export interface SaleReceiptInput {
  totalEtb: string;
  count: number;
  paymentMethod: PaymentMethod;
}

export interface SaleReceiptFeedback {
  totalEtb: string;
  count: number;
  paymentMethod: PaymentMethod;
  paymentLabel: string;
  summaryText: string;
}

/**
 * Builds the sanitized checkout payload for POST /api/sales.
 * Defaults to 'CASH' for fastest counter checkout speed (AC 3.2).
 */
export function buildCheckoutPayload(
  cart: { [productId: string]: number },
  paymentMethod: PaymentMethod = 'CASH'
) {
  const items = Object.entries(cart)
    .filter(([, quantity]) => quantity > 0)
    .map(([productId, quantity]) => ({
      productId,
      quantity,
    }));

  return {
    items,
    paymentMethod,
  };
}

/**
 * Formats user-facing receipt confirmation banner text (AC 3.4).
 */
export function formatSaleReceiptFeedback(input: SaleReceiptInput): SaleReceiptFeedback {
  const paymentLabel =
    input.paymentMethod === 'DIGITAL' ? 'Digital: Telebirr / CBE' : 'Cash';
  const itemLabel = input.count === 1 ? 'item' : 'items';
  const summaryText = `Sale recorded: ${input.totalEtb} ETB (${paymentLabel}) • ${input.count} ${itemLabel}`;

  return {
    ...input,
    paymentLabel,
    summaryText,
  };
}
