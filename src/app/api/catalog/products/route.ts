// src/app/api/catalog/products/route.ts
import { NextResponse } from 'next/server';
import { userRoute, created } from '@/server/api';
import { listStoreProducts, createStoreProduct } from '@/server/catalog/service';
import {
  createProductSchema,
  listProductsQuerySchema,
} from '@/server/catalog/validators';

export const GET = userRoute(
  {
    query: listProductsQuerySchema,
  },
  async ({ query, user }) => {
    const { items, nextCursor } = await listStoreProducts(user.storeId, query);

    return NextResponse.json({
      success: true,
      count: items.length,
      products: items,
      nextCursor,
    });
  }
);

export const POST = userRoute(
  {
    body: createProductSchema,
  },
  async ({ body, user }) => {
    const product = await createStoreProduct(user.storeId, body);
    return created(product);
  }
);
