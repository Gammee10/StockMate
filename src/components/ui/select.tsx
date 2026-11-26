import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

/**
 * Native accessible select control styled with StockMate border, chevron,
 * focus-visible, disabled, and error tokens.
 */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, disabled, children, ...props }, ref) => {
    const isInvalid = Boolean(error || props['aria-invalid']);

    return (
      <div className="relative w-full">
        <select
          ref={ref}
          disabled={disabled}
          aria-invalid={isInvalid || undefined}
          className={cn(
            'block h-10 w-full appearance-none truncate rounded-md border bg-card py-2 pl-3 pr-9 text-sm text-foreground transition-colors',
            'hover:border-border-strong',
            'focus-visible:border-primary',
            'disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60',
            isInvalid
              ? 'border-destructive bg-destructive-soft/40 focus-visible:border-destructive'
              : 'border-input',
            className
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
    );
  }
);

Select.displayName = 'Select';
