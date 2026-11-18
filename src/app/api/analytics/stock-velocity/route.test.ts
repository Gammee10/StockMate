import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { createSessionToken } from '@/modules/auth/session';
import * as analyticsService from '@/server/analytics/service';

vi.mock('@/server/analytics/service', () => ({
  computeStockVelocityReport: vi.fn(),
}));

describe('Analytics API Route: GET /api/analytics/stock-velocity', () => {
  const storeId = 'store_test_analytics_api';
  const userId = 'user_test_merchant';
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
    const req = new Request('http://localhost:3000/api/analytics/stock-velocity', {
      method: 'GET',
    });

    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('passes validated range query and verified storeId to analytics service', async () => {
    const mockReport = {
      range: '7d',
      windowDays: 7,
      summary: {
        totalRevenueCents: 250000,
        totalRevenueEtb: '2500.00',
        totalUnitsSold: 10,
        fastMovingCount: 1,
        lowStockCount: 0,
        criticalLowCount: 0,
        outOfStockCount: 0,
        deadStockCount: 0,
        totalEstimatedRestockCostCents: 0,
        totalEstimatedRestockCostEtb: '0.00',
      },
      products: [],
    };

    (
      analyticsService.computeStockVelocityReport as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce(mockReport);

    const req = new Request(
      'http://localhost:3000/api/analytics/stock-velocity?range=7d',
      {
        method: 'GET',
        headers: {
          Cookie: validSessionCookie,
        },
      }
    );

    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data).toEqual(mockReport);
    expect(analyticsService.computeStockVelocityReport).toHaveBeenCalledWith(
      storeId,
      '7d',
      7
    );
  });

  it('defaults range to 7d and targetRunwayDays to 7 when query params are omitted', async () => {
    (
      analyticsService.computeStockVelocityReport as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce({
      range: '7d',
      products: [],
    });

    const req = new Request('http://localhost:3000/api/analytics/stock-velocity', {
      method: 'GET',
      headers: {
        Cookie: validSessionCookie,
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(analyticsService.computeStockVelocityReport).toHaveBeenCalledWith(
      storeId,
      '7d',
      7
    );
  });

  it('passes custom targetRunwayDays parameter when provided', async () => {
    (
      analyticsService.computeStockVelocityReport as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce({
      range: '30d',
      products: [],
    });

    const req = new Request(
      'http://localhost:3000/api/analytics/stock-velocity?range=30d&targetRunwayDays=14',
      {
        method: 'GET',
        headers: {
          Cookie: validSessionCookie,
        },
      }
    );

    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(analyticsService.computeStockVelocityReport).toHaveBeenCalledWith(
      storeId,
      '30d',
      14
    );
  });
});
