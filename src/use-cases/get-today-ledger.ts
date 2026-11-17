// src/use-cases/get-today-ledger.ts
import 'server-only';
import { getEatStartOfDayUtc, isWithinVoidWindow } from '@/modules/sales/timezone';
import { getTodaySalesSummary, getTodayRecentSales } from '@/modules/sales/service';
import type { TodayLedgerResponse, RecentSaleRecord } from '@/modules/sales/types';

export interface GetTodayLedgerInput {
  storeId: string;
  now?: Date;
}

export async function getTodayLedgerUseCase(
  input: GetTodayLedgerInput
): Promise<TodayLedgerResponse> {
  const currentInstant = input.now ?? new Date();
  const startOfDayUtc = getEatStartOfDayUtc(currentInstant);

  const [summary, rawSales] = await Promise.all([
    getTodaySalesSummary(input.storeId, startOfDayUtc),
    getTodayRecentSales(input.storeId, startOfDayUtc, 50),
  ]);

  const recentSales: RecentSaleRecord[] = rawSales.map((sale) => ({
    ...sale,
    isVoidable:
      sale.status === 'COMPLETED' &&
      isWithinVoidWindow(sale.createdAt, 15, currentInstant),
  }));

  return {
    summary,
    recentSales,
  };
}
