import { describe, it, expect } from 'vitest';
import { getEatStartOfDayUtc, isWithinVoidWindow } from './timezone';

describe('Sales Timezone Helpers', () => {
  describe('getEatStartOfDayUtc', () => {
    it('returns 21:00:00.000Z of the previous UTC day for an afternoon EAT timestamp', () => {
      // 2026-11-17 14:30:00 UTC = 17:30:00 EAT (UTC+3)
      const now = new Date('2026-11-17T14:30:00.000Z');
      const startOfDay = getEatStartOfDayUtc(now);

      // Midnight EAT on Nov 17 is 2026-11-16 21:00:00 UTC
      expect(startOfDay.toISOString()).toBe('2026-11-16T21:00:00.000Z');
    });

    it('returns 21:00:00.000Z of the previous UTC day for an early morning UTC timestamp that is already daytime in EAT', () => {
      // 2026-11-17 01:15:00 UTC = 04:15:00 EAT on Nov 17
      const now = new Date('2026-11-17T01:15:00.000Z');
      const startOfDay = getEatStartOfDayUtc(now);

      expect(startOfDay.toISOString()).toBe('2026-11-16T21:00:00.000Z');
    });

    it('correctly handles the transition right before EAT midnight (20:59:59 UTC)', () => {
      // 2026-11-16 20:59:59 UTC = 23:59:59 EAT on Nov 16
      const now = new Date('2026-11-16T20:59:59.000Z');
      const startOfDay = getEatStartOfDayUtc(now);

      // Midnight EAT on Nov 16 is 2026-11-15 21:00:00 UTC
      expect(startOfDay.toISOString()).toBe('2026-11-15T21:00:00.000Z');
    });

    it('correctly handles the transition right at EAT midnight (21:00:00 UTC)', () => {
      // 2026-11-16 21:00:00 UTC = 00:00:00 EAT on Nov 17
      const now = new Date('2026-11-16T21:00:00.000Z');
      const startOfDay = getEatStartOfDayUtc(now);

      // Midnight EAT on Nov 17 is 2026-11-16 21:00:00 UTC
      expect(startOfDay.toISOString()).toBe('2026-11-16T21:00:00.000Z');
    });
  });

  describe('isWithinVoidWindow', () => {
    const fixedNow = new Date('2026-11-17T12:00:00.000Z');

    it('returns true for a transaction created right now (0 minutes ago)', () => {
      const createdAt = new Date('2026-11-17T12:00:00.000Z');
      expect(isWithinVoidWindow(createdAt, 15, fixedNow)).toBe(true);
    });

    it('returns true for a transaction created 14 minutes and 59 seconds ago', () => {
      const createdAt = new Date('2026-11-17T11:45:01.000Z');
      expect(isWithinVoidWindow(createdAt, 15, fixedNow)).toBe(true);
    });

    it('returns true for a transaction created exactly 15 minutes ago', () => {
      const createdAt = new Date('2026-11-17T11:45:00.000Z');
      expect(isWithinVoidWindow(createdAt, 15, fixedNow)).toBe(true);
    });

    it('returns false for a transaction created 15 minutes and 1 second ago', () => {
      const createdAt = new Date('2026-11-17T11:44:59.000Z');
      expect(isWithinVoidWindow(createdAt, 15, fixedNow)).toBe(false);
    });

    it('returns false for a transaction created hours ago', () => {
      const createdAt = new Date('2026-11-17T08:00:00.000Z');
      expect(isWithinVoidWindow(createdAt, 15, fixedNow)).toBe(false);
    });

    it('handles ISO string inputs seamlessly', () => {
      const createdAtStr = '2026-11-17T11:55:00.000Z'; // 5 minutes ago
      expect(isWithinVoidWindow(createdAtStr, 15, fixedNow)).toBe(true);
    });
  });
});
