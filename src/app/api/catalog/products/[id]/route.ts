// src/app/api/catalog/products/[id]/route.ts
import { userRoute, ok } from '@/server/api';
import { updateStoreProduct, archiveStoreProduct } from '@/server/catalog/service';
import { updateProductSchema, productIdParamSchema } from '@/server/catalog/validators';

export const PATCH = userRoute(
  {
    params: productIdParamSchema,
    body: updateProductSchema,
  },
  async ({ params, body, user }) => {
    const updated = await updateStoreProduct(user.storeId, params.id, body);
    return ok(updated);
  }
);

export const DELETE = userRoute(
  {
    params: productIdParamSchema,
  },
  async ({ params, user }) => {
    const archived = await archiveStoreProduct(user.storeId, params.id);
    return ok(archived);
  }
);
