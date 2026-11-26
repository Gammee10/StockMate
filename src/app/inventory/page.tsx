'use client';

import Link from 'next/link';
import { Package } from 'lucide-react';
import { NavigationShell } from '@/components/navigation-shell';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function InventoryPage() {
  return (
    <NavigationShell>
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          title="Inventory"
          description="Active store catalog, low-stock filters, quick restock, and archival."
          badge={<Badge variant="outline">Catalog</Badge>}
          actions={
            <Link href="/counter">
              <Button variant="outline" size="sm">
                Back to counter
              </Button>
            </Link>
          }
        />

        <Card>
          <CardHeader>
            <CardTitle>Store products</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">
                      Price
                    </TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Restock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={4} className="p-4">
                      <EmptyState
                        icon={Package}
                        title="Inventory shell is wired"
                        description="Product search, creation modal, +5/+10 restock, and soft archival will connect here next."
                      />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </NavigationShell>
  );
}
