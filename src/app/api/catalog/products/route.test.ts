import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from './route';
import { db } from '@/lib/db';
import { createSessionToken } from '@/modules/auth/session';
import * as catalogService from '@/server/catalog/service';

vi.mock('@/lib/db', () => ({
  db: {
    product: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/server/catalog/service', async () => {
  const actual = await vi.importActual<typeof import('@/server/catalog/service')>(
    '@/server/catalog/service'
  );
  return {
    ...actual,
    createStoreProduct: vi.fn(),
  };
});

describe('Catalog Products API Route: /api/catalog/products', () => {
  const storeId = 'store_test_catalog_api';
  const userId = 'user_test_owner';
  let validSessionCookie: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubEnv('JWT_SECRET', 'test_secret_must_be_32_characters_long_for_hs256!');
    const token = await createSessionToken({
      userId,
      storeId,
      phone: '+251911000000',
    });
    validSessionCookie = `stockmate_session=${token}`;
  });

  describe('GET /api/catalog/products', () => {
    it('rejects unauthenticated requests with 401 (Invariant #3)', async () => {
      const req = new Request('http://localhost:3000/api/catalog/products');
      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it('returns store-scoped products with pagination metadata and no storeName', async () => {
      vi.mocked(db.product.findMany).mockResolvedValueOnce([
        {
          id: 'prod-1',
          name: 'Cooking Oil 1L',
          priceCents: 25000,
          stock: 12,
          lowStockThreshold: 5,
          isArchived: false,
          storeId,
          updatedAt: new Date(),
        },
        {
          id: 'prod-2',
          name: 'Laundry Soap',
          priceCents: 4500,
          stock: 3,
          lowStockThreshold: 5,
          isArchived: false,
          storeId,
          updatedAt: new Date(),
        },
      ] as never);

      const req = new Request('http://localhost:3000/api/catalog/products?limit=50', {
        headers: { Cookie: validSessionCookie },
      });
      const res = await GET(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.count).toBe(2);
      expect(json.nextCursor).toBeNull();

      expect(json.products[0]).toEqual({
        id: 'prod-1',
        name: 'Cooking Oil 1L',
        priceCents: 25000,
        priceEtb: '250.00',
        costCents: null,
        stock: 12,
        lowStockThreshold: 5,
        isLowStock: false,
      });
      expect(json.products[0]).not.toHaveProperty('storeName');

      expect(json.products[1]).toEqual({
        id: 'prod-2',
        name: 'Laundry Soap',
        priceCents: 4500,
        priceEtb: '45.00',
        costCents: null,
        stock: 3,
        lowStockThreshold: 5,
        isLowStock: true,
      });
    });

    it('returns 500 when database query encounters an error', async () => {
      vi.mocked(db.product.findMany).mockRejectedValueOnce(
        new Error('Connection failure')
      );

      const req = new Request('http://localhost:3000/api/catalog/products', {
        headers: { Cookie: validSessionCookie },
      });
      const res = await GET(req);
      expect(res.status).toBe(500);

      const json = await res.json();
      expect(json.error.code).toBe('INTERNAL');
    });
  });

  describe('POST /api/catalog/products (AC 5.1)', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const req = new Request('http://localhost:3000/api/catalog/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Sugar 1kg',
          priceCents: 12000,
          stock: 20,
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it('rejects invalid payload with 400 Bad Request', async () => {
      const req = new Request('http://localhost:3000/api/catalog/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: validSessionCookie,
        },
        body: JSON.stringify({
          name: '',
          priceCents: -500,
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('creates product successfully for authenticated store and returns 201 Created', async () => {
      const mockCreated = {
        id: 'prod-new-1',
        name: 'Sugar 1kg',
        priceCents: 12000,
        priceEtb: '120.00',
        stock: 30,
        lowStockThreshold: 5,
        isLowStock: false,
      };

      vi.mocked(catalogService.createStoreProduct).mockResolvedValueOnce(
        mockCreated as never
      );

      const req = new Request('http://localhost:3000/api/catalog/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: validSessionCookie,
        },
        body: JSON.stringify({
          name: 'Sugar 1kg',
          priceCents: 12000,
          stock: 30,
          lowStockThreshold: 5,
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(201);

      const json = await res.json();
      expect(json.data.name).toBe('Sugar 1kg');
      expect(json.data.priceEtb).toBe('120.00');
      expect(catalogService.createStoreProduct).toHaveBeenCalledWith(storeId, {
        name: 'Sugar 1kg',
        priceCents: 12000,
        stock: 30,
        lowStockThreshold: 5,
      });
    });
  });
});
