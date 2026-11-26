'use client';

import * as React from 'react';
import { Delete, Loader2, ShieldCheck } from 'lucide-react';
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

const KEYPAD_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

/**
 * Interactive phone + 4-digit PIN authentication card wired to usePinLogin().
 */
export function LoginForm() {
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

  const phoneMissing = phone.trim().length === 0;
  const activeError =
    error ?? (phoneMissing ? 'Enter your store phone number first.' : null);

  const handlePhoneKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      (event.key >= '0' && event.key <= '9') ||
      event.key === 'Backspace' ||
      event.key === 'Escape'
    ) {
      // Keep physical keyboard editing inside the phone field isolated from global PIN listener
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.currentTarget.blur();
      }
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="flex flex-col items-center gap-1.5 text-center">
          <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-card text-xs font-semibold text-primary shadow-sm">
            SM
          </span>
          <div className="space-y-0.5">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              StockMate
            </h1>
            <p className="text-xs text-muted-foreground">Cashier shift sign in</p>
          </div>
        </div>

        <Card>
          <CardHeader className="p-4 pb-3">
            <CardTitle>Open shift</CardTitle>
            <CardDescription>
              Enter your phone number and 4-digit PIN to sign in.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-0">
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
                maxLength={100}
                value={phone}
                disabled={loading}
                error={Boolean(activeError)}
                aria-describedby={activeError ? 'login-error-msg' : undefined}
                onKeyDown={handlePhoneKeyDown}
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
                role="status"
                aria-label={`PIN entry, ${pin.length} of 4 digits entered`}
                className={cn(
                  'grid h-12 grid-cols-4 items-center gap-2 rounded-md border bg-background px-4 transition-colors',
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
                {KEYPAD_DIGITS.map((digit) => (
                  <Button
                    key={digit}
                    variant="outline"
                    disabled={loading || phoneMissing}
                    onClick={() => handleDigit(digit)}
                    className="h-11 font-mono text-base font-medium tabular-nums"
                  >
                    {digit}
                  </Button>
                ))}
                <Button
                  variant="secondary"
                  disabled={loading || pin.length === 0}
                  onClick={handleClear}
                  className="h-11 text-xs"
                >
                  Clear
                </Button>
                <Button
                  variant="outline"
                  disabled={loading || phoneMissing}
                  onClick={() => handleDigit('0')}
                  className="h-11 font-mono text-base font-medium tabular-nums"
                >
                  0
                </Button>
                <Button
                  variant="secondary"
                  disabled={loading || pin.length === 0}
                  onClick={handleBackspace}
                  aria-label="Delete last PIN digit"
                  className="h-11"
                >
                  <Delete className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>

            {activeError ? (
              <p
                id="login-error-msg"
                role="alert"
                className="break-words rounded-md border border-destructive-border bg-destructive-soft px-3 py-2 text-xs font-medium text-destructive"
              >
                {activeError}
              </p>
            ) : null}

            <div className="flex items-center justify-center gap-1.5 pt-1 text-xs text-subtle-foreground">
              {loading ? (
                <>
                  <Loader2
                    className="size-3.5 animate-spin text-primary"
                    aria-hidden="true"
                  />
                  <span>Verifying shift credentials...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="size-3.5" aria-hidden="true" />
                  <span>Auto-submits on 4th digit · EAT offline-ready</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
