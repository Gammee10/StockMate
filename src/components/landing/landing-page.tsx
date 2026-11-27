import Link from 'next/link';
import {
  ArrowRight,
  Calculator,
  Check,
  Package,
  ShieldCheck,
  ShoppingCart,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button-variants';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const CAPABILITIES = [
  {
    icon: ShoppingCart,
    title: 'Fast counter checkout',
    description:
      'Search products with /, add or drop items in one tap, compute cash change before charging, and prevent duplicate submits on retries.',
  },
  {
    icon: Calculator,
    title: 'Daily till and 15-minute voids',
    description:
      'Track East Africa Time shift cash and digital receipts, check drawer variance against opening float, and void recent mistakes to restore stock.',
  },
  {
    icon: Package,
    title: 'Live inventory management',
    description:
      'Maintain prices, wholesale costs, and alert thresholds. Restock items with +5 and +10 shortcuts synced straight to the counter.',
  },
  {
    icon: TrendingUp,
    title: 'Velocity and reorder planner',
    description:
      'Inspect Today, 7-day, and 30-day sales velocity, remaining days of stock runway, and prioritized reorder lists ready to copy.',
  },
] as const;

const SHIFT_STEPS = [
  {
    step: '1. Open a shift with a 4-digit PIN',
    description:
      'Cashiers sign in with their store phone number and 4-digit PIN using either the touchscreen keypad or a physical keyboard.',
  },
  {
    step: '2. Ring up cash or digital tickets',
    description:
      'The server verifies product prices in integer ETB cents and decrements inventory atomically so shelf counts never go negative.',
  },
  {
    step: '3. Reconcile drawer and plan reorders',
    description:
      'Count drawer cash against recorded receipts at close and copy low-stock reorder quantities for morning wholesale runs.',
  },
] as const;

const PREVIEW_TICKET_LINES = [
  { name: 'Cooking Oil 1L', meta: '2 × 250.00 ETB', total: '500.00 ETB' },
  { name: 'Shiro Powder 500g', meta: '1 × 65.00 ETB', total: '65.00 ETB' },
  { name: 'Mineral Water 500ml', meta: '3 × 25.00 ETB', total: '75.00 ETB' },
] as const;

/**
 * Public StockMate overview landing page shown at `/` when no cashier session is active.
 */
