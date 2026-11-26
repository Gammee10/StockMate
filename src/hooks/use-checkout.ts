// src/hooks/use-checkout.ts
'use client';

import { useCallback, useState } from 'react';
import { ApiClientError, formatCheckoutErrorMessage, submitCheckout } from '@/lib/api';
import { buildCheckoutPayload, formatSaleReceiptFeedback } from '@/modules/sales/counter';
import type { Product } from '@/types/catalog';
import type { PaymentMethod, SaleReceiptFeedback } from '@/types/sales';

interface CheckoutParams {
  cart: { [productId: string]: number };
  paymentMethod: PaymentMethod;
  products: Product[];
  onSuccess: (feedback: SaleReceiptFeedback) => void;
  onError: (message: string) => void;
}

export function useCheckout() {
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const executeCheckout = useCallback(
    async ({ cart, paymentMethod, products, onSuccess, onError }: CheckoutParams) => {
      const payload = buildCheckoutPayload(cart, paymentMethod);
      if (payload.items.length === 0 || isCheckingOut) return;

      setIsCheckingOut(true);

      // Invariant #4: Generate client-side UUID for Idempotency-Key
      const idempotencyKey = crypto.randomUUID();

      try {
        const sale = await submitCheckout(payload, idempotencyKey);

        const totalEtb = (sale.totalAmountCents / 100).toFixed(2);
        const totalCount = payload.items.reduce((sum, item) => sum + item.quantity, 0);

        const feedback = formatSaleReceiptFeedback({
          totalEtb,
          count: totalCount,
          paymentMethod: sale.paymentMethod || paymentMethod,
        });

        onSuccess(feedback);
      } catch (err) {
        if (err instanceof ApiClientError) {
          if (err.status === 401) {
            window.location.href = '/login';
            return;
          }
          onError(formatCheckoutErrorMessage(err.message, products));
          return;
        }
        console.error('Checkout network error:', err);
        onError('Network connection error. Please retry.');
      } finally {
        setIsCheckingOut(false);
      }
    },
    [isCheckingOut]
  );

  return {
    isCheckingOut,
    executeCheckout,
  };
}
