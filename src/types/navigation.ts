// src/types/navigation.ts
import type { ReactNode } from 'react';

export type NavIconName = 'shopping-cart' | 'calculator' | 'package' | 'trending-up';

export interface NavItem {
  label: string;
  href: string;
  icon: NavIconName;
}

export interface NavigationShellProps {
  children?: ReactNode;
  storeName?: string;
}
