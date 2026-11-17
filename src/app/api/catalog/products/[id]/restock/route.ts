// src/app/api/catalog/products/[id]/restock/route.ts
import { userRoute, ok } from '@/server/api';
import { quickRestockProductAtomic } from '@/server/catalog/service';
import { quickRestockSchema, productIdParamSchema } from '@/server/catalog/validators';

export const POST = userRoute(
  {
    params: productIdParamSchema,
    body: quickRestockSchema,
  },
  async ({ params, body, user }) => {
    const refreshed = await quickRestockProductAtomic(
      user.storeId,
      params.id,
      body.quantity
    );
    return ok(refreshed);
  }
);
