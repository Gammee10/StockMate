import * as React from 'react';
import { cn } from '@/lib/utils';

const BADGE_VARIANTS = {
  default: 'border-transparent bg-primary text-primary-foreground',
  secondary: 'border-border bg-muted text-muted-foreground',
  outline: 'border-border bg-card text-foreground',
  success: 'border-success-border bg-success-soft text-success',
  warning: 'border-warning-border bg-warning-soft text-warning',
  destructive: 'border-destructive-border bg-destructive-soft text-destructive',
} as const;

export type BadgeVariant = keyof typeof BADGE_VARIANTS;

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

/**
 * Compact semantic status pill used for stock thresholds, sale status, and counts.
 */
export function Badge({ className, variant = 'secondary', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium leading-tight',
        BADGE_VARIANTS[variant],
        className
      )}
      {...props}
    />
  );
}
