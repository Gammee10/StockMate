import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ApiClientError,
  archiveCatalogProduct,
  createCatalogProduct,
  fetchCurrentSession,
  fetchStockVelocityReport,
  fetchTodayLedger,
  formatCheckoutErrorMessage,
  loginWithPin,
  logoutSession,
  restockCatalogProduct,
  submitCheckout,
  validateCreateProductForm,
  voidSaleById,
} from './index';

describe('Extracted client API wrappers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('auth API wrappers', () => {
    it('returns null from fetchCurrentSession when response is not ok', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 401 }));
      await expect(fetchCurrentSession()).resolves.toBeNull();
    });

    it('returns session data from fetchCurrentSession when authenticated', async () => {
      const payload = {
        authenticated: true,
        user: { id: 'u1', phone: '0911000000' },
        store: { id: 's1', name: 'Mercato Shop' },
      };
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValueOnce({ ok: true, json: async () => payload })
      );
      await expect(fetchCurrentSession()).resolves.toEqual(payload);
    });

    it('throws ApiClientError with server message when loginWithPin fails', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({
            error: {
              code: 'INVALID_CREDENTIALS',
              message: 'Invalid phone number or PIN',
            },
          }),
        })
      );

      await expect(
        loginWithPin({ phone: '0911000000', pin: '0000' })
      ).rejects.toMatchObject({
        name: 'ApiClientError',
        status: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid phone number or PIN',
      });
    });

    it('calls POST /api/auth/logout in logoutSession', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true });
      vi.stubGlobal('fetch', fetchMock);
      await logoutSession();
      expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
    });
  });

  describe('catalog API wrappers and form validation', () => {
    it('validates product form input into integer cents', () => {
      expect(
        validateCreateProductForm({
          name: '  Cooking Oil 1L ',
          priceEtb: '250.00',
          costPriceEtb: '210.50',
          stock: '10',
          lowStockThreshold: '5',
        })
      ).toEqual({
        ok: true,
        data: {
          name: 'Cooking Oil 1L',
          priceCents: 25000,
          costCents: 21050,
          stock: 10,
          lowStockThreshold: 5,
        },
      });
    });

    it('rejects invalid product form fields with existing user-facing messages', () => {
      expect(
        validateCreateProductForm({
          name: '   ',
          priceEtb: '100',
          costPriceEtb: '',
          stock: '1',
          lowStockThreshold: '1',
        })
      ).toEqual({ ok: false, error: 'Product name is required' });

      expect(
        validateCreateProductForm({
          name: 'Oil',
          priceEtb: '0',
          costPriceEtb: '',
          stock: '1',
          lowStockThreshold: '1',
        })
      ).toEqual({
        ok: false,
        error: 'Enter a valid positive price in ETB (e.g. 250.00)',
      });
    });

    it('creates, restocks, and archives catalog products via API routes', async () => {
      const product = {
        id: 'p1',
        name: 'Oil',
        priceCents: 25000,
        priceEtb: '250.00',
        costCents: null,
        stock: 15,
        lowStockThreshold: 5,
        isLowStock: false,
      };
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ data: product }) })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { ...product, stock: 20 } }),
        })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ data: product }) });
      vi.stubGlobal('fetch', fetchMock);

      await expect(
        createCatalogProduct({
          name: 'Oil',
          priceCents: 25000,
          costCents: null,
          stock: 15,
          lowStockThreshold: 5,
        })
      ).resolves.toEqual(product);

      await expect(restockCatalogProduct('p1', 5)).resolves.toMatchObject({ stock: 20 });
      await expect(archiveCatalogProduct('p1')).resolves.toEqual(product);
    });
  });

  describe('sales and analytics API wrappers', () => {
    it('submits checkout with Idempotency-Key header and maps insufficient stock product id', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          error: {
            code: 'CONFLICT',
            message: 'Insufficient stock for product id prod_123',
          },
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      await expect(
        submitCheckout(
          { items: [{ productId: 'prod_123', quantity: 2 }], paymentMethod: 'CASH' },
          'uuid-key-1'
        )
      ).rejects.toBeInstanceOf(ApiClientError);

      expect(fetchMock).toHaveBeenCalledWith('/api/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'uuid-key-1',
        },
        body: JSON.stringify({
          items: [{ productId: 'prod_123', quantity: 2 }],
          paymentMethod: 'CASH',
        }),
      });

      expect(
        formatCheckoutErrorMessage('Insufficient stock for product id prod_123', [
          { id: 'prod_123', name: 'Cooking Oil 1L' },
        ])
      ).toBe('Insufficient stock for "Cooking Oil 1L".');
    });

    it('fetches today ledger and voids a sale', async () => {
      const ledger = { summary: { completedCount: 1 }, recentSales: [] };
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ data: ledger }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { id: 's1' } }) });
      vi.stubGlobal('fetch', fetchMock);

      await expect(fetchTodayLedger()).resolves.toEqual(ledger);
      await expect(voidSaleById('s1')).resolves.toEqual({ id: 's1' });
    });

    it('fetches stock velocity report for requested range', async () => {
      const report = { range: '30d', windowDays: 30, summary: {}, products: [] };
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ data: report }) });
      vi.stubGlobal('fetch', fetchMock);

      await expect(fetchStockVelocityReport('30d')).resolves.toEqual(report);
      expect(fetchMock).toHaveBeenCalledWith('/api/analytics/stock-velocity?range=30d');
    });
  });
});
