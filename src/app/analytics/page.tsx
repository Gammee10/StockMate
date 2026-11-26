'use client';

import Link from 'next/link';
import { TrendingUp } from 'lucide-react';
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

export default function AnalyticsPage() {
  return (
    <NavigationShell>
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          title="Analytics"
          description="Stock velocity, runway days, dead capital, and wholesale reorder planning."
          badge={<Badge variant="outline">7d window</Badge>}
          actions={
            <Link href="/counter">
              <Button variant="outline" size="sm">
                Back to counter
              </Button>
            </Link>
          }
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Velocity &amp; distribution</CardTitle>
              <CardDescription>Stock health across active SKUs.</CardDescription>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reorder priority</CardTitle>
              <CardDescription>Items approaching runway threshold.</CardDescription>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
        </div>

        <EmptyState
          icon={TrendingUp}
          title="Analytics shell is wired"
          description="Interactive velocity charts, quadrant filters, and clipboard reorder export will connect here next."
        />
      </div>
    </NavigationShell>
  );
}
