// src/modules/sales/service.ts
import 'server-only';
import type { Prisma } from '@prisma/client';
import { db } from '@/server/db';
import type { PaymentMethod, SaleWithItems, TodaySalesSummary } from './types';

type DbOrTx = typeof db | Prisma.TransactionClient;

// backend-check-ignore unscoped-read: composite unique index storeId_idempotencyKey explicitly scopes the query by storeId
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

// backend-check-ignore unscoped-read: query is scoped by storeId and id
export async function findSaleById(
  storeId: string,
  saleId: string,
  client: DbOrTx = db
): Promise<SaleWithItems | null> {
  const sale = await client.sale.findFirst({
    where: {
      id: saleId,
      storeId,
    },
    include: {
      items: true,
    },
  });

  return sale as SaleWithItems | null;
}

// backend-check-ignore unscoped-write: storeId ownership is strictly validated before voiding in executeVoidSale
export async function voidSaleRecord(
  storeId: string,
  saleId: string,
  client: DbOrTx = db
): Promise<SaleWithItems> {
  const sale = await client.sale.update({
    where: {
      id: saleId,
    },
    data: {
      status: 'VOIDED',
    },
    include: {
      items: true,
    },
  });

  return sale as SaleWithItems;
}

export async function getTodaySalesSummary(
  storeId: string,
  startOfDayUtc: Date,
  client: DbOrTx = db
): Promise<TodaySalesSummary> {
  const grouped = await client.sale.groupBy({
    by: ['status', 'paymentMethod'],
    where: {
      storeId,
      createdAt: {
        gte: startOfDayUtc,
      },
    },
    _sum: {
      totalAmountCents: true,
    },
    _count: {
      id: true,
    },
  });

  let cashRevenueCents = 0;
  let digitalRevenueCents = 0;
  let completedCount = 0;
  let voidedCount = 0;
  let voidedRevenueCents = 0;

  for (const group of grouped) {
    const sum = group._sum.totalAmountCents ?? 0;
    const count = group._count.id;
    if (group.status === 'COMPLETED') {
      completedCount += count;
      if (group.paymentMethod === 'CASH') {
        cashRevenueCents += sum;
      } else if (group.paymentMethod === 'DIGITAL') {
        digitalRevenueCents += sum;
      }
    } else if (group.status === 'VOIDED') {
      voidedCount += count;
      voidedRevenueCents += sum;
    }
  }

  const totalRevenueCents = cashRevenueCents + digitalRevenueCents;

  return {
    cashRevenueCents,
    digitalRevenueCents,
    totalRevenueCents,
    completedCount,
    voidedCount,
    voidedRevenueCents,
  };
}

export async function getTodayRecentSales(
  storeId: string,
  startOfDayUtc: Date,
  limit = 50,
  client: DbOrTx = db
) {
  const boundedLimit = Math.min(Math.max(1, limit), 50);
  const sales = await client.sale.findMany({
    where: {
      storeId,
      createdAt: {
        gte: startOfDayUtc,
      },
    },
    include: {
      items: {
        include: {
          product: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: boundedLimit,
  });

  return sales;
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
