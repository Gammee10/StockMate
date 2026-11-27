import { NavigationShell } from '@/components/navigation-shell';
import { Skeleton } from '@/components/ui/skeleton';

export default function CounterLoading() {
  return (
    <NavigationShell>
      <div className="flex min-h-full flex-col lg:h-full lg:flex-row">
        <section className="min-w-0 flex-1 space-y-4 px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-8 w-24" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-36" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="flex h-32 flex-col justify-between rounded-xl border border-border bg-card p-3.5"
              >
                <Skeleton className="h-4 w-3/4" />
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-10" />
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="hidden w-96 shrink-0 flex-col justify-between border-l border-border bg-card p-5 lg:flex">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-40 w-full" />
          <div className="space-y-3 border-t border-border pt-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </aside>
      </div>
    </NavigationShell>
  );
}
