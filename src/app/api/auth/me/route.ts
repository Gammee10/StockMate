// src/app/api/auth/me/route.ts
import { NextResponse } from 'next/server';
import { userRoute } from '@/server/api';
import { getStoreDetails } from '@/server/auth/service';

export const dynamic = 'force-dynamic';

export const GET = userRoute({}, async ({ user }) => {
  const store = await getStoreDetails(user.storeId);

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      phone: user.phone,
    },
    store: store ?? null,
  });
});