export function LandingPage() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 font-semibold tracking-tight text-foreground"
          >
            <span className="flex size-8 items-center justify-center rounded-md border border-border bg-card font-mono text-xs font-semibold text-primary">
              SM
            </span>
            <span>StockMate</span>
          </Link>

          <nav
            aria-label="Landing sections"
            className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex"
          >
            <Link
              href="#capabilities"
              className="transition-colors hover:text-foreground"
            >
              Capabilities
            </Link>
            <Link
              href="#how-it-works"
              className="transition-colors hover:text-foreground"
            >
              Shift flow
            </Link>
            <Link href="#demo" className="transition-colors hover:text-foreground">
              Demo register
            </Link>
          </nav>

          <Link href="/login" className={buttonVariants({ size: 'sm' })}>
            <span>Sign in</span>
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-12 sm:px-6 sm:py-20 lg:grid-cols-2 lg:px-8">
          <div className="space-y-6">
            <h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Run your shop counter, cash drawer, and stock in one ledger
            </h1>
            <p className="max-w-prose text-base text-muted-foreground sm:text-lg">
              StockMate is built for neighborhood mini-marts and retail shops handling
              fast ETB cash and digital sales. Ring up tickets in seconds, check your
              daily till variance, and catch low stock before shelves run dry.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/login" className={buttonVariants({ size: 'lg' })}>
                <span>Sign in to register</span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link
                href="#capabilities"
                className={buttonVariants({ variant: 'outline', size: 'lg' })}
              >
                Explore capabilities
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              Try the live Dawit&apos;s Kiosk demo register with phone{' '}
              <span className="font-mono font-medium text-foreground">0911000000</span>{' '}
              and PIN <span className="font-mono font-medium text-foreground">1234</span>.
            </p>
          </div>

          <Card>
            <CardHeader className="border-b border-border pb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>Counter ticket preview</CardTitle>
                <Badge variant="success">Shift open · EAT</Badge>
              </div>
              <CardDescription>
                Sample checkout showing integer-cent ETB totals and atomic stock updates.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <dl className="divide-y divide-border text-sm">
                {PREVIEW_TICKET_LINES.map((line) => (
                  <div
                    key={line.name}
                    className="flex items-center justify-between gap-3 py-2.5 first:pt-0"
                  >
                    <div className="min-w-0">
                      <dt className="truncate font-medium text-foreground">
                        {line.name}
                      </dt>
                      <dd className="font-mono text-xs tabular-nums text-muted-foreground">
                        {line.meta}
                      </dd>
                    </div>
                    <dd className="shrink-0 font-mono font-semibold tabular-nums text-foreground">
                      {line.total}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3 text-xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Cash tendered</span>
                  <span className="font-mono tabular-nums text-foreground">
                    700.00 ETB
                  </span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Change due</span>
                  <span className="font-mono font-medium tabular-nums text-primary">
                    60.00 ETB
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-2 text-sm font-semibold text-foreground">
                  <span>Total due</span>
                  <span className="font-mono tabular-nums">640.00 ETB</span>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-success-border bg-success-soft px-3 py-2 text-xs font-medium text-success">
                <Check className="size-4 shrink-0" aria-hidden="true" />
                <span>
                  Sale recorded · Inventory updated atomically · Voidable for 15m
                </span>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Capabilities */}
        <section id="capabilities" className="border-y border-border bg-muted/40">
          <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
            <div className="max-w-2xl space-y-2">
              <h2 className="text-balance text-3xl font-semibold tracking-tight text-foreground">
                Four workspaces connected to one store ledger
              </h2>
              <p className="text-muted-foreground">
                Every sale, void, and restock writes through the same database rules so
                your till and stock counts stay aligned all day.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {CAPABILITIES.map(({ icon: Icon, title, description }) => (
                <Card key={title}>
                  <CardHeader>
                    <div className="mb-2 flex size-9 items-center justify-center rounded-md border border-border bg-background">
                      <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                    </div>
                    <CardTitle>{title}</CardTitle>
                    <CardDescription className="text-sm leading-relaxed">
                      {description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Shift Workflow & Invariants */}
        <section
          id="how-it-works"
          className="mx-auto w-full max-w-6xl space-y-8 px-4 py-14 sm:px-6 sm:py-20 lg:px-8"
        >
          <div className="max-w-2xl space-y-2">
            <h2 className="text-balance text-3xl font-semibold tracking-tight text-foreground">
              Built for fast shifts and clean end-of-day closes
            </h2>
            <p className="text-muted-foreground">
              Designed around real counter bottlenecks: quick error recovery, strict stock
              guards, and zero floating-point rounding drift.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {SHIFT_STEPS.map((item) => (
              <Card key={item.step}>
                <CardHeader>
                  <CardTitle>{item.step}</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    {item.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2 font-medium text-foreground">
              <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
              Server-enforced register guarantees:
            </span>
            <span>Integer ETB cents only</span>
            <span>·</span>
            <span>Idempotent checkouts</span>
            <span>·</span>
            <span>Store-scoped session isolation</span>
          </div>
        </section>

        {/* Closing CTA Band */}
        <section
          id="demo"
          className="mx-auto w-full max-w-6xl px-4 pb-14 sm:px-6 sm:pb-20 lg:px-8"
        >
          <div className="flex flex-col gap-6 rounded-xl bg-primary px-6 py-10 text-primary-foreground sm:px-10 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <h2 className="max-w-xl text-balance text-3xl font-semibold tracking-tight">
                Open the register and test a live shift
              </h2>
              <p className="max-w-xl text-primary-foreground/90">
                Sign in with your store credentials or explore Dawit&apos;s Kiosk demo
                shop using phone 0911000000 and PIN 1234.
              </p>
            </div>
            <div className="shrink-0">
              <Link
                href="/login"
                className={buttonVariants({ variant: 'secondary', size: 'lg' })}
              >
                <span>Open shift sign in</span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>StockMate · Retail Counter, Daily Till &amp; Inventory Ledger</p>
          <nav className="flex items-center gap-6">
            <Link href="/login" className="transition-colors hover:text-foreground">
              Cashier sign in
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
