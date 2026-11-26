import * as React from 'react';
import { cn } from '@/lib/utils';

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * Calm loading placeholder matching final content dimensions without aggressive pulsing.
 */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('skeleton-shimmer rounded-md bg-muted', className)}
      {...props}
    />
  );
}
