// src/server/auth.ts
import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppError } from '@/lib/errors';
import { verifySession } from '@/modules/auth/session';

export type SessionUser = {
  id: string;
  email: string;
  phone: string;
  role: 'user' | 'admin';
  storeId: string;
};

/**
 * THE ONLY PLACE that talks to the auth library / session token.
 * Validates the session from httpOnly cookie or request headers and returns the user or null.
 */
export async function getSessionUser(request?: Request): Promise<SessionUser | null> {
  let token: string | undefined;

  if (request) {
    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
      const match = cookieHeader.match(/stockmate_session=([^;]+)/);
      if (match) token = match[1];
    }
  }

  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get('stockmate_session')?.value;
    } catch {
      token = undefined;
    }
  }

  if (!token) return null;

  try {
    const session = await verifySession(token);
    if (!session) return null;
    return {
      id: session.userId,
      email: '',
      phone: session.phone,
      role: 'user' as const,
      storeId: session.storeId,
    };
  } catch (err) {
    void err;
    return null;
  }
}

/** Signed-in users only. */
export async function requireUser(request?: Request): Promise<SessionUser> {
  const user = await getSessionUser(request);
  if (!user) throw new AppError('UNAUTHORIZED', 'Please sign in.');
  return user;
}

/** Admins only. */
export async function requireAdmin(request?: Request): Promise<SessionUser> {
  const user = await requireUser(request);
  if (user.role !== 'admin')
    throw new AppError('FORBIDDEN', 'You do not have access to this.');
  return user;
}

/** For pages and layouts (Server Components). Redirects to /login if signed out. */
export async function requirePageUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return user;
}
