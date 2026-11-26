'use client';

import Link from 'next/link';
import { Calculator } from 'lucide-react';
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

const SUMMARY_CARDS = [
  { label: 'Gross sales', note: 'EAT day total' },
  { label: 'Cash sales', note: 'Cash drawer receipts' },
  { label: 'Digital sales', note: 'Telebirr and bank' },
  { label: 'Voided sales', note: 'Reversed within 15m' },
] as const;

export default function TillPage() {
  return (
    <NavigationShell>
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          title="Daily till"
          description="Today's EAT shift revenue summary and 15-minute sale voiding."
          badge={<Badge variant="outline">EAT timezone</Badge>}
          actions={
            <Link href="/counter">
              <Button variant="outline" size="sm">
                Back to counter
              </Button>
            </Link>
          }
        />

        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {SUMMARY_CARDS.map((item) => (
            <Card key={item.label} className="p-4">
              <dt className="text-xs font-medium text-muted-foreground">{item.label}</dt>
              <dd className="mt-2">
                <Skeleton className="h-6 w-28" />
              </dd>
              <dd className="mt-1 text-xs text-subtle-foreground">{item.note}</dd>
            </Card>
          ))}
        </dl>

        <Card>
          <CardHeader>
            <CardTitle>Recent transactions</CardTitle>
            <CardDescription>
              Completed sales remain voidable for 15 minutes from creation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={Calculator}
              title="Daily till ledger shell is wired"
              description="Live EAT sales summary and 15-minute void actions will connect here next."
            />
          </CardContent>
        </Card>
      </div>
    </NavigationShell>
  );
}
