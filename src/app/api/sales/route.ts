// src/app/api/sales/route.ts
import { userRoute, ok, created } from '@/server/api';
import {
  checkoutBodySchema,
  idempotencyKeySchema,
} from '@/modules/sales/validators';
import { executeCheckout } from '@/use-cases/checkout';
import { AppError } from '@/lib/errors';

export const POST = userRoute(
  { body: checkoutBodySchema },
  async ({ body, user, request }) => {
    // Invariant #4: Idempotency-Key header is strictly required
    const idempotencyKey =
      request.headers.get('idempotency-key') ??
      request.headers.get('Idempotency-Key');

    if (!idempotencyKey) {
      throw new AppError(
        'BAD_REQUEST',
        'Missing Idempotency-Key header. Provide a valid UUID-v4.'
      );
    }

    const keyParsed = idempotencyKeySchema.safeParse(idempotencyKey);
    if (!keyParsed.success) {
      throw new AppError(
        'BAD_REQUEST',
        'Invalid Idempotency-Key header. Must be a valid UUID.'
      );
    }

    // Invariant #3: user.storeId is derived strictly from verified session
    const result = await executeCheckout({
      storeId: user.storeId,
      idempotencyKey: keyParsed.data,
      items: body.items,
      paymentMethod: body.paymentMethod,
    });

    return result.cached ? ok(result.sale, 200) : created(result.sale);
  }
);
