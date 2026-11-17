import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { createSessionToken } from '@/modules/auth/session';
import * as ledgerUseCase from '@/use-cases/get-today-ledger';

vi.mock('@/use-cases/get-today-ledger', () => ({
  getTodayLedgerUseCase: vi.fn(),
}));

describe('Sales API Route: GET /api/sales/today', () => {
  const storeId = 'store_test_ledger_api';
  const userId = 'user_test_cashier';
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
    const req = new Request('http://localhost:3000/api/sales/today', {
      method: 'GET',
    });

    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 OK with today sales summary and recent sales (AC 4.1)', async () => {
    const mockLedger = {
      summary: {
        cashRevenueCents: 45000,
        digitalRevenueCents: 12000,
        totalRevenueCents: 57000,
        completedCount: 3,
        voidedCount: 1,
        voidedRevenueCents: 3000,
      },
      recentSales: [
        {
          id: 'sale_1',
          storeId,
          idempotencyKey: 'key_1',
          totalAmountCents: 45000,
          paymentMethod: 'CASH',
          status: 'COMPLETED',
          createdAt: new Date().toISOString(),
          isVoidable: true,
          items: [],
        },
      ],
    };

    vi.mocked(ledgerUseCase.getTodayLedgerUseCase).mockResolvedValueOnce(mockLedger as never);

    const req = new Request('http://localhost:3000/api/sales/today', {
      method: 'GET',
      headers: {
        cookie: validSessionCookie,
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.summary.cashRevenueCents).toBe(45000);
    expect(json.data.summary.digitalRevenueCents).toBe(12000);
    expect(json.data.summary.totalRevenueCents).toBe(57000);
    expect(json.data.recentSales).toHaveLength(1);
    expect(json.data.recentSales[0].isVoidable).toBe(true);
    expect(ledgerUseCase.getTodayLedgerUseCase).toHaveBeenCalledWith({ storeId });
  });
});
