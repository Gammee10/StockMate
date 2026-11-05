import { SignJWT, jwtVerify } from 'jose';
import type { SessionPayload } from './types';
import { validateEnv } from '@/config/env';

export const SESSION_COOKIE_NAME = 'stockmate_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

function getSecretKey(): Uint8Array {
  // Prefer process.env.JWT_SECRET directly for test overrides, fallback to validated env
  const secret = process.env.JWT_SECRET || validateEnv().JWT_SECRET;
  return new TextEncoder().encode(secret);
}

/**
 * Signs and issues a tamper-proof JWT session token using jose (Edge-compatible).
 */
export async function createSessionToken(payload: SessionPayload): Promise<string> {
  const secretKey = getSecretKey();

  return new SignJWT({
    userId: payload.userId,
    storeId: payload.storeId,
    phone: payload.phone,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secretKey);
}

/**
 * Cryptographically verifies the session token and extracts validated claims.
 * Returns null if the token is invalid, expired, or tampered with.
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  if (!token || typeof token !== 'string') {
    return null;
  }

  try {
    const secretKey = getSecretKey();
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256'],
    });

    if (!payload.userId || !payload.storeId || !payload.phone) {
      return null;
    }

    return {
      userId: payload.userId as string,
      storeId: payload.storeId as string,
      phone: payload.phone as string,
    };
  } catch {
    return null;
  }
}

/**
 * Returns standard security attributes for the session cookie.
 */
export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_MAX_AGE,
  };
}
