'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const MODAL_SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
} as const;

export type ModalSize = keyof typeof MODAL_SIZES;

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  size?: ModalSize;
  position?: 'center' | 'sheet';
  closeOnBackdrop?: boolean;
  ariaLabelledBy?: string;
  ariaLabel?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Accessible dialog overlay supporting centered modals and bottom-sheet drawers on small screens.
 */
export function Modal({
  open,
  onClose,
  size = 'md',
  position = 'center',
  closeOnBackdrop = true,
  ariaLabelledBy,
  ariaLabel,
  className,
  children,
}: ModalProps) {
  React.useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
      aria-label={ariaLabel}
      onClick={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) {
          onClose();
        }
      }}
      className={cn(
        'fixed inset-0 z-50 flex bg-foreground/40',
        position === 'sheet'
          ? 'items-end justify-center p-0 sm:items-center sm:p-4'
          : 'items-center justify-center p-4'
      )}
    >
      <div
        className={cn(
          'modal-card-enter modal-elevation w-full overflow-hidden border border-border bg-card text-card-foreground',
          position === 'sheet'
            ? 'max-h-[90dvh] rounded-t-xl sm:rounded-xl'
            : 'max-h-[90dvh] rounded-xl',
          MODAL_SIZES[size],
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function ModalHeader({
  className,
  onClose,
  children,
}: {
  className?: string;
  onClose?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 border-b border-border px-5 py-4',
        className
      )}
    >
      <div className="min-w-0 flex-1 space-y-0.5">{children}</div>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

export function ModalTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        'text-base font-semibold leading-snug tracking-tight text-foreground',
        className
      )}
      {...props}
    />
  );
}

export function ModalDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-xs text-muted-foreground', className)} {...props} />;
}

export function ModalBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('overflow-y-auto px-5 py-4', className)} {...props} />;
}

export function ModalFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-end gap-2 border-t border-border bg-background/60 px-5 py-3.5',
        className
      )}
      {...props}
    />
  );
}
