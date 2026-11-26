'use client';

import Link from 'next/link';
import { Receipt, ShoppingCart } from 'lucide-react';
import { NavigationShell } from '@/components/navigation-shell';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

export default function CounterPage() {
  return (
    <NavigationShell>
      <div className="flex flex-col lg:h-full lg:flex-row">
        {/* Catalog Stage */}
        <section className="min-w-0 flex-1 space-y-6 px-4 py-6 sm:px-6">
          <PageHeader
            title="Counter"
            description="Tap catalog products to build the active customer sale."
            badge={<Badge variant="outline">Shell ready</Badge>}
            actions={
              <Link href="/till">
                <Button variant="outline" size="sm">
                  View daily till
                </Button>
              </Link>
            }
          />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <Card key={index} className="p-4">
                <div className="space-y-3">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-3/4" />
                  <div className="flex items-center justify-between pt-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-10" />
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <EmptyState
            icon={ShoppingCart}
            title="Counter workspace shell is wired"
            description="Live catalog grid, inline steppers, and checkout flow will mount here next."
            action={
              <Link href="/inventory">
                <Button variant="outline" size="sm">
                  Inspect inventory route
                </Button>
              </Link>
            }
          />
        </section>

        {/* Docked Checkout Rail Placeholder */}
        <aside
          aria-label="Current sale rail"
          className="w-full shrink-0 border-t border-border bg-card lg:w-96 lg:border-l lg:border-t-0"
        >
          <div className="flex h-full flex-col justify-between">
            <CardHeader className="border-b border-border">
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Current sale</CardTitle>
                <Badge variant="secondary">0 items</Badge>
              </div>
              <CardDescription>
                Select items from the counter to calculate totals.
              </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-1 flex-col justify-center py-8">
              <EmptyState
                icon={Receipt}
                title="No active ticket"
                description="Cart items, payment method toggle, and cash change helper appear here."
              />
            </CardContent>

            <div className="space-y-3 border-t border-dashed border-border-strong p-5">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Total due</span>
                <span className="font-mono text-2xl font-semibold tabular-nums text-foreground">
                  0.00 ETB
                </span>
              </div>
              <Button size="counter" disabled className="w-full">
                Select items to charge
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </NavigationShell>
  );
}
