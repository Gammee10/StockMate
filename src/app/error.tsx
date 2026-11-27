'use client';

import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export default function HomeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg">
        <EmptyState
          variant="error"
          title="Unable to load page"
          description={
            error.message || 'An unexpected error occurred while loading this view.'
          }
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button onClick={reset}>Retry</Button>
              <Link href="/login" className={buttonVariants({ variant: 'outline' })}>
                Go to sign in
              </Link>
            </div>
          }
        />
      </div>
    </main>
  );
}
