import 'server-only';
import { CounterWorkspace } from '@/components/counter/counter-workspace';
import { getStoreDetails } from '@/server/auth/service';
import { listStoreProducts } from '@/server/catalog/service';
import type { Product } from '@/types/catalog';
import { getTodayLedgerUseCase } from '@/use-cases/get-today-ledger';

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

/**
 * Server-hydrated Counter workspace shared by `/` (when authenticated) and `/counter`.
 */
export async function CounterServerView({ storeId }: { storeId: string }) {
  let storeName: string | undefined;
  let products: Product[] = [];
  let salesCount = 0;
  let initialError: string | null = null;

  try {
    const [store, loadedProducts, ledger] = await Promise.all([
      getStoreDetails(storeId),
      loadAllActiveProducts(storeId),
      getTodayLedgerUseCase({ storeId }),
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
