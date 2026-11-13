// src/app/api/auth/logout/route.ts
import { NextResponse } from 'next/server';
import { publicRoute } from '@/server/api';
import { getSessionCookieOptions, SESSION_COOKIE_NAME } from '@/modules/auth/session';

export const dynamic = 'force-dynamic';

export const POST = publicRoute({}, async () => {
  const response = NextResponse.json({ success: true });

  // Expire session cookie immediately
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    ...getSessionCookieOptions(),
    maxAge: 0,
  });

  return response;
});
