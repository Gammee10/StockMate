// src/lib/api/sales.ts
import type { CheckoutPayload, SaleWithItems, TodayLedgerResponse } from '@/types/sales';
import { throwApiError } from './client';

export async function submitCheckout(
  payload: CheckoutPayload,
  idempotencyKey: string
): Promise<SaleWithItems> {
  const response = await fetch('/api/sales', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const fallbackMessage =
      response.status === 409
        ? 'Insufficient stock for one or more items.'
        : 'Checkout failed. Please try again.';
    return throwApiError(response, fallbackMessage);
  }

  const json = (await response.json()) as { data: SaleWithItems };
  return json.data;
}

export function formatCheckoutErrorMessage(
  rawMessage: string,
  products: Array<{ id: string; name: string }>
): string {
  const idMatch = rawMessage.match(/Insufficient stock for product id ([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) {
    const matchedProd = products.find((p) => p.id === idMatch[1]);
    if (matchedProd) {
      return `Insufficient stock for "${matchedProd.name}".`;
    }
  }
  return rawMessage;
}

export async function fetchTodayLedger(): Promise<TodayLedgerResponse> {
  const res = await fetch('/api/sales/today');
  if (!res.ok) {
    return throwApiError(res, 'Failed to load ledger');
  }
  const json = (await res.json()) as { data: TodayLedgerResponse };
  return json.data;
}

export async function voidSaleById(saleId: string): Promise<SaleWithItems> {
  const res = await fetch(`/api/sales/${saleId}/void`, {
    method: 'POST',
  });

  if (!res.ok) {
    return throwApiError(res, 'Failed to void sale');
  }

  const json = (await res.json()) as { data: SaleWithItems };
  return json.data;
}
