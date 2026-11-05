import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { db } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  db: {
    product: {
      findMany: vi.fn(),
    },
  },
}));

describe('Catalog Products API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('formats product money in ETB and calculates low stock status accurately', async () => {
    vi.mocked(db.product.findMany).mockResolvedValueOnce([
      {
        id: 'prod-1',
        name: 'Cooking Oil 1L',
        priceCents: 25000,
        stock: 12,
        lowStockThreshold: 5,
        isArchived: false,
        storeId: 'store-1',
        updatedAt: new Date(),
        store: { name: "Dawit's Kiosk" },
      },
      {
        id: 'prod-2',
        name: 'Laundry Soap',
        priceCents: 4500,
        stock: 3,
        lowStockThreshold: 5,
        isArchived: false,
        storeId: 'store-1',
        updatedAt: new Date(),
        store: { name: "Dawit's Kiosk" },
      },
    ] as never);

    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.count).toBe(2);

    // Verify Invariant: Money is always integer cents, displayed correctly in ETB
    expect(json.products[0]).toMatchObject({
      name: 'Cooking Oil 1L',
      priceCents: 25000,
      priceEtb: '250.00',
      stock: 12,
      isLowStock: false,
      storeName: "Dawit's Kiosk",
    });

    // Verify low-stock warning threshold invariant (stock 3 <= threshold 5)
    expect(json.products[1]).toMatchObject({
      name: 'Laundry Soap',
      priceCents: 4500,
      priceEtb: '45.00',
      stock: 3,
      isLowStock: true,
      storeName: "Dawit's Kiosk",
    });
  });

  it('returns 500 when database query encounters an error', async () => {
    vi.mocked(db.product.findMany).mockRejectedValueOnce(new Error('Connection failure'));

    const res = await GET();
    expect(res.status).toBe(500);

    const json = await res.json();
    expect(json.error.code).toBe('DATABASE_ERROR');
    expect(json.error.message).toBe('Failed to retrieve products from database');
  });
});
