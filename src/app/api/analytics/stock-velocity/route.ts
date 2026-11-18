// src/app/api/analytics/stock-velocity/route.ts
import { userRoute, ok } from '@/server/api';
import { stockVelocityQuerySchema } from '@/server/analytics/validators';
import { computeStockVelocityReport } from '@/server/analytics/service';

export const dynamic = 'force-dynamic';

export const GET = userRoute(
  { query: stockVelocityQuerySchema },
  async ({ user, query }) => {
    // Invariant #3: user.storeId is derived strictly from verified session
    const report = await computeStockVelocityReport(user.storeId, query.range);
    return ok(report);
  }
);
