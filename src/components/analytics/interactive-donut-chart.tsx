// src/components/analytics/interactive-donut-chart.tsx
'use client';

import { useState, useMemo } from 'react';
import type {
  DonutSegment,
  InventoryDistribution,
  StockVelocityStatus,
} from '@/types/analytics';
import { calculateDonutSegments } from './chart-utils';
import { Button } from '@/components/ui/button';

interface InteractiveDonutChartProps {
  distribution: InventoryDistribution;
  selectedStatus: StockVelocityStatus | null;
  onSelectStatus: (status: StockVelocityStatus | null) => void;
}

export function InteractiveDonutChart({
  distribution,
  selectedStatus,
  onSelectStatus,
}: InteractiveDonutChartProps) {
  const [hoveredStatus, setHoveredStatus] = useState<StockVelocityStatus | null>(null);

  const radius = 38;
  const strokeWidth = 14;
  const viewBoxSize = 100;
  const center = viewBoxSize / 2;

  const segments = useMemo(
    () => calculateDonutSegments(distribution, radius),
    [distribution, radius]
  );

  // Active status being inspected (either hovered or pinned)
  const activeStatus = hoveredStatus || selectedStatus;

  const activeSegment: DonutSegment | null = useMemo(() => {
    if (!activeStatus) return null;
    return segments.find((s) => s.status === activeStatus) || null;
  }, [segments, activeStatus]);

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-between">
      {/* SVG Donut Container */}
      <div className="relative flex size-52 shrink-0 items-center justify-center">
        <svg
          viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
          className="size-full -rotate-90 transform"
          aria-label="Inventory health donut chart"
        >
          {/* Base Background Track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke="hsl(var(--muted))"
            strokeWidth={strokeWidth}
          />

          {/* Slices */}
          {segments.map((seg) => {
            if (seg.percentage <= 0) return null;
            const isHovered = activeStatus === seg.status;

            return (
              <circle
                key={seg.status}
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke={seg.svgColor}
                strokeWidth={isHovered ? strokeWidth + 2 : strokeWidth}
                strokeDasharray={seg.strokeDasharray}
                strokeDashoffset={seg.strokeDashoffset}
                strokeLinecap="round"
                className="cursor-pointer transition-colors duration-200"
                onMouseEnter={() => setHoveredStatus(seg.status)}
                onMouseLeave={() => setHoveredStatus(null)}
                onClick={() =>
                  onSelectStatus(selectedStatus === seg.status ? null : seg.status)
                }
                style={{ touchAction: 'manipulation' }}
              />
            );
          })}
        </svg>

        {/* Center Dynamic Label Readout */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {activeSegment ? (
            <div className="px-2">
              <span className="text-xl font-semibold tabular-nums text-foreground">
                {activeSegment.percentage}%
              </span>
              <p className="line-clamp-1 text-xs font-medium text-foreground">
                {activeSegment.count} items
              </p>
              <p className="line-clamp-1 text-xs text-muted-foreground">
                {activeSegment.label}
              </p>
            </div>
          ) : (
            <div>
              <span className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                {distribution.totalCount}
              </span>
              <p className="text-xs text-muted-foreground">Total items</p>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Legend Grid */}
      <div className="w-full flex-1 space-y-2">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Inventory health category</span>
          <span>Tap to filter catalog</span>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {segments.map((seg) => {
            const isSelected = selectedStatus === seg.status;

            return (
              <Button
                key={seg.status}
                type="button"
                variant={isSelected ? 'secondary' : 'outline'}
                onClick={() => onSelectStatus(isSelected ? null : seg.status)}
                onMouseEnter={() => setHoveredStatus(seg.status)}
                onMouseLeave={() => setHoveredStatus(null)}
                className={`h-auto min-h-11 w-full justify-between p-2.5 text-left font-normal ${
                  isSelected ? 'bg-primary/10 border-primary' : 'bg-card'
                }`}
                style={{ touchAction: 'manipulation' }}
              >
                <div className="flex items-center gap-2">
                  <div className={`size-3 shrink-0 rounded-full ${seg.colorClass}`} />
                  <div>
                    <div className="text-xs font-medium text-foreground">{seg.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {seg.percentage}% of catalog
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-semibold tabular-nums text-foreground">
                    {seg.count}
                  </span>
                </div>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
