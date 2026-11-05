import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { loginInputSchema, verifyPin } from '@/modules/auth/pin';
import {
  createSessionToken,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from '@/modules/auth/session';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parseResult = loginInputSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: parseResult.error.issues[0]?.message || 'Invalid input credentials',
          },
        },
        { status: 400 }
      );
    }

    const { phone, pin } = parseResult.data;

    // 1. Look up user and associated stores
    const user = await db.user.findUnique({
      where: { phone },
      include: { stores: { select: { id: true, name: true } } },
    });

    if (!user || user.stores.length === 0) {
      logger.warn('Login failed: user not found or has no active store', { phone });
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid phone number or PIN',
          },
        },
        { status: 401 }
      );
    }

    // 2. Constant-time PIN verification
    const isPinValid = await verifyPin(pin, user.pinHash);

    if (!isPinValid) {
      logger.warn('Login failed: incorrect PIN entered', { phone });
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid phone number or PIN',
          },
        },
        { status: 401 }
      );
    }

    // 3. Issue signed JWT session token
    const primaryStore = user.stores[0];
    const sessionToken = await createSessionToken({
      userId: user.id,
      storeId: primaryStore.id,
      phone: user.phone,
    });

    logger.info('User logged in successfully', {
      userId: user.id,
      storeId: primaryStore.id,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        phone: user.phone,
      },
      store: {
        id: primaryStore.id,
        name: primaryStore.name,
      },
    });

    // 4. Set HttpOnly secure session cookie
    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, getSessionCookieOptions());

    return response;
  } catch (error) {
    logger.error('Unexpected error during authentication', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected authentication error occurred',
        },
      },
      { status: 500 }
    );
  }
}
