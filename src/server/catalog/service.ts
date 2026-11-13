// src/server/catalog/service.ts
import 'server-only';
import { db } from '@/server/db';

export async function getProductsCatalog(limit = 50) {
  const products = await db.product.findMany({
    where: { isArchived: false },
    take: Math.min(limit, 100),
    include: {
      store: {
        select: { name: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    priceCents: p.priceCents,
    priceEtb: (p.priceCents / 100).toFixed(2),
    stock: p.stock,
    lowStockThreshold: p.lowStockThreshold,
    isLowStock: p.stock <= p.lowStockThreshold,
    storeName: p.store.name,
  }));
}
