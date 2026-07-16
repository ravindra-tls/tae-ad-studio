import { Skeleton } from '@/components/ui/skeleton';

/**
 * Copy-ad results route loading state — header + result-card grid.
 * This segment has no layout.tsx (the page renders its own chrome), so the
 * skeleton mimics AppLayout's content container.
 */
export default function CopyAdResultsLoading() {
  return (
    <div className="mx-auto max-w-6xl animate-fade-in p-6 lg:p-8">
      {/* Back link + header */}
      <Skeleton className="mb-4 h-4 w-32" />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-64 max-w-full" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-16 w-16 rounded-lg" />
      </div>

      {/* Result cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2.5 rounded-xl border border-brand-sage/20 bg-white p-3">
            <Skeleton className="aspect-square w-full rounded-lg" />
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
