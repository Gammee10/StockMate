import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAllProducts } from './fetch-all-products';

describe('fetchAllProducts client helper', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches a single page when nextCursor is null', async () => {
    const mockPage1 = {
      success: true,
      count: 2,
      products: [
        {
          id: 'p1',
          name: 'Oil',
          priceCents: 200,
          priceEtb: '2.00',
          stock: 10,
          lowStockThreshold: 5,
          isLowStock: false,
        },
        {
          id: 'p2',
          name: 'Soap',
          priceCents: 100,
          priceEtb: '1.00',
          stock: 2,
          lowStockThreshold: 5,
          isLowStock: true,
        },
      ],
      nextCursor: null,
    };

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockPage1,
    });
    vi.stubGlobal('fetch', fetchMock);

    const products = await fetchAllProducts();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/catalog/products?limit=100');
    expect(products).toHaveLength(2);
    expect(products[0].name).toBe('Oil');
    expect(products[1].name).toBe('Soap');
  });

  it('pages through multiple cursor pages until nextCursor is null', async () => {
    const mockPage1 = {
      success: true,
      count: 1,
      products: [{ id: 'p1', name: 'Item 1' }],
      nextCursor: 'p1',
    };
    const mockPage2 = {
      success: true,
      count: 1,
      products: [{ id: 'p2', name: 'Item 2' }],
      nextCursor: null,
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPage1,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPage2,
      });
    vi.stubGlobal('fetch', fetchMock);

    const products = await fetchAllProducts();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/catalog/products?limit=100');
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/catalog/products?limit=100&cursor=p1'
    );
    expect(products).toHaveLength(2);
    expect(products[0].id).toBe('p1');
    expect(products[1].id).toBe('p2');
  });

  it('respects maxPages safety ceiling', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        count: 1,
        products: [{ id: 'px', name: 'Infinite' }],
        nextCursor: 'px',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const products = await fetchAllProducts({ maxPages: 3 });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(products).toHaveLength(3);
  });

  it('throws when response is not ok', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchAllProducts()).rejects.toThrow(
      'Failed to fetch product catalog (status 401)'
    );
  });
});
