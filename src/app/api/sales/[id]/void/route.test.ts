import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { createSessionToken } from '@/modules/auth/session';
import * as voidUseCase from '@/use-cases/void-sale';
import { AppError } from '@/lib/errors';

vi.mock('@/use-cases/void-sale', () => ({
  executeVoidSale: vi.fn(),
}));

describe('Sales Void API Route: POST /api/sales/[id]/void', () => {
  const storeId = 'store_test_void_api';
  const userId = 'user_test_cashier';
  const saleId = 'sale_test_789';
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
    const req = new Request(`http://localhost:3000/api/sales/${saleId}/void`, {
      method: 'POST',
    });

    const res = await POST(req, {
      params: Promise.resolve({ id: saleId }),
    });

    expect(res.status).toBe(401);
  });

  it('voids sale successfully and returns 200 OK (AC 4.3)', async () => {
    const mockVoidedSale = {
      id: saleId,
      storeId,
      status: 'VOIDED',
      totalAmountCents: 5000,
      paymentMethod: 'CASH',
      idempotencyKey: 'idemp_key_1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [],
    };

    vi.mocked(voidUseCase.executeVoidSale).mockResolvedValueOnce(mockVoidedSale as never);

    const req = new Request(`http://localhost:3000/api/sales/${saleId}/void`, {
      method: 'POST',
      headers: {
        cookie: validSessionCookie,
      },
    });

    const res = await POST(req, {
      params: Promise.resolve({ id: saleId }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe('VOIDED');
    expect(json.data.id).toBe(saleId);
    expect(voidUseCase.executeVoidSale).toHaveBeenCalledWith({
      storeId,
      saleId,
    });
  });

  it('returns 400 Bad Request when void window is expired (AC 4.3)', async () => {
    vi.mocked(voidUseCase.executeVoidSale).mockRejectedValueOnce(
      new AppError('BAD_REQUEST', 'Cannot void sale after 15 minutes have elapsed')
    );

    const req = new Request(`http://localhost:3000/api/sales/${saleId}/void`, {
      method: 'POST',
      headers: {
        cookie: validSessionCookie,
      },
    });

    const res = await POST(req, {
      params: Promise.resolve({ id: saleId }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.message).toMatch(/15 minutes/i);
  });

  it('returns 409 Conflict when sale is already voided', async () => {
    vi.mocked(voidUseCase.executeVoidSale).mockRejectedValueOnce(
      new AppError('CONFLICT', 'Sale is already voided')
    );

    const req = new Request(`http://localhost:3000/api/sales/${saleId}/void`, {
      method: 'POST',
      headers: {
        cookie: validSessionCookie,
      },
    });

    const res = await POST(req, {
      params: Promise.resolve({ id: saleId }),
    });

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error.code).toBe('CONFLICT');
  });
});
