import type { Metadata } from 'next';
import { TillWorkspace } from '@/components/till/till-workspace';
import { requirePageUser } from '@/server/auth';
import { getStoreDetails } from '@/server/auth/service';
import type { RecentSaleRecord, TodaySalesSummary } from '@/types/sales';
import { getTodayLedgerUseCase } from '@/use-cases/get-today-ledger';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Daily till',
};

export default async function TillPage() {
  const user = await requirePageUser();

  let storeName: string | undefined;
  let summary: TodaySalesSummary | null = null;
  let recentSales: RecentSaleRecord[] = [];
  let initialError: string | null = null;

  try {
    const [store, ledger] = await Promise.all([
      getStoreDetails(user.storeId),
      getTodayLedgerUseCase({ storeId: user.storeId }),
    ]);

    if (store?.name) {
      storeName = store.name;
    }
    summary = ledger.summary;
    recentSales = ledger.recentSales.map((sale) => ({
      ...sale,
      createdAt:
        typeof sale.createdAt === 'string'
          ? sale.createdAt
          : sale.createdAt.toISOString(),
    }));
  } catch (err) {
    void err;
    initialError = 'Failed to load daily till ledger. Check connection and retry.';
  }

  return (
    <TillWorkspace
      initialStoreName={storeName}
      initialSummary={summary}
      initialRecentSales={recentSales}
      initialError={initialError}
    />
  );
}
