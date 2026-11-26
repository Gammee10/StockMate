import type { Metadata } from 'next';
import { CounterWorkspace } from '@/components/counter/counter-workspace';
import { requirePageUser } from '@/server/auth';
import { getStoreDetails } from '@/server/auth/service';
import { listStoreProducts } from '@/server/catalog/service';
import type { Product } from '@/types/catalog';
import { getTodayLedgerUseCase } from '@/use-cases/get-today-ledger';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Counter',
};

async function loadAllActiveProducts(storeId: string): Promise<Product[]> {
  const collected: Product[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < 10; page++) {
    const result = await listStoreProducts(storeId, { limit: 100, cursor });
    collected.push(...result.items);
    if (!result.nextCursor) break;
    cursor = result.nextCursor;
  }

  return collected;
}

export default async function CounterPage() {
  const user = await requirePageUser();

  let storeName: string | undefined;
  let products: Product[] = [];
  let salesCount = 0;
  let initialError: string | null = null;

  try {
    const [store, loadedProducts, ledger] = await Promise.all([
      getStoreDetails(user.storeId),
      loadAllActiveProducts(user.storeId),
      getTodayLedgerUseCase({ storeId: user.storeId }),
    ]);

    if (store?.name) {
      storeName = store.name;
    }
    products = loadedProducts;
    salesCount = ledger.summary.completedCount;
  } catch (err) {
    void err;
    initialError = 'Failed to load store catalog. Check connection and retry.';
  }

  return (
    <CounterWorkspace
      initialProducts={products}
      initialStoreName={storeName}
      initialSalesCount={salesCount}
      initialError={initialError}
    />
  );
}
