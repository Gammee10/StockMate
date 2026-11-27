import type { Metadata } from 'next';
import { CounterServerView } from '@/components/counter/counter-server-view';
import { requirePageUser } from '@/server/auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Counter',
};

export default async function CounterPage() {
  const user = await requirePageUser();
  return <CounterServerView storeId={user.storeId} />;
}
