// src/app/api/auth/login/route.ts
import { NextResponse } from 'next/server';
import { publicRoute } from '@/server/api';
import { loginInputSchema } from '@/modules/auth/pin';
import { authenticatePhonePin } from '@/server/auth/service';
import { getSessionCookieOptions, SESSION_COOKIE_NAME } from '@/modules/auth/session';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const POST = publicRoute(
  { body: loginInputSchema },
  async ({ body }) => {
    try {
      const { user, store, token } = await authenticatePhonePin(body.phone, body.pin);

      logger.info('User logged in successfully', {
        userId: user.id,
        storeId: store.id,
      });

      const response = NextResponse.json({
        success: true,
        user,
        store,
      });

      response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
      return response;
    } catch (err) {
      if (err instanceof AppError && err.code === 'UNAUTHORIZED') {
        logger.warn('Login failed: invalid credentials', { phone: body.phone });
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
      throw err;
    }
  },
  { rateLimit: { key: 'auth.login', limit: 10, windowSeconds: 60 } }
);
