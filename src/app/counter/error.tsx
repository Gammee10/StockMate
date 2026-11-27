'use client';

import { NavigationShell } from '@/components/navigation-shell';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export default function CounterError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <NavigationShell>
      <div className="mx-auto flex max-w-lg items-center justify-center px-4 py-16">
        <EmptyState
          variant="error"
          title="Counter failed to load"
          description={
            error.message || 'An unexpected error occurred while loading the counter.'
          }
          action={<Button onClick={reset}>Retry</Button>}
        />
      </div>
    </NavigationShell>
  );
}
