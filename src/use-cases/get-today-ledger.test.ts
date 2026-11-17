import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTodayLedgerUseCase } from './get-today-ledger';
import * as salesService from '@/modules/sales/service';

vi.mock('@/modules/sales/service', () => ({
  getTodaySalesSummary: vi.fn(),
  getTodayRecentSales: vi.fn(),
}));

describe('Ledger Use Case: getTodayLedgerUseCase', () => {
  const storeId = 'store_test_ledger_1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('aggregates revenue strictly in integer cents (Invariant #1, AC 4.1)', async () => {
    const mockSummary = {
      cashRevenueCents: 150000, // 1,500.00 ETB
      digitalRevenueCents: 320000, // 3,200.00 ETB
      totalRevenueCents: 470000, // 4,700.00 ETB
      completedCount: 14,
      voidedCount: 1,
      voidedRevenueCents: 5000, // 50.00 ETB
    };

    const mockRecentSales = [
      {
        id: 'sale_recent_1',
        storeId,
        idempotencyKey: 'key_1',
        totalAmountCents: 5000,
        paymentMethod: 'CASH',
        status: 'COMPLETED',
        createdAt: new Date(),
        items: [
          {
            id: 'item_1',
            saleId: 'sale_recent_1',
            productId: 'prod_1',
            quantity: 1,
            unitPriceCents: 5000,
            product: { name: 'Cooking Oil 1L' },
          },
        ],
      },
    ];

    vi.mocked(salesService.getTodaySalesSummary).mockResolvedValueOnce(
      mockSummary as never
    );
    vi.mocked(salesService.getTodayRecentSales).mockResolvedValueOnce(
      mockRecentSales as never
    );

    const result = await getTodayLedgerUseCase({ storeId });

    expect(result.summary.cashRevenueCents).toBe(150000);
    expect(result.summary.digitalRevenueCents).toBe(320000);
    expect(result.summary.totalRevenueCents).toBe(470000);
    expect(result.summary.completedCount).toBe(14);
    expect(result.summary.voidedCount).toBe(1);
    expect(result.recentSales).toHaveLength(1);
    expect(result.recentSales[0].isVoidable).toBe(true);
  });

  it('marks sales older than 15 minutes as not voidable (AC 4.3)', async () => {
    const mockSummary = {
      cashRevenueCents: 5000,
      digitalRevenueCents: 0,
      totalRevenueCents: 5000,
      completedCount: 1,
      voidedCount: 0,
      voidedRevenueCents: 0,
    };

    const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const mockRecentSales = [
      {
        id: 'sale_old',
        storeId,
        idempotencyKey: 'key_old',
        totalAmountCents: 2000,
        paymentMethod: 'CASH',
        status: 'COMPLETED',
        createdAt: twentyMinutesAgo,
        items: [],
      },
      {
        id: 'sale_fresh',
        storeId,
        idempotencyKey: 'key_fresh',
        totalAmountCents: 3000,
        paymentMethod: 'DIGITAL',
        status: 'COMPLETED',
        createdAt: fiveMinutesAgo,
        items: [],
      },
      {
        id: 'sale_already_voided',
        storeId,
        idempotencyKey: 'key_voided',
        totalAmountCents: 1000,
        paymentMethod: 'CASH',
        status: 'VOIDED',
        createdAt: fiveMinutesAgo,
        items: [],
      },
    ];

    vi.mocked(salesService.getTodaySalesSummary).mockResolvedValueOnce(
      mockSummary as never
    );
    vi.mocked(salesService.getTodayRecentSales).mockResolvedValueOnce(
      mockRecentSales as never
    );

    const result = await getTodayLedgerUseCase({ storeId });

    expect(result.recentSales[0].id).toBe('sale_old');
    expect(result.recentSales[0].isVoidable).toBe(false);

    expect(result.recentSales[1].id).toBe('sale_fresh');
    expect(result.recentSales[1].isVoidable).toBe(true);

    expect(result.recentSales[2].id).toBe('sale_already_voided');
    expect(result.recentSales[2].isVoidable).toBe(false);
  });
});
