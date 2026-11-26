import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

/**
 * Single-line text/numeric input with consistent hover, focus-visible,
 * disabled, and aria-invalid error styling.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', error, disabled, ...props }, ref) => {
    const isInvalid = Boolean(error || props['aria-invalid']);

    return (
      <input
        ref={ref}
        type={type}
        disabled={disabled}
        aria-invalid={isInvalid || undefined}
        className={cn(
          'flex h-10 w-full rounded-md border bg-card px-3 py-2 text-sm text-foreground transition-colors',
          'placeholder:text-subtle-foreground',
          'hover:border-border-strong',
          'focus-visible:border-primary',
          'disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60',
          isInvalid
            ? 'border-destructive bg-destructive-soft/40 focus-visible:border-destructive'
            : 'border-input',
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
