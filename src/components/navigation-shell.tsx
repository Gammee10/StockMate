// src/components/navigation-shell.tsx
'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ShoppingCart,
  Calculator,
  Package,
  CheckCircle2,
  LogOut,
  Store,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface NavItem {
  label: string;
  href: string;
  icon: 'shopping-cart' | 'calculator' | 'package' | 'trending-up';
}

export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Counter', href: '/counter', icon: 'shopping-cart' },
  { label: 'Daily till', href: '/till', icon: 'calculator' },
  { label: 'Inventory', href: '/inventory', icon: 'package' },
  { label: 'Analytics', href: '/analytics', icon: 'trending-up' },
];

export function isNavActive(currentPath: string, targetHref: string): boolean {
  if (targetHref === '/counter') {
    return (
      currentPath === '/' ||
      currentPath === '/counter' ||
      currentPath.startsWith('/counter/')
    );
  }
  return currentPath === targetHref || currentPath.startsWith(`${targetHref}/`);
}

interface NavigationShellProps {
  children?: ReactNode;
  storeName?: string;
}

export function NavigationShell({
  children,
  storeName = "Dawit's Kiosk",
}: NavigationShellProps) {
  const pathname = usePathname() || '/counter';

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.href = '/login';
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Global Navigation Header */}
      <header className="bg-background/95 sticky top-0 z-40 border-b border-border backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-2.5 px-4 py-3 sm:px-6">
          {/* Top Bar: Brand, Store Metadata, Status & Logout */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg border border-border bg-muted">
                <Store className="size-4 text-foreground" />
              </div>
              <div className="leading-tight">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold tracking-tight text-foreground">
                    StockMate
                  </span>
                  <Badge variant="success" className="h-5 px-1.5 text-xs">
                    <CheckCircle2 className="mr-1 size-3" />
                    <span>Online</span>
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{storeName}</p>
              </div>
            </div>

            {/* Desktop Navigation Links */}
            <nav
              className="hidden items-center gap-1 sm:flex"
              aria-label="Main Navigation"
            >
              {NAV_ITEMS.map((item) => {
                const active = isNavActive(pathname, item.href);
                const IconComponent =
                  item.icon === 'shopping-cart'
                    ? ShoppingCart
                    : item.icon === 'calculator'
                      ? Calculator
                      : item.icon === 'package'
                        ? Package
                        : TrendingUp;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex h-9 items-center gap-2 rounded-md px-3 text-xs font-medium transition-colors',
                      active
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                    style={{ touchAction: 'manipulation' }}
                    aria-current={active ? 'page' : undefined}
                  >
                    <IconComponent className="size-3.5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Logout Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={handleLogout}
              aria-label="Sign out"
              className="size-8 shrink-0"
              style={{ touchAction: 'manipulation' }}
            >
              <LogOut className="size-4" />
            </Button>
          </div>

          {/* Mobile Navigation Tabs (Touch targets >= 44dp) */}
          <nav
            className="bg-muted/50 grid grid-cols-4 gap-1 rounded-lg border border-border p-1 sm:hidden"
            aria-label="Mobile Navigation Tabs"
          >
            {NAV_ITEMS.map((item) => {
              const active = isNavActive(pathname, item.href);
              const IconComponent =
                item.icon === 'shopping-cart'
                  ? ShoppingCart
                  : item.icon === 'calculator'
                    ? Calculator
                    : item.icon === 'package'
                      ? Package
                      : TrendingUp;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex h-11 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors',
                    active
                      ? 'bg-background font-semibold text-foreground shadow-sm'
                      : 'hover:bg-background/50 text-muted-foreground hover:text-foreground'
                  )}
                  style={{ touchAction: 'manipulation' }}
                  aria-current={active ? 'page' : undefined}
                >
                  <IconComponent className="size-3.5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Page Area */}
      <div className="flex-1">{children}</div>
    </div>
  );
}
