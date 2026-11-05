'use client';

import { useState, useEffect, useCallback } from 'react';
import { Delete, ShieldAlert, Sparkles, Store } from 'lucide-react';

export default function LoginPage() {
  const [phone, setPhone] = useState('0911000000');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const submitLogin = useCallback(
    async (pinToSubmit: string) => {
      if (loading || pinToSubmit.length !== 4) return;
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, pin: pinToSubmit }),
        });

        const data = await response.json();

        if (!response.ok) {
          triggerShake();
          setPin('');
          setError(data.error?.message || 'Invalid credentials');
          setLoading(false);
          return;
        }

        // Redirect to counter page with fresh cookie session
        window.location.href = '/';
      } catch {
        triggerShake();
        setPin('');
        setError('Network error. Check connection.');
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

  // Physical keyboard listener for hardware/desktop use
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

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-between p-6">
      {/* Top Header */}
      <header className="pt-4 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-950/80 ring-1 ring-emerald-500/40">
          <Store className="h-7 w-7 text-emerald-400" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-white">StockMate</h1>
        <p className="mt-1 text-xs text-slate-400">
          Neighborhood Retail Counter Terminal
        </p>
      </header>

      {/* Main Auth Form */}
      <section className="flex flex-col items-center">
        {/* Phone Input Box */}
        <div className="mb-6 w-full">
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Cashier Phone Number
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={loading}
            placeholder="0911000000"
            className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-center text-lg font-bold tracking-wider text-white outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>

        {/* 4-Digit PIN Indicators */}
        <div className="mb-4">
          <span className="mb-2 block text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
            Enter 4-Digit PIN
          </span>
          <div
            className={`flex items-center justify-center gap-4 transition-transform ${
              shake ? 'animate-bounce text-red-500' : ''
            }`}
          >
            {[0, 1, 2, 3].map((index) => {
              const isFilled = pin.length > index;
              return (
                <div
                  key={index}
                  className={`flex h-11 w-11 items-center justify-center rounded-full border-2 transition-all duration-200 ${
                    isFilled
                      ? 'scale-110 border-emerald-400 bg-emerald-500 shadow-md shadow-emerald-500/40'
                      : 'border-slate-700 bg-slate-900'
                  }`}
                >
                  {isFilled && <div className="h-2.5 w-2.5 rounded-full bg-slate-950" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-950/60 px-3 py-2 text-xs font-medium text-red-400 ring-1 ring-red-800/50">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading Spinner */}
        {loading && (
          <div className="mb-4 flex items-center gap-2 text-xs text-emerald-400">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            <span>Verifying PIN...</span>
          </div>
        )}

        {/* Touch Keypad Grid (≥ 64dp Touch Targets) */}
        <div className="grid w-full grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              disabled={loading}
              className="flex h-16 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/90 text-2xl font-black text-white shadow-sm transition-all active:scale-95 active:bg-slate-800"
              style={{ touchAction: 'manipulation' }}
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            disabled={loading}
            className="flex h-16 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/40 text-sm font-bold text-slate-400 transition-all active:scale-95 active:bg-slate-800"
            style={{ touchAction: 'manipulation' }}
            title="Clear PIN"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            disabled={loading}
            className="flex h-16 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/90 text-2xl font-black text-white shadow-sm transition-all active:scale-95 active:bg-slate-800"
            style={{ touchAction: 'manipulation' }}
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            disabled={loading}
            className="flex h-16 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/40 text-slate-300 transition-all active:scale-95 active:bg-slate-800"
            style={{ touchAction: 'manipulation' }}
            title="Backspace"
          >
            <Delete className="h-6 w-6" />
          </button>
        </div>
      </section>

      {/* Footer / Demo hint */}
      <footer className="pt-6 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[11px] text-slate-400 ring-1 ring-slate-800">
          <Sparkles className="h-3 w-3 text-emerald-400" />
          <span>
            Demo PIN: <strong>1234</strong>
          </span>
        </div>
      </footer>
    </main>
  );
}
