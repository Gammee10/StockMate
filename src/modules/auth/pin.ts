import { z } from 'zod';
import bcrypt from 'bcryptjs';

/**
 * Normalizes an Ethiopian phone number to standard E.164 (+251XXXXXXXXX) format.
 * Accepts formats: 0911000000, 0712345678, +251911000000, 0911-000-000, etc.
 */
export function normalizePhoneNumber(rawPhone: string): string {
  const clean = rawPhone.trim().replace(/[\s\-()]/g, '');

  // Matches 09XXXXXXXX, 07XXXXXXXX, +2519XXXXXXXX, +2517XXXXXXXX
  const ethioMatch = clean.match(/^(?:\+251|0)([97]\d{8})$/);

  if (!ethioMatch) {
    throw new Error(
      'Invalid Ethiopian phone number format. Must start with 09, 07, or +251'
    );
  }

  return `+251${ethioMatch[1]}`;
}

export const phoneSchema = z
  .string()
  .min(1, 'Phone number is required')
  .transform((val, ctx) => {
    try {
      return normalizePhoneNumber(val);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Invalid Ethiopian phone number (expected 09... or 07... with 10 digits)',
      });
      return z.NEVER;
    }
  });

export const pinSchema = z
  .string()
  .regex(/^\d{4}$/, 'PIN must be exactly 4 numeric digits');

export const loginInputSchema = z.object({
  phone: phoneSchema,
  pin: pinSchema,
});

export type LoginInput = z.infer<typeof loginInputSchema>;

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}
