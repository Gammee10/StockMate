import * as React from 'react';
import { AlertCircle, Inbox, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  variant?: 'default' | 'error';
  className?: string;
}

/**
 * Calm centered empty or recoverable-error block with a neutral icon well and optional action.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = 'default',
  className,
}: EmptyStateProps) {
  const isError = variant === 'error';
  const IconComponent = icon ?? (isError ? AlertCircle : Inbox);

  return (
    <div
      role={isError ? 'alert' : undefined}
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border px-6 py-12 text-center',
        isError
          ? 'border-destructive-border bg-destructive-soft/50'
          : 'border-dashed border-border-strong bg-card',
        className
      )}
    >
      <div
        className={cn(
          'flex size-10 items-center justify-center rounded-lg border',
          isError
            ? 'border-destructive-border bg-card text-destructive'
            : 'border-border bg-muted text-muted-foreground'
        )}
      >
        <IconComponent className="size-5" aria-hidden="true" />
      </div>
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
