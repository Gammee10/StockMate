import type { Metadata } from 'next';
import { CounterServerView } from '@/components/counter/counter-server-view';
import { LandingPage } from '@/components/landing/landing-page';
import { getSessionUser } from '@/server/auth';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const user = await getSessionUser();
  if (user) {
    return { title: 'Counter' };
  }

  return {
    title: 'StockMate — Retail Counter, Daily Till & Stock Ledger',
    description:
      'Fast ETB POS counter checkout, daily till cash reconciliation, live inventory management, and stock velocity analytics.',
  };
}

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) {
    return <LandingPage />;
  }

  return <CounterServerView storeId={user.storeId} />;
}
