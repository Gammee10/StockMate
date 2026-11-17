import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PATCH, DELETE } from './route';
import { createSessionToken } from '@/modules/auth/session';
import * as catalogService from '@/server/catalog/service';
import { AppError } from '@/lib/errors';

vi.mock('@/server/catalog/service', () => ({
  updateStoreProduct: vi.fn(),
  archiveStoreProduct: vi.fn(),
}));

describe('Catalog Product ID API Route: /api/catalog/products/[id]', () => {
  const storeId = 'store_test_patch_delete';
  const userId = 'user_test_owner';
  const productId = 'prod_test_abc';
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

  describe('PATCH /api/catalog/products/[id] (AC 5.2)', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const req = new Request(`http://localhost:3000/api/catalog/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceCents: 30000 }),
      });

      const res = await PATCH(req, {
        params: Promise.resolve({ id: productId }),
      });

      expect(res.status).toBe(401);
    });

    it('rejects invalid payload with 400 Bad Request', async () => {
      const req = new Request(`http://localhost:3000/api/catalog/products/${productId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          cookie: validSessionCookie,
        },
        body: JSON.stringify({ priceCents: -100 }),
      });

      const res = await PATCH(req, {
        params: Promise.resolve({ id: productId }),
      });

      expect(res.status).toBe(400);
    });

    it('updates product and returns 200 OK', async () => {
      const mockUpdated = {
        id: productId,
        name: 'Updated Cooking Oil 1L',
        priceCents: 28000,
        priceEtb: '280.00',
        stock: 15,
        lowStockThreshold: 5,
        isLowStock: false,
      };

      vi.mocked(catalogService.updateStoreProduct).mockResolvedValueOnce(mockUpdated as never);

      const req = new Request(`http://localhost:3000/api/catalog/products/${productId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          cookie: validSessionCookie,
        },
        body: JSON.stringify({
          name: 'Updated Cooking Oil 1L',
          priceCents: 28000,
        }),
      });

      const res = await PATCH(req, {
        params: Promise.resolve({ id: productId }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.name).toBe('Updated Cooking Oil 1L');
      expect(json.data.priceEtb).toBe('280.00');
      expect(catalogService.updateStoreProduct).toHaveBeenCalledWith(storeId, productId, {
        name: 'Updated Cooking Oil 1L',
        priceCents: 28000,
      });
    });

    it('returns 404 when product is not found in store', async () => {
      vi.mocked(catalogService.updateStoreProduct).mockRejectedValueOnce(
        new AppError('NOT_FOUND', 'Product not found')
      );

      const req = new Request(`http://localhost:3000/api/catalog/products/${productId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          cookie: validSessionCookie,
        },
        body: JSON.stringify({ name: 'New Name' }),
      });

      const res = await PATCH(req, {
        params: Promise.resolve({ id: productId }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/catalog/products/[id] (AC 5.4)', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const req = new Request(`http://localhost:3000/api/catalog/products/${productId}`, {
        method: 'DELETE',
      });

      const res = await DELETE(req, {
        params: Promise.resolve({ id: productId }),
      });

      expect(res.status).toBe(401);
    });

    it('soft-archives product successfully and returns 200 OK', async () => {
      const mockArchived = {
        id: productId,
        name: 'Old Biscuit',
        isArchived: true,
      };

      vi.mocked(catalogService.archiveStoreProduct).mockResolvedValueOnce(mockArchived as never);

      const req = new Request(`http://localhost:3000/api/catalog/products/${productId}`, {
        method: 'DELETE',
        headers: {
          cookie: validSessionCookie,
        },
      });

      const res = await DELETE(req, {
        params: Promise.resolve({ id: productId }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.isArchived).toBe(true);
      expect(catalogService.archiveStoreProduct).toHaveBeenCalledWith(storeId, productId);
    });

    it('returns 404 when attempting to archive non-existent or other store product', async () => {
      vi.mocked(catalogService.archiveStoreProduct).mockRejectedValueOnce(
        new AppError('NOT_FOUND', 'Product not found')
      );

      const req = new Request(`http://localhost:3000/api/catalog/products/${productId}`, {
        method: 'DELETE',
        headers: {
          cookie: validSessionCookie,
        },
      });

      const res = await DELETE(req, {
        params: Promise.resolve({ id: productId }),
      });

      expect(res.status).toBe(404);
    });
  });
});
