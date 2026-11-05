import { describe, it, expect } from 'vitest';
import { normalizePhoneNumber, pinSchema, phoneSchema, hashPin, verifyPin } from './pin';

describe('Auth Domain: PIN & Phone Helpers', () => {
  describe('normalizePhoneNumber', () => {
    it('normalizes local 09... and 07... Ethiopian formats to E.164 (+251...) format', () => {
      expect(normalizePhoneNumber('0911000000')).toBe('+251911000000');
      expect(normalizePhoneNumber('0712345678')).toBe('+251712345678');
      expect(normalizePhoneNumber('0911-000-000')).toBe('+251911000000');
      expect(normalizePhoneNumber(' 0911000000 ')).toBe('+251911000000');
    });

    it('leaves already valid E.164 numbers unchanged', () => {
      expect(normalizePhoneNumber('+251911000000')).toBe('+251911000000');
      expect(normalizePhoneNumber('+251711000000')).toBe('+251711000000');
    });

    it('throws validation error for invalid phone formats', () => {
      expect(() => normalizePhoneNumber('12345')).toThrow();
      expect(() => normalizePhoneNumber('0811000000')).toThrow();
    });
  });

  describe('phoneSchema', () => {
    it('accepts valid phone numbers and normalizes them', () => {
      const parsed = phoneSchema.safeParse('0911000000');
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data).toBe('+251911000000');
      }
    });

    it('rejects malformed numbers', () => {
      expect(phoneSchema.safeParse('abc').success).toBe(false);
      expect(phoneSchema.safeParse('0911').success).toBe(false);
    });
  });

  describe('pinSchema', () => {
    it('accepts exact 4-digit numeric string', () => {
      expect(pinSchema.safeParse('1234').success).toBe(true);
      expect(pinSchema.safeParse('0000').success).toBe(true);
      expect(pinSchema.safeParse('9876').success).toBe(true);
    });

    it('rejects pins with length !== 4 or non-numeric characters', () => {
      expect(pinSchema.safeParse('123').success).toBe(false);
      expect(pinSchema.safeParse('12345').success).toBe(false);
      expect(pinSchema.safeParse('123a').success).toBe(false);
      expect(pinSchema.safeParse('    ').success).toBe(false);
    });
  });

  describe('bcrypt hashPin & verifyPin', () => {
    it('hashes PIN with bcrypt and verifies correctly', async () => {
      const pin = '4321';
      const hash = await hashPin(pin);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(pin);
      expect(hash.startsWith('$2a$') || hash.startsWith('$2b$')).toBe(true);

      const isValid = await verifyPin(pin, hash);
      expect(isValid).toBe(true);

      const isInvalid = await verifyPin('9999', hash);
      expect(isInvalid).toBe(false);
    });
  });
});
