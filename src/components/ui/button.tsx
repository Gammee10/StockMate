'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const VARIANT_CLASSES = {
  default:
    'bg-primary text-primary-foreground border border-transparent hover:bg-primary-hover',
  outline:
    'bg-card text-foreground border border-border hover:bg-muted hover:border-border-strong',
  secondary:
    'bg-muted text-foreground border border-border hover:bg-muted/80 hover:border-border-strong',
  ghost:
    'bg-transparent text-muted-foreground border border-transparent hover:bg-muted hover:text-foreground',
  destructive:
    'bg-destructive text-destructive-foreground border border-transparent hover:bg-destructive-hover',
  soft: 'bg-primary-soft text-primary border border-primary-border hover:bg-primary-soft/80',
} as const;

const SIZE_CLASSES = {
  sm: 'h-8 px-3 text-xs rounded-md',
  default: 'h-10 px-4 text-sm rounded-md',
  lg: 'h-12 px-5 text-sm rounded-lg',
  counter: 'min-h-16 min-w-16 px-4 text-sm rounded-lg',
  icon: 'h-10 w-10 rounded-md',
} as const;

export type ButtonVariant = keyof typeof VARIANT_CLASSES;
export type ButtonSize = keyof typeof SIZE_CLASSES;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingText?: string;
}

/**
 * Primary interactive button primitive supporting StockMate variants,
 * >=64dp counter touch targets, and explicit loading/disabled states.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'default',
      size = 'default',
      loading = false,
      loadingText,
      disabled,
      type = 'button',
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = Boolean(disabled || loading);

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        className={cn(
          'pressable inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors',
          'disabled:pointer-events-none disabled:opacity-45',
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
            <span>{loadingText ?? children}</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
