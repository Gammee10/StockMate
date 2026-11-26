// src/types/sales.ts
export type {
  PaymentMethod,
  SaleStatus,
  CheckoutItemInput,
  CheckoutInput,
  SaleItemData,
  SaleWithItems,
  TodaySalesSummary,
  RecentSaleRecord,
  TodayLedgerResponse,
  CheckoutResult,
} from '@/modules/sales/types';

export type { SaleReceiptInput, SaleReceiptFeedback } from '@/modules/sales/counter';

import type { PaymentMethod } from '@/modules/sales/types';
import type { SaleReceiptFeedback } from '@/modules/sales/counter';

export interface CheckoutPayload {
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  paymentMethod: PaymentMethod;
}

export interface CheckoutFeedbackModalState {
  isOpen: boolean;
  type: 'success' | 'error';
  feedback?: SaleReceiptFeedback | null;
  errorMessage?: string | null;
}
