'use client';

import * as React from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastVariant = 'default' | 'success' | 'warning' | 'error';

export interface ToastOptions {
  message: string;
  variant?: ToastVariant;
  durationMs?: number;
}

interface ToastItem extends Required<ToastOptions> {
  id: string;
}

interface ToastContextValue {
  toast: (options: ToastOptions | string) => string;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

const TOAST_STYLES: Record<ToastVariant, string> = {
  default: 'border-border bg-foreground text-card',
  success: 'border-primary-border bg-primary text-primary-foreground',
  warning: 'border-warning-border bg-warning text-primary-foreground',
  error: 'border-destructive-border bg-destructive text-destructive-foreground',
};

const TOAST_ICONS: Record<ToastVariant, React.ComponentType<{ className?: string }>> = {
  default: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
};

/**
 * Provides application-wide transient feedback toasts rendered in a bottom-center portal region.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const timersRef = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = React.useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toast = React.useCallback(
    (options: ToastOptions | string) => {
      const normalized: ToastOptions =
        typeof options === 'string' ? { message: options } : options;
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const durationMs = normalized.durationMs ?? 2400;
      const item: ToastItem = {
        id,
        message: normalized.message,
        variant: normalized.variant ?? 'default',
        durationMs,
      };

      setToasts((prev) => [...prev.slice(-3), item]);

      if (durationMs > 0) {
        const timer = setTimeout(() => {
          dismiss(id);
        }, durationMs);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [dismiss]
  );

  React.useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div
        id="toast-container"
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed bottom-4 left-1/2 z-50 flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4"
      >
        {toasts.map((item) => {
          const Icon = TOAST_ICONS[item.variant];
          return (
            <div
              key={item.id}
              role="status"
              className={cn(
                'animate-fade modal-elevation pointer-events-auto flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium',
                TOAST_STYLES[item.variant]
              )}
            >
              <Icon className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{item.message}</span>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Dismiss notification"
                className="ml-1 inline-flex size-4 shrink-0 items-center justify-center rounded-full opacity-80 transition-opacity hover:opacity-100"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
