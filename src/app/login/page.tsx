import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/auth/login-form';
import { getSessionUser } from '@/server/auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sign in',
};

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) {
    redirect('/');
  }

  return <LoginForm />;
}
