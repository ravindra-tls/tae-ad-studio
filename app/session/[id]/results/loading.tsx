import { Skeleton } from '@/components/ui/skeleton';

/** Results route loading state — breadcrumb, header, generated-image grid. */
export default function ResultsLoading() {
  return (
    <div className="animate-fade-in">
      {/* Breadcrumb */}
      <Skeleton className="mb-4 h-4 w-48" />

      {/* Header */}
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-56 max-w-full" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>

      {/* Image grid */}
      <div className="grid grid-cols-2 gap-5 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2.5 rounded-xl border border-brand-sage/20 bg-white p-3">
            <Skeleton className="aspect-square w-full rounded-lg" />
            <Skeleton className="h-3 w-2/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
