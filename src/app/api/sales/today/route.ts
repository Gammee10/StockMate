// src/app/api/sales/today/route.ts
import { userRoute, ok } from '@/server/api';
import { getTodayLedgerUseCase } from '@/use-cases/get-today-ledger';

export const dynamic = 'force-dynamic';

export const GET = userRoute({}, async ({ user }) => {
  // Invariant #3: user.storeId is derived strictly from verified session
  const ledger = await getTodayLedgerUseCase({ storeId: user.storeId });
  return ok(ledger);
});
