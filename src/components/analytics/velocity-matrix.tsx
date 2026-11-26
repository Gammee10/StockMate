// src/components/analytics/velocity-matrix.tsx
'use client';

import { useMemo } from 'react';
import {
  AlertTriangle,
  Flame,
  Turtle,
  Coins,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import type { ProductQuadrant, ProductVelocityMetrics } from '@/types/analytics';
import { groupProductsByQuadrant } from './chart-utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { formatMoney } from '@/lib/money';

interface VelocityMatrixProps {
  products: ProductVelocityMetrics[];
  selectedQuadrant: ProductQuadrant | null;
  onSelectQuadrant: (quadrant: ProductQuadrant | null) => void;
}

export function VelocityMatrix({
  products,
  selectedQuadrant,
  onSelectQuadrant,
}: VelocityMatrixProps) {
  const groupedQuadrants = useMemo(() => groupProductsByQuadrant(products), [products]);

  const quadrants: Array<{
    key: ProductQuadrant;
    icon: typeof Flame;
    accentBorder: string;
    accentBg: string;
  }> = [
    {
      key: 'urgent_restock',
      icon: AlertTriangle,
      accentBorder: 'border-destructive/40',
      accentBg: 'bg-destructive/5',
    },
    {
      key: 'star_performer',
      icon: Flame,
      accentBorder: 'border-success/40',
      accentBg: 'bg-success/5',
    },
    {
      key: 'slow_mover',
      icon: Turtle,
      accentBorder: 'border-border',
      accentBg: 'bg-muted/30',
    },
    {
      key: 'dead_capital',
      icon: Coins,
      accentBorder: 'border-warning/40',
      accentBg: 'bg-warning/5',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Strategic Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-foreground">
            2×2 Retail Strategy Matrix
          </h4>
          <p className="text-xs text-muted-foreground">
            Classifies inventory by sales demand velocity vs shelf stock availability
          </p>
        </div>
        {selectedQuadrant && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onSelectQuadrant(null)}
            className="h-8 text-xs text-muted-foreground hover:text-foreground"
          >
            Clear matrix filter
          </Button>
        )}
      </div>

      {/* 2x2 Responsive Quadrant Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {quadrants.map(({ key, icon: Icon, accentBorder, accentBg }) => {
          const data = groupedQuadrants[key];
          const isSelected = selectedQuadrant === key;
          const topPreview = data.products.slice(0, 3);

          return (
            <Card
              key={key}
              className={`transition-colors ${accentBg} ${
                isSelected
                  ? 'ring-primary/20 border-primary shadow-sm ring-2'
                  : accentBorder
              }`}
            >
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="shadow-xs flex size-7 items-center justify-center rounded-md bg-background">
                      <Icon className="size-4 text-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold">
                        {data.title}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {data.subtitle}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant={data.badgeVariant} className="shrink-0 text-xs">
                    {data.products.length} {data.products.length === 1 ? 'item' : 'items'}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 p-4 pt-2">
                {/* Metric Summary Bar */}
                <div className="border-border/50 bg-background/80 grid grid-cols-2 gap-2 rounded-lg border p-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Shelf Stock:</span>
                    <p className="font-semibold tabular-nums text-foreground">
                      {data.totalStockUnits} units
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">30d Revenue:</span>
                    <p className="font-semibold tabular-nums text-foreground">
                      {formatMoney(data.totalRevenueCents)}
                    </p>
                  </div>
                </div>

                {/* Strategic Advice */}
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Action:</span>{' '}
                  {data.actionPrompt}
                </p>

                {/* Top Items Preview */}
                {topPreview.length > 0 ? (
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      Key Items:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {topPreview.map((item) => (
                        <span
                          key={item.productId}
                          className="shadow-2xs border-border/40 inline-flex items-center gap-1 rounded border bg-background px-2 py-0.5 text-xs text-foreground"
                        >
                          <span className="font-medium">{item.productName}</span>
                          <span className="text-muted-foreground">
                            ({item.currentStock} in stock)
                          </span>
                        </span>
                      ))}
                      {data.products.length > 3 && (
                        <span className="inline-flex items-center px-1 text-xs text-muted-foreground">
                          +{data.products.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="py-1 text-xs italic text-muted-foreground">
                    No items in this quadrant.
                  </p>
                )}

                {/* Filter Trigger Button */}
                <Button
                  type="button"
                  variant={isSelected ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onSelectQuadrant(isSelected ? null : key)}
                  className="w-full justify-between text-xs font-medium"
                  style={{ touchAction: 'manipulation' }}
                >
                  <span>
                    {isSelected
                      ? 'Catalog filtered by this quadrant'
                      : `View ${data.products.length} ${data.title} items`}
                  </span>
                  {isSelected ? (
                    <CheckCircle2 className="size-3.5" />
                  ) : (
                    <ArrowRight className="size-3.5" />
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
