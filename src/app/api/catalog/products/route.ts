// src/app/api/catalog/products/route.ts
import { NextResponse } from 'next/server';
import { publicRoute, userRoute, created } from '@/server/api';
import { getProductsCatalog, createStoreProduct } from '@/server/catalog/service';
import { createProductSchema } from '@/server/catalog/validators';

export const GET = publicRoute({}, async () => {
  const products = await getProductsCatalog(50);

  return NextResponse.json({
    success: true,
    count: products.length,
    products,
  });
});

export const POST = userRoute(
  {
    body: createProductSchema,
  },
  async ({ body, user }) => {
    const product = await createStoreProduct(user.storeId, body);
    return created(product);
  }
);
