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

/**
 * Decrements the quantity of a product in the cart.
 * If quantity drops to <= 1, removes the item completely from the cart (Slice 5.1).
 */
export function decrementCartQuantity(
  cart: { [productId: string]: number },
  productId: string
): { [productId: string]: number } {
  const current = cart[productId] || 0;
  if (current <= 1) {
    const next = { ...cart };
    delete next[productId];
    return next;
  }
  return {
    ...cart,
    [productId]: current - 1,
  };
}

/**
 * Completely removes an item from the cart regardless of current quantity (Slice 5.1).
 */
export function removeCartItem(
  cart: { [productId: string]: number },
  productId: string
): { [productId: string]: number } {
  const next = { ...cart };
  delete next[productId];
  return next;
}

/**
 * Increments the quantity of a product in the cart (Slice 5.1).
 */
export function incrementCartQuantity(
  cart: { [productId: string]: number },
  productId: string
): { [productId: string]: number } {
  return {
    ...cart,
    [productId]: (cart[productId] || 0) + 1,
  };
}

/**
 * Filters products by name, case-insensitive, with whitespace trimming (Task 1.2).
 * Returns all products when query is empty or whitespace.
 */
export function filterProductsByName<T extends { name: string }>(
  products: T[],
  query: string
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return products;
  }
  return products.filter((p) => p.name.toLowerCase().includes(q));
}
