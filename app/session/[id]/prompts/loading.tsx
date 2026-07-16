import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';

/** Template-selection route loading state — breadcrumb, header, template grid. */
export default function PromptsLoading() {
  return (
    <div className="animate-fade-in">
      {/* Breadcrumb */}
      <Skeleton className="mb-4 h-4 w-48" />

      {/* Header */}
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-64 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} lines={4} />
        ))}
      </div>
    </div>
  );
}
