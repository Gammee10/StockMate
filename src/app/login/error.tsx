'use client';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export default function LoginError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <EmptyState
          variant="error"
          title="Unable to load sign-in"
          description={error.message || 'Check your connection and retry.'}
          action={<Button onClick={reset}>Retry</Button>}
        />
      </div>
    </main>
  );
}
