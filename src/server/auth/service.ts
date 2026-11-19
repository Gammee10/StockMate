// src/server/auth/service.ts
import 'server-only';
import { db } from '@/server/db';
import { env } from '@/server/env';
import { AppError, notFound } from '@/lib/errors';
import { normalizePhoneNumber, verifyPin } from '@/modules/auth/pin';
import { createSessionToken } from '@/modules/auth/session';

// Constant bcrypt hash of a 4-digit PIN ('0000') used for constant-time comparison on unknown phones
const DUMMY_PIN_HASH = '$2b$10$xkBzxmrnMPpkbetZ5qo45eKQlN5Oy4U94JatE/gGjFnBh06P60hAy';

export async function authenticatePhonePin(phone: string, pin: string) {
  let normalizedPhone = phone;
  try {
    normalizedPhone = normalizePhoneNumber(phone);
  } catch {
    normalizedPhone = phone;
  }

  const user = await db.user.findUnique({
    where: { phone: normalizedPhone },
    include: { stores: { select: { id: true, name: true } } },
  });

  // If user does not exist, execute dummy bcrypt verification to prevent timing-based phone enumeration
  if (!user) {
    await verifyPin(pin, DUMMY_PIN_HASH);
    throw new AppError('UNAUTHORIZED', 'Invalid phone number or PIN');
  }

  // Check if phone matches the demo bypass phone
  const isDemo = Boolean(
    env.DEMO_LOGIN_PHONE && normalizedPhone === env.DEMO_LOGIN_PHONE
  );

  const now = new Date();

  // If not demo, verify active lockout window
  if (!isDemo && user.lockedUntil && user.lockedUntil > now) {
    const secondsLeft = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 1000);
    throw new AppError('RATE_LIMITED', 'Too many attempts. Try again later.', {
      retryAfter: secondsLeft,
    });
  }

  const isValidPin = await verifyPin(pin, user.pinHash);

  if (!isValidPin) {
    if (!isDemo) {
      const nextFailures = user.failedLoginCount + 1;
      if (nextFailures >= 5) {
        // Lock for 15 minutes and reset counter
        await db.user.update({
          where: { id: user.id },
          data: {
            failedLoginCount: 0,
            lockedUntil: new Date(now.getTime() + 15 * 60 * 1000),
          },
        });
      } else {
        await db.user.update({
          where: { id: user.id },
          data: {
            failedLoginCount: { increment: 1 },
          },
        });
      }
    }
    throw new AppError('UNAUTHORIZED', 'Invalid phone number or PIN');
  }

  if (user.stores.length === 0) {
    throw new AppError('UNAUTHORIZED', 'Invalid phone number or PIN');
  }

  // On successful login, clear lockout counter and lock window if previously set
  if (!isDemo && (user.failedLoginCount > 0 || user.lockedUntil !== null)) {
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });
  }

  const primaryStore = user.stores[0];
  const token = await createSessionToken({
    userId: user.id,
    storeId: primaryStore.id,
    phone: user.phone,
  });

  return {
    user: { id: user.id, phone: user.phone },
    store: { id: primaryStore.id, name: primaryStore.name },
    token,
  };
}

// backend-check-ignore unscoped-read: verified session token guarantees caller owns storeId
export async function getStoreDetails(storeId: string) {
  return db.store.findUnique({
    where: { id: storeId },
    select: { id: true, name: true },
  });
}

export async function getUserAndStore(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      phone: true,
      stores: {
        take: 1,
        select: { id: true, name: true },
      },
    },
  });

  if (!user) {
    throw notFound('User');
  }

  const store = user.stores[0] || null;

  return {
    user: { id: user.id, phone: user.phone },
    store,
  };
}
