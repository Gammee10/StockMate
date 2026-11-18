import { describe, it, expect } from 'vitest';
import { NAV_ITEMS, isNavActive } from './navigation-shell';

describe('Global Navigation Shell Helpers', () => {
  it('defines the required multi-page navigation items', () => {
    expect(NAV_ITEMS).toHaveLength(4);
    expect(NAV_ITEMS[0]).toMatchObject({
      label: 'Counter',
      href: '/counter',
    });
    expect(NAV_ITEMS[1]).toMatchObject({
      label: 'Daily till',
      href: '/till',
    });
    expect(NAV_ITEMS[2]).toMatchObject({
      label: 'Inventory',
      href: '/inventory',
    });
    expect(NAV_ITEMS[3]).toMatchObject({
      label: 'Analytics',
      href: '/analytics',
    });
  });

  describe('isNavActive', () => {
    it('marks /counter as active when on /counter', () => {
      expect(isNavActive('/counter', '/counter')).toBe(true);
      expect(isNavActive('/counter', '/till')).toBe(false);
      expect(isNavActive('/counter', '/inventory')).toBe(false);
      expect(isNavActive('/counter', '/analytics')).toBe(false);
    });

    it('marks /counter as active when on root /', () => {
      expect(isNavActive('/', '/counter')).toBe(true);
      expect(isNavActive('/', '/till')).toBe(false);
      expect(isNavActive('/', '/inventory')).toBe(false);
      expect(isNavActive('/', '/analytics')).toBe(false);
    });

    it('marks /till as active when on /till', () => {
      expect(isNavActive('/till', '/till')).toBe(true);
      expect(isNavActive('/till', '/counter')).toBe(false);
      expect(isNavActive('/till', '/inventory')).toBe(false);
      expect(isNavActive('/till', '/analytics')).toBe(false);
    });

    it('marks /inventory as active when on /inventory', () => {
      expect(isNavActive('/inventory', '/inventory')).toBe(true);
      expect(isNavActive('/inventory', '/counter')).toBe(false);
      expect(isNavActive('/inventory', '/till')).toBe(false);
      expect(isNavActive('/inventory', '/analytics')).toBe(false);
    });

    it('marks /analytics as active when on /analytics', () => {
      expect(isNavActive('/analytics', '/analytics')).toBe(true);
      expect(isNavActive('/analytics', '/counter')).toBe(false);
      expect(isNavActive('/analytics', '/till')).toBe(false);
      expect(isNavActive('/analytics', '/inventory')).toBe(false);
    });

    it('handles nested sub-routes correctly', () => {
      expect(isNavActive('/inventory/new', '/inventory')).toBe(true);
      expect(isNavActive('/till/2026-11-18', '/till')).toBe(true);
      expect(isNavActive('/analytics/7d', '/analytics')).toBe(true);
    });
  });
});
