import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { createSessionToken } from '@/modules/auth/session';
import * as checkoutUseCase from '@/use-cases/checkout';
import { AppError } from '@/lib/errors';

vi.mock('@/use-cases/checkout', () => ({
  executeCheckout: vi.fn(),
}));

describe('Sales API Route: POST /api/sales', () => {
  const storeId = 'store_test_pos';
  const userId = 'user_test_cashier';
  const validUuid = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';
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

  it('rejects unauthenticated requests with 401 (Invariant #3)', async () => {
    const req = new Request('http://localhost:3000/api/sales', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': validUuid,
      },
      body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('rejects request when Idempotency-Key header is missing (Invariant #4)', async () => {
    const req = new Request('http://localhost:3000/api/sales', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: validSessionCookie,
      },
      body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.message).toMatch(/Idempotency-Key/i);
  });

  it('rejects request when Idempotency-Key header is not a valid UUID', async () => {
    const req = new Request('http://localhost:3000/api/sales', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'invalid-not-uuid',
        cookie: validSessionCookie,
      },
      body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('rejects invalid body format (empty items list)', async () => {
    const req = new Request('http://localhost:3000/api/sales', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': validUuid,
        cookie: validSessionCookie,
      },
      body: JSON.stringify({ items: [] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('executes checkout and returns 201 Created on fresh sale (AC 2.1)', async () => {
    const mockSale = {
      id: 'sale_123',
      storeId,
      totalAmountCents: 5000,
      paymentMethod: 'CASH',
      idempotencyKey: validUuid,
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
      items: [
        {
          id: 'item_1',
          productId: 'prod_1',
          quantity: 1,
          unitPriceCents: 5000,
        },
      ],
    };

    vi.mocked(checkoutUseCase.executeCheckout).mockResolvedValueOnce({
      cached: false,
      sale: mockSale as never,
    });

    const req = new Request('http://localhost:3000/api/sales', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': validUuid,
        cookie: validSessionCookie,
      },
      body: JSON.stringify({
        items: [{ productId: 'prod_1', quantity: 1 }],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.id).toBe('sale_123');
    expect(json.data.totalAmountCents).toBe(5000);
  });

  it('returns 200 OK with cached sale on idempotent replay (AC 2.4)', async () => {
    const mockSale = {
      id: 'sale_cached_123',
      storeId,
      totalAmountCents: 5000,
      paymentMethod: 'CASH',
      idempotencyKey: validUuid,
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
      items: [],
    };

    vi.mocked(checkoutUseCase.executeCheckout).mockResolvedValueOnce({
      cached: true,
      sale: mockSale as never,
    });

    const req = new Request('http://localhost:3000/api/sales', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': validUuid,
        cookie: validSessionCookie,
      },
      body: JSON.stringify({
        items: [{ productId: 'prod_1', quantity: 1 }],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.id).toBe('sale_cached_123');
  });

  it('returns 409 Conflict when stock is insufficient (AC 2.3)', async () => {
    vi.mocked(checkoutUseCase.executeCheckout).mockRejectedValueOnce(
      new AppError('CONFLICT', 'Insufficient stock for product', {
        fields: { stock: ['Requested 5, available 2'] },
      })
    );

    const req = new Request('http://localhost:3000/api/sales', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': validUuid,
        cookie: validSessionCookie,
      },
      body: JSON.stringify({
        items: [{ productId: 'prod_1', quantity: 5 }],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error.code).toBe('CONFLICT');
  });
});
