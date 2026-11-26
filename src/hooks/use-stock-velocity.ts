// src/hooks/use-stock-velocity.ts
'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchStockVelocityReport } from '@/lib/api';
import type { StockVelocityRange, StockVelocityReport } from '@/types/analytics';

export function useStockVelocity(initialRange: StockVelocityRange = '7d') {
  const [range, setRange] = useState<StockVelocityRange>(initialRange);
  const [report, setReport] = useState<StockVelocityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchStockVelocityReport(range);
      setReport(data);
    } catch (err) {
      void err;
      setError('Failed to load velocity report. Please retry.');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  return {
    range,
    setRange,
    report,
    loading,
    error,
    fetchReport,
  };
}
