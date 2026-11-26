'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Calculator,
  ChevronUp,
  LogOut,
  Menu,
  Package,
  ShoppingCart,
  TrendingUp,
  User,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLogout } from '@/hooks/use-auth';
import { fetchCurrentSession } from '@/lib/api/auth';
import { cn } from '@/lib/utils';
import type { NavIconName, NavItem, NavigationShellProps } from '@/types/navigation';

export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Counter', href: '/counter', icon: 'shopping-cart' },
  { label: 'Daily till', href: '/till', icon: 'calculator' },
  { label: 'Inventory', href: '/inventory', icon: 'package' },
  { label: 'Analytics', href: '/analytics', icon: 'trending-up' },
] as const;

export function isNavActive(pathname: string, href: string): boolean {
  if (href === '/counter') {
    return (
      pathname === '/' || pathname === '/counter' || pathname.startsWith('/counter/')
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

const NAV_ICONS: Record<NavIconName, React.ComponentType<{ className?: string }>> = {
  'shopping-cart': ShoppingCart,
  calculator: Calculator,
  package: Package,
  'trending-up': TrendingUp,
};

function getStoreInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'SM';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase();
}

function formatEatClock(): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Addis_Ababa',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date());
  } catch {
    return '--:--';
  }
}

/**
 * Authenticated workspace navigation shell providing a fixed desktop sidebar,
 * mobile top header with slide-out drawer, live store identity, and sign-out user menu.
 */
export function NavigationShell({
  children,
  storeName: initialStoreName,
}: NavigationShellProps) {
  const pathname = usePathname() || '/';
  const logout = useLogout();

  const [storeName, setStoreName] = React.useState(initialStoreName ?? 'Your store');
  const [cashierPhone, setCashierPhone] = React.useState<string | null>(null);
  const [eatClock, setEatClock] = React.useState('--:--');
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);

  React.useEffect(() => {
    if (initialStoreName) {
      setStoreName(initialStoreName);
    }
  }, [initialStoreName]);

  React.useEffect(() => {
    let active = true;
    fetchCurrentSession()
      .then((session) => {
        if (!active || !session) return;
        if (!initialStoreName && session.store?.name) {
          setStoreName(session.store.name);
        }
        if (session.user?.phone) {
          setCashierPhone(session.user.phone);
        }
      })
      .catch(() => {
        // Keep fallback store identity when offline or unauthenticated
      });

    return () => {
      active = false;
    };
  }, [initialStoreName]);

  React.useEffect(() => {
    setEatClock(formatEatClock());
    const id = setInterval(() => setEatClock(formatEatClock()), 30000);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    setMobileOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await logout();
  };

  const initials = getStoreInitials(storeName);

  return (
    <div className="flex min-h-screen w-full flex-col bg-background lg:h-screen lg:flex-row lg:overflow-hidden">
      {/* Mobile Top Bar (< 1024px) */}
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 lg:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-drawer"
          >
            <Menu className="size-5" aria-hidden="true" />
          </Button>
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-xs font-semibold text-primary">
              {initials}
            </span>
            <span className="truncate text-sm font-semibold text-foreground">
              {storeName}
            </span>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          loading={signingOut}
          onClick={handleSignOut}
          aria-label="Sign out"
        >
          <LogOut className="size-3.5" aria-hidden="true" />
          <span>Sign out</span>
        </Button>
      </header>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen ? (
        <div
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-foreground/35 lg:hidden"
        />
      ) : null}

      {/* Desktop Fixed Rail & Mobile Slide-Out Drawer */}
      <aside
        id="mobile-nav-drawer"
        aria-label="Primary navigation"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-60 shrink-0 flex-col justify-between border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200',
          'lg:static lg:z-auto lg:w-56 lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div>
          {/* Store Header */}
          <div className="flex items-center justify-between gap-2 border-b border-sidebar-border px-4 py-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-xs font-semibold text-primary">
                {initials}
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-foreground">
                  {storeName}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    className="size-1.5 shrink-0 rounded-full bg-success"
                    aria-hidden="true"
                  />
                  <span className="truncate">
                    Shift open ·{' '}
                    <span className="font-mono tabular-nums">{eatClock}</span>
                  </span>
                </div>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation menu"
              className="size-8 lg:hidden"
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>

          {/* Primary Route Navigation */}
          <nav className="space-y-1 p-3" aria-label="Store sections">
            {NAV_ITEMS.map((item) => {
              const Icon = NAV_ICONS[item.icon];
              const active = isNavActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex h-10 items-center gap-2.5 rounded-lg border px-3 text-sm font-medium transition-colors',
                    active
                      ? 'border-border bg-muted font-semibold text-foreground'
                      : 'border-transparent text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                  )}
                >
                  <Icon
                    className={cn(
                      'size-4 shrink-0',
                      active ? 'text-primary' : 'text-muted-foreground'
                    )}
                    aria-hidden="true"
                  />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Menu & Sign-Out Footer */}
        <div className="relative border-t border-sidebar-border p-3">
          {userMenuOpen ? (
            <div
              role="menu"
              aria-label="Cashier account menu"
              className="modal-elevation mb-2 space-y-2 rounded-lg border border-border bg-card p-3"
            >
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-foreground">{storeName}</p>
                <p className="font-mono text-xs tabular-nums text-muted-foreground">
                  {cashierPhone ?? 'Active session'}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                loading={signingOut}
                loadingText="Signing out"
                onClick={handleSignOut}
                className="w-full justify-start text-destructive hover:border-destructive-border hover:bg-destructive-soft hover:text-destructive"
              >
                <LogOut className="size-3.5" aria-hidden="true" />
                <span>Sign out</span>
              </Button>
            </div>
          ) : null}

          <div className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setUserMenuOpen((prev) => !prev)}
              aria-expanded={userMenuOpen}
              aria-haspopup="menu"
              className="h-auto w-full justify-between px-2 py-2 text-left"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
                  <User className="size-3.5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-foreground">
                    Cashier
                  </span>
                  <span className="block truncate font-mono text-xs tabular-nums text-muted-foreground">
                    {cashierPhone ?? 'Signed in'}
                  </span>
                </span>
              </span>
              <ChevronUp
                className={cn(
                  'size-3.5 shrink-0 text-muted-foreground transition-transform',
                  userMenuOpen ? 'rotate-180' : ''
                )}
                aria-hidden="true"
              />
            </Button>

            <Button
              variant="outline"
              size="sm"
              loading={signingOut}
              loadingText="Signing out"
              onClick={handleSignOut}
              className="w-full justify-start"
            >
              <LogOut className="size-3.5" aria-hidden="true" />
              <span>Sign out</span>
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Workspace Viewport */}
      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
