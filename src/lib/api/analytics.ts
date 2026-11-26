// src/lib/api/analytics.ts
import type { StockVelocityRange, StockVelocityReport } from '@/types/analytics';
import { throwApiError } from './client';

export async function fetchStockVelocityReport(
  range: StockVelocityRange
): Promise<StockVelocityReport> {
  const res = await fetch(`/api/analytics/stock-velocity?range=${range}`);
  if (!res.ok) {
    return throwApiError(res, 'Failed to load stock velocity report');
  }
  const json = (await res.json()) as { data: StockVelocityReport };
  return json.data;
}
