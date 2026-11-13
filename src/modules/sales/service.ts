// src/modules/sales/service.ts
import 'server-only';
import type { Prisma } from '@prisma/client';
import { db } from '@/server/db';
import type { PaymentMethod, SaleWithItems } from './types';

type DbOrTx = typeof db | Prisma.TransactionClient;

export async function findSaleByIdempotencyKey(
  storeId: string,
  idempotencyKey: string,
  client: DbOrTx = db
): Promise<SaleWithItems | null> {
  const sale = await client.sale.findUnique({
    where: {
      storeId_idempotencyKey: {
        storeId,
        idempotencyKey,
      },
    },
    include: {
      items: true,
    },
  });

  return sale as SaleWithItems | null;
}

export async function createSaleRecord(
  data: {
    storeId: string;
    idempotencyKey: string;
    totalAmountCents: number;
    paymentMethod: PaymentMethod;
    items: Array<{
      productId: string;
      quantity: number;
      unitPriceCents: number;
    }>;
  },
  client: DbOrTx = db
): Promise<SaleWithItems> {
  const sale = await client.sale.create({
    data: {
      storeId: data.storeId,
      idempotencyKey: data.idempotencyKey,
      totalAmountCents: data.totalAmountCents,
      paymentMethod: data.paymentMethod,
      items: {
        create: data.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
        })),
      },
    },
    include: {
      items: true,
    },
  });

  return sale as SaleWithItems;
}
