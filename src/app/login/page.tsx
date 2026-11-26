'use client';

import * as React from 'react';
import { Delete, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { usePinLogin } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

const KEYPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

export default function LoginPage() {
  const {
    phone,
    setPhone,
    pin,
    loading,
    error,
    handleDigit,
    handleBackspace,
    handleClear,
  } = usePinLogin();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-card text-sm font-semibold text-primary shadow-sm">
            SM
          </span>
          <div className="space-y-0.5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              StockMate
            </h1>
            <p className="text-sm text-muted-foreground">Cashier sign in</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Open shift</CardTitle>
            <CardDescription>
              Enter your store phone number and 4-digit PIN.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="login-phone"
                className="block text-xs font-medium text-muted-foreground"
              >
                Cashier phone
              </label>
              <Input
                id="login-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                disabled={loading}
                error={Boolean(error)}
                onChange={(event) => setPhone(event.target.value)}
                className="font-mono tabular-nums"
                placeholder="0911000000"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  4-digit shift PIN
                </span>
                <span className="font-mono text-xs tabular-nums text-subtle-foreground">
                  {pin.length}/4
                </span>
              </div>

              <div
                aria-label={`PIN entry, ${pin.length} of 4 digits entered`}
                className={cn(
                  'grid h-11 grid-cols-4 items-center gap-2 rounded-md border bg-background px-4',
                  error ? 'border-destructive bg-destructive-soft/40' : 'border-border'
                )}
              >
                {[0, 1, 2, 3].map((slot) => (
                  <span key={slot} className="flex items-center justify-center">
                    <span
                      className={cn(
                        'size-2.5 rounded-full transition-colors',
                        slot < pin.length ? 'bg-primary' : 'bg-border-strong'
                      )}
                    />
                  </span>
                ))}
              </div>

              <div
                className="grid grid-cols-3 gap-2 pt-1"
                role="group"
                aria-label="PIN keypad"
              >
                {KEYPAD_KEYS.map((digit) => (
                  <Button
                    key={digit}
                    variant="outline"
                    size="lg"
                    disabled={loading}
                    onClick={() => handleDigit(digit)}
                    className="font-mono text-base font-medium tabular-nums"
                  >
                    {digit}
                  </Button>
                ))}
                <Button
                  variant="secondary"
                  size="lg"
                  disabled={loading || pin.length === 0}
                  onClick={handleClear}
                  className="text-xs"
                >
                  Clear
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  disabled={loading}
                  onClick={() => handleDigit('0')}
                  className="font-mono text-base font-medium tabular-nums"
                >
                  0
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  disabled={loading || pin.length === 0}
                  onClick={handleBackspace}
                  aria-label="Delete last PIN digit"
                >
                  <Delete className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>

            {error ? (
              <p
                role="alert"
                className="rounded-md border border-destructive-border bg-destructive-soft px-3 py-2 text-xs font-medium text-destructive"
              >
                {error}
              </p>
            ) : null}

            <div className="flex items-center justify-center gap-1.5 pt-1 text-xs text-subtle-foreground">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              <span>
                {loading ? 'Verifying shift credentials...' : 'Auto-submits on 4th digit'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
