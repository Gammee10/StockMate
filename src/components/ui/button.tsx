'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import {
  buttonVariants,
  type ButtonSize,
  type ButtonVariant,
} from '@/components/ui/button-variants';

export { buttonVariants, type ButtonSize, type ButtonVariant };

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
        className={buttonVariants({ variant, size, className })}
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
