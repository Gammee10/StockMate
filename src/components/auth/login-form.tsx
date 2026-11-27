'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Calculator,
  Delete,
  Eye,
  EyeOff,
  Loader2,
  Package,
  ShieldCheck,
  ShoppingCart,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
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
const DEMO_PHONE = '0911000000';

const SHIFT_HIGHLIGHTS = [
  {
    icon: ShoppingCart,
    title: 'Fast ETB counter checkout',
    detail: 'One-tap catalog grid, pre-charge cash change, and instant stock deduction.',
  },
  {
    icon: Calculator,
    title: 'Daily till & 15-minute voids',
    detail: 'Compare drawer cash against shift receipts and reverse mistakes safely.',
  },
  {
    icon: Package,
    title: 'Live inventory & velocity alerts',
    detail: 'Track low-stock runway and restock shelves straight from the register.',
  },
] as const;

/**
 * Interactive phone + 4-digit PIN authentication workspace wired to usePinLogin().
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

  const [showPin, setShowPin] = React.useState(false);

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

  const resetToDemoPhone = () => {
    setPhone(DEMO_PHONE);
    handleClear();
  };

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className={buttonVariants({
              variant: 'ghost',
              size: 'sm',
              className: '-ml-2 text-muted-foreground',
            })}
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            <span>Back to overview</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md border border-border bg-card font-mono text-xs font-semibold text-primary">
              SM
            </span>
            <span className="text-sm font-semibold tracking-tight text-foreground">
              StockMate
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:px-8 lg:py-12">
        {/* Left Shift Context & Demo Panel (desktop) */}
        <section className="hidden space-y-6 lg:block" aria-label="Shift overview">
          <div className="space-y-3">
            <Badge variant="outline">Retail register access</Badge>
            <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground">
              Open your register shift
            </h1>
            <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
              Sign in with your store phone number and 4-digit cashier PIN to ring up
              sales, count drawer variance, and keep inventory accurate throughout the
              day.
            </p>
          </div>

          <div className="space-y-3">
            {SHIFT_HIGHLIGHTS.map(({ icon: Icon, title, detail }) => (
              <div
                key={title}
                className="flex items-start gap-3 rounded-xl border border-border bg-card p-3.5"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                  <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-semibold text-foreground">{title}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {detail}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-primary-border bg-primary-soft/60 p-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-foreground">
                Demo register · Dawit&apos;s Kiosk
              </span>
              {phone !== DEMO_PHONE ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  onClick={resetToDemoPhone}
                  className="h-7 px-2.5 text-xs"
                >
                  Reset to demo phone
                </Button>
              ) : null}
            </div>
            <p className="mt-1.5 text-muted-foreground">
              Phone{' '}
              <span className="font-mono font-medium text-foreground">{DEMO_PHONE}</span>{' '}
              · PIN <span className="font-mono font-medium text-foreground">1234</span>{' '}
              (tap digits on the keypad or type on your keyboard)
            </p>
          </div>
        </section>

        {/* Right Sign-in Card */}
        <div className="mx-auto w-full max-w-md space-y-4 lg:mr-0">
          <Card>
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-xl">Cashier sign in</CardTitle>
              <CardDescription>
                Enter your store phone number and 4-digit PIN to unlock the register.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 pt-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="login-phone"
                    className="block text-xs font-medium text-muted-foreground"
                  >
                    Cashier phone
                  </label>
                  {phone !== DEMO_PHONE ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={loading}
                      onClick={resetToDemoPhone}
                      className="h-6 px-2 text-xs text-primary"
                    >
                      Use demo phone
                    </Button>
                  ) : null}
                </div>

                <div className="relative">
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
                    className="pr-9 font-mono tabular-nums"
                    placeholder="0911000000"
                  />
                  {phone.length > 0 && !loading ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setPhone('')}
                      aria-label="Clear phone number"
                      className="absolute right-1 top-1/2 size-7 -translate-y-1/2"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    4-digit shift PIN
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={loading}
                      onClick={() => setShowPin((prev) => !prev)}
                      aria-label={showPin ? 'Hide PIN digits' : 'Show PIN digits'}
                      className="h-6 px-2 text-xs"
                    >
                      {showPin ? (
                        <>
                          <EyeOff className="size-3.5" aria-hidden="true" />
                          <span>Hide</span>
                        </>
                      ) : (
                        <>
                          <Eye className="size-3.5" aria-hidden="true" />
                          <span>Show</span>
                        </>
                      )}
                    </Button>
                    <span className="font-mono text-xs tabular-nums text-subtle-foreground">
                      {pin.length}/4
                    </span>
                  </div>
                </div>

                <div
                  role="status"
                  aria-label={`PIN entry, ${pin.length} of 4 digits entered`}
                  className="grid grid-cols-4 gap-2.5"
                >
                  {[0, 1, 2, 3].map((slot) => {
                    const filled = slot < pin.length;
                    const active = slot === pin.length && !loading && !phoneMissing;

                    return (
                      <div
                        key={slot}
                        className={cn(
                          'flex h-12 items-center justify-center rounded-lg border font-mono text-lg font-semibold tabular-nums transition-colors',
                          error
                            ? 'border-destructive bg-destructive-soft/40 text-destructive'
                            : active
                              ? 'border-primary bg-primary-soft/50 text-foreground'
                              : filled
                                ? 'border-border-strong bg-card text-foreground'
                                : 'border-border bg-muted/40 text-muted-foreground'
                        )}
                      >
                        {filled ? (
                          showPin ? (
                            <span>{pin[slot]}</span>
                          ) : (
                            <span
                              className="size-2.5 rounded-full bg-foreground"
                              aria-hidden="true"
                            />
                          )
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                <div
                  className="grid grid-cols-3 gap-2 pt-1.5"
                  role="group"
                  aria-label="PIN keypad"
                >
                  {KEYPAD_DIGITS.map((digit) => (
                    <Button
                      key={digit}
                      variant="outline"
                      disabled={loading || phoneMissing}
                      onClick={() => handleDigit(digit)}
                      className="h-12 font-mono text-base font-medium tabular-nums"
                    >
                      {digit}
                    </Button>
                  ))}
                  <Button
                    variant="secondary"
                    disabled={loading || pin.length === 0}
                    onClick={handleClear}
                    className="h-12 text-xs"
                  >
                    Clear
                  </Button>
                  <Button
                    variant="outline"
                    disabled={loading || phoneMissing}
                    onClick={() => handleDigit('0')}
                    className="h-12 font-mono text-base font-medium tabular-nums"
                  >
                    0
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={loading || pin.length === 0}
                    onClick={handleBackspace}
                    aria-label="Delete last PIN digit"
                    className="h-12"
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
                    <span>Auto-submits on 4th digit · Keyboard &amp; touch ready</span>
                  </>
                )}
              </div>

              <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-center text-xs text-muted-foreground lg:hidden">
                Demo register:{' '}
                <span className="font-mono font-medium text-foreground">
                  {DEMO_PHONE}
                </span>{' '}
                · PIN <span className="font-mono font-medium text-foreground">1234</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
