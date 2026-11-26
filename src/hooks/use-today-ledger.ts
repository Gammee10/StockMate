// src/hooks/use-today-ledger.ts
'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchTodayLedger, voidSaleById } from '@/lib/api';
import type { RecentSaleRecord, TodaySalesSummary } from '@/types/sales';

interface UseTodayLedgerOptions {
  autoLoad?: boolean;
  onVoidSuccess?: () => void;
}

export function useTodayLedger(options: UseTodayLedgerOptions = {}) {
  const { autoLoad = true, onVoidSuccess } = options;

  const [summary, setSummary] = useState<TodaySalesSummary | null>(null);
  const [recentSales, setRecentSales] = useState<RecentSaleRecord[]>([]);
  const [loading, setLoading] = useState(autoLoad);
  const [error, setError] = useState<string | null>(null);
  const [isVoiding, setIsVoiding] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  const fetchLedger = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTodayLedger();
      setSummary(data.summary);
      setRecentSales(data.recentSales);
    } catch (err) {
      void err;
      setError('Failed to load daily ledger. Please retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoLoad) {
      fetchLedger();
    }
  }, [autoLoad, fetchLedger]);

  const voidSale = useCallback(
    async (saleId: string): Promise<boolean> => {
      setIsVoiding(true);
      setVoidError(null);
      try {
        await voidSaleById(saleId);
        await fetchLedger();
        onVoidSuccess?.();
        return true;
      } catch (err) {
        setVoidError(err instanceof Error ? err.message : 'Error voiding transaction');
        return false;
      } finally {
        setIsVoiding(false);
      }
    },
    [fetchLedger, onVoidSuccess]
  );

  return {
    summary,
    recentSales,
    loading,
    error,
    isVoiding,
    voidError,
    setVoidError,
    fetchLedger,
    voidSale,
  };
}
