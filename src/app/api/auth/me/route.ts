import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/modules/auth/session';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  let token: string | undefined;

  // Support both direct Request cookie headers and Next.js cookies()
  if (request) {
    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
      const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
      if (match) {
        token = match[1];
      }
    }
  } else {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    } catch {
      // Fallback for isolated execution
    }
  }

  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const payload = await verifySessionToken(token);
  if (!payload) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  // Fetch live store details
  const store = await db.store.findUnique({
    where: { id: payload.storeId },
    select: { id: true, name: true },
  });

  return NextResponse.json({
    authenticated: true,
    user: {
      id: payload.userId,
      phone: payload.phone,
    },
    store: store || { id: payload.storeId, name: "Dawit's Kiosk" },
  });
}
