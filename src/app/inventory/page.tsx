import type { Metadata } from 'next';
import { InventoryWorkspace } from '@/components/inventory/inventory-workspace';
import { requirePageUser } from '@/server/auth';
import { getStoreDetails } from '@/server/auth/service';
import { listStoreProducts } from '@/server/catalog/service';
import type { ProductItem } from '@/types/catalog';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Inventory',
};

async function loadAllInventoryProducts(storeId: string): Promise<ProductItem[]> {
  const collected: ProductItem[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < 10; page++) {
    const result = await listStoreProducts(storeId, { limit: 100, cursor });
    collected.push(...result.items);
    if (!result.nextCursor) break;
    cursor = result.nextCursor;
  }

  return collected;
}

export default async function InventoryPage() {
  const user = await requirePageUser();

  let storeName: string | undefined;
  let products: ProductItem[] = [];
  let initialError: string | null = null;

  try {
    const [store, items] = await Promise.all([
      getStoreDetails(user.storeId),
      loadAllInventoryProducts(user.storeId),
    ]);
    if (store?.name) {
      storeName = store.name;
    }
    products = items;
  } catch (err) {
    void err;
    initialError = 'Failed to load inventory. Check connection and retry.';
  }

  return (
    <InventoryWorkspace
      initialStoreName={storeName}
      initialProducts={products}
      initialError={initialError}
    />
  );
}
