import type { PaymentMethod, SaleStatus } from '@prisma/client';

export type { PaymentMethod, SaleStatus };

export interface CheckoutItemInput {
  productId: string;
  quantity: number;
}

export interface CheckoutInput {
  storeId: string;
  idempotencyKey: string;
  items: CheckoutItemInput[];
  paymentMethod?: PaymentMethod;
}

export interface SaleItemData {
  id: string;
  saleId: string;
  productId: string;
  quantity: number;
  unitPriceCents: number;
}

export interface SaleWithItems {
  id: string;
  storeId: string;
  totalAmountCents: number;
  paymentMethod: PaymentMethod;
  idempotencyKey: string;
  status: SaleStatus;
  createdAt: Date | string;
  items: Array<{
    id?: string;
    productId: string;
    quantity: number;
    unitPriceCents: number;
  }>;
}

export interface CheckoutResult {
  cached: boolean;
  sale: SaleWithItems;
}
