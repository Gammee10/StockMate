// src/app/api/catalog/products/route.ts
import { NextResponse } from 'next/server';
import { publicRoute } from '@/server/api';
import { getProductsCatalog } from '@/server/catalog/service';

export const GET = publicRoute({}, async () => {
  const products = await getProductsCatalog(50);

  return NextResponse.json({
    success: true,
    count: products.length,
    products,
  });
});
