'use client';

import { useState, useEffect, useCallback } from 'react';
import { Delete, ShieldAlert, Store } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const [phone, setPhone] = useState('0911000000');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          setPin('');
          setError(data.error?.message || 'Invalid credentials');
          setLoading(false);
          return;
        }

        // Redirect to counter page with fresh cookie session
        window.location.href = '/';
      } catch {
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
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-4 py-8">
      <Card>
        <CardHeader className="pb-4 text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-xl border border-border bg-muted">
            <Store className="size-6 text-foreground" />
          </div>
          <CardTitle className="text-2xl font-semibold tracking-tight">
            StockMate
          </CardTitle>
          <CardDescription>Neighborhood retail counter terminal</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Cashier phone number</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={loading}
              placeholder="0911000000"
              className="text-center font-medium"
            />
          </div>

          <div className="space-y-2">
            <div className="text-center text-sm text-muted-foreground">
              Enter 4-digit PIN
            </div>
            <div className="flex items-center justify-center gap-3 py-1">
              {[0, 1, 2, 3].map((index) => (
                <div
                  key={index}
                  className={cn(
                    'size-3 rounded-full border border-border transition-colors',
                    pin.length > index ? 'border-primary bg-primary' : 'bg-muted'
                  )}
                />
              ))}
            </div>
          </div>

          {error && (
            <div className="border-destructive/30 bg-destructive/10 flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-destructive">
              <ShieldAlert className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span>Verifying PIN...</span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 pt-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <Button
                key={digit}
                type="button"
                variant="outline"
                size="kiosk"
                onClick={() => handleDigit(digit)}
                disabled={loading}
                className="text-xl font-semibold"
                style={{ touchAction: 'manipulation' }}
              >
                {digit}
              </Button>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="kiosk"
              onClick={handleClear}
              disabled={loading}
              className="text-sm font-medium text-muted-foreground"
              style={{ touchAction: 'manipulation' }}
            >
              Clear
            </Button>
            <Button
              type="button"
              variant="outline"
              size="kiosk"
              onClick={() => handleDigit('0')}
              disabled={loading}
              className="text-xl font-semibold"
              style={{ touchAction: 'manipulation' }}
            >
              0
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="kiosk"
              onClick={handleBackspace}
              disabled={loading}
              aria-label="Backspace"
              className="text-muted-foreground"
              style={{ touchAction: 'manipulation' }}
            >
              <Delete className="size-5" />
            </Button>
          </div>
        </CardContent>

        <CardFooter className="justify-center pt-2">
          <div className="text-xs text-muted-foreground">
            Demo PIN: <span className="font-semibold text-foreground">1234</span>
          </div>
        </CardFooter>
      </Card>
    </main>
  );
}
