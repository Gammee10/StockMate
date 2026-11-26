// src/hooks/use-auth.ts
'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ApiClientError,
  fetchCurrentSession,
  loginWithPin,
  logoutSession,
} from '@/lib/api';

export function useStoreName(defaultName = 'Your store'): string {
  const [storeName, setStoreName] = useState<string>(defaultName);

  useEffect(() => {
    let active = true;
    fetchCurrentSession()
      .then((data) => {
        if (active && data?.store?.name) {
          setStoreName(data.store.name);
        }
      })
      .catch((err) => {
        // Fallback remains default store name when unauthenticated or offline
        void err;
      });

    return () => {
      active = false;
    };
  }, []);

  return storeName;
}

export function useLogout() {
  return useCallback(async () => {
    try {
      await logoutSession();
    } finally {
      window.location.href = '/login';
    }
  }, []);
}

export function usePinLogin(initialPhone = '0911000000') {
  const [phone, setPhone] = useState(initialPhone);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitLogin = useCallback(
    async (pinToSubmit: string) => {
      if (loading || pinToSubmit.length !== 4) return;
      setLoading(true);
      setError(null);

      try {
        await loginWithPin({ phone, pin: pinToSubmit });
        // Redirect to counter page with fresh cookie session
        window.location.href = '/';
      } catch (err) {
        setPin('');
        if (err instanceof ApiClientError) {
          setError(err.message);
        } else {
          setError('Network error. Check connection.');
        }
        setLoading(false);
      }
    },
    [phone, loading]
  );

  const handleDigit = useCallback(
    (digit: string) => {
      if (loading) return;
      setError(null);

      setPin((prev) => {
        if (prev.length >= 4) return prev;
        const next = prev + digit;
        if (next.length === 4) {
          submitLogin(next);
        }
        return next;
      });
    },
    [loading, submitLogin]
  );

  const handleBackspace = useCallback(() => {
    if (loading) return;
    setError(null);
    setPin((prev) => prev.slice(0, -1));
  }, [loading]);

  const handleClear = useCallback(() => {
    if (loading) return;
    setError(null);
    setPin('');
  }, [loading]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape') {
        handleClear();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleDigit, handleBackspace, handleClear]);

  return {
    phone,
    setPhone,
    pin,
    loading,
    error,
    handleDigit,
    handleBackspace,
    handleClear,
  };
}
