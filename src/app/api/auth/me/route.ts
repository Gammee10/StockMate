// src/app/api/auth/me/route.ts
import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth';
import { getStoreDetails } from '@/server/auth/service';
import { AppError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response>;
export async function GET(): Promise<Response>;
export async function GET(request?: Request): Promise<Response> {
  const req = request ?? new Request('http://localhost/api/auth/me');
  try {
    const user = await requireUser(req);
    const store = await getStoreDetails(user.storeId);

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        phone: user.phone,
      },
      store: store || { id: user.storeId, name: "Dawit's Kiosk" },
    });
  } catch (err) {
    if (err instanceof AppError && err.code === 'UNAUTHORIZED') {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
