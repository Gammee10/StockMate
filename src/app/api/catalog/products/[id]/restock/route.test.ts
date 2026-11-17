import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { createSessionToken } from '@/modules/auth/session';
import * as catalogService from '@/server/catalog/service';
import { AppError } from '@/lib/errors';

vi.mock('@/server/catalog/service', () => ({
  quickRestockProductAtomic: vi.fn(),
}));

describe('Catalog Product Quick Restock API Route: POST /api/catalog/products/[id]/restock', () => {
  const storeId = 'store_test_restock_api';
  const userId = 'user_test_owner';
  const productId = 'prod_test_restock_xyz';
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

  it('rejects unauthenticated requests with 401', async () => {
    const req = new Request(
      `http://localhost:3000/api/catalog/products/${productId}/restock`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: 10 }),
      }
    );

    const res = await POST(req, {
      params: Promise.resolve({ id: productId }),
    });

    expect(res.status).toBe(401);
  });

  it('rejects invalid restock quantity <= 0 or floating point with 400 Bad Request', async () => {
    const req = new Request(
      `http://localhost:3000/api/catalog/products/${productId}/restock`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: validSessionCookie,
        },
        body: JSON.stringify({ quantity: 0 }),
      }
    );

    const res = await POST(req, {
      params: Promise.resolve({ id: productId }),
    });

    expect(res.status).toBe(400);
  });

  it('restocks product successfully and returns 200 OK (AC 5.3)', async () => {
    const mockRefreshedProduct = {
      id: productId,
      name: 'Sunflower Oil 1L',
      priceCents: 25000,
      priceEtb: '250.00',
      stock: 22, // 12 + 10
      lowStockThreshold: 5,
      isLowStock: false,
    };

    vi.mocked(catalogService.quickRestockProductAtomic).mockResolvedValueOnce(
      mockRefreshedProduct as never
    );

    const req = new Request(
      `http://localhost:3000/api/catalog/products/${productId}/restock`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: validSessionCookie,
        },
        body: JSON.stringify({ quantity: 10 }),
      }
    );

    const res = await POST(req, {
      params: Promise.resolve({ id: productId }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.stock).toBe(22);
    expect(json.data.isLowStock).toBe(false);
    expect(catalogService.quickRestockProductAtomic).toHaveBeenCalledWith(
      storeId,
      productId,
      10
    );
  });

  it('returns 404 when product is not found or belongs to another store', async () => {
    vi.mocked(catalogService.quickRestockProductAtomic).mockRejectedValueOnce(
      new AppError('NOT_FOUND', 'Product not found')
    );

    const req = new Request(
      `http://localhost:3000/api/catalog/products/${productId}/restock`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: validSessionCookie,
        },
        body: JSON.stringify({ quantity: 5 }),
      }
    );

    const res = await POST(req, {
      params: Promise.resolve({ id: productId }),
    });

    expect(res.status).toBe(404);
  });
});
