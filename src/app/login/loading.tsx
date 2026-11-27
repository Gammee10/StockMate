import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function LoginLoading() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <div className="border-b border-border">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-7 w-24" />
        </div>
      </div>

      <main className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:px-8 lg:py-12">
        <div className="hidden space-y-4 lg:block">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-12 w-full max-w-md" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>

        <div className="mx-auto w-full max-w-md lg:mr-0">
          <Card>
            <CardHeader className="border-b border-border pb-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <Skeleton className="h-10 w-full" />
              <div className="grid grid-cols-4 gap-2.5">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-12 w-full" />
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 12 }).map((_, index) => (
                  <Skeleton key={index} className="h-12 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
