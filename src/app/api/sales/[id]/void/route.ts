// src/app/api/sales/[id]/void/route.ts
import { z } from 'zod';
import { userRoute, ok } from '@/server/api';
import { executeVoidSale } from '@/use-cases/void-sale';

export const dynamic = 'force-dynamic';

const paramsSchema = z.object({
  id: z.string().trim().min(1, 'Sale ID is required').max(100),
});

export const POST = userRoute(
  { params: paramsSchema },
  async ({ params, user }) => {
    // Invariant #3: user.storeId is derived strictly from verified session
    const voidedSale = await executeVoidSale({
      storeId: user.storeId,
      saleId: params.id,
    });

    return ok(voidedSale);
  }
);
