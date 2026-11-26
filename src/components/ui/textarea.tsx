import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

/**
 * Multi-line text input matching Input tokens for hover, focus-visible,
 * disabled, and validation error states.
 */
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, disabled, ...props }, ref) => {
    const isInvalid = Boolean(error || props['aria-invalid']);

    return (
      <textarea
        ref={ref}
        disabled={disabled}
        aria-invalid={isInvalid || undefined}
        className={cn(
          'flex min-h-20 w-full rounded-md border bg-card px-3 py-2 text-sm text-foreground transition-colors',
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

Textarea.displayName = 'Textarea';
