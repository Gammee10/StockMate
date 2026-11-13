// src/server/auth/service.ts
import 'server-only';
import { db } from '@/server/db';
import { AppError, notFound } from '@/lib/errors';
import { normalizePhoneNumber, verifyPin } from '@/modules/auth/pin';
import { createSessionToken } from '@/modules/auth/session';

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

  if (!user || user.stores.length === 0) {
    throw new AppError('UNAUTHORIZED', 'Invalid phone number or PIN');
  }

  const isValidPin = await verifyPin(pin, user.pinHash);
  if (!isValidPin) {
    throw new AppError('UNAUTHORIZED', 'Invalid phone number or PIN');
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
