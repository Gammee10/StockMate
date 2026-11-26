import type { Metadata } from 'next';
import { AnalyticsWorkspace } from '@/components/analytics/analytics-workspace';
import { computeStockVelocityReport } from '@/server/analytics/service';
import { requirePageUser } from '@/server/auth';
import { getStoreDetails } from '@/server/auth/service';
import type { StockVelocityReport } from '@/types/analytics';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Analytics',
};

export default async function AnalyticsPage() {
  const user = await requirePageUser();

  let storeName: string | undefined;
  let report: StockVelocityReport | null = null;
  let initialError: string | null = null;

  try {
    const [store, velocityReport] = await Promise.all([
      getStoreDetails(user.storeId),
      computeStockVelocityReport(user.storeId, '7d'),
    ]);

    if (store?.name) {
      storeName = store.name;
    }
    report = velocityReport;
  } catch (err) {
    void err;
    initialError = 'Failed to load stock velocity report. Check connection and retry.';
  }

  return (
    <AnalyticsWorkspace
      initialStoreName={storeName}
      initialReport={report}
      initialError={initialError}
    />
  );
}
