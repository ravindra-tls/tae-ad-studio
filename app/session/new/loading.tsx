import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';

/** New-session route loading state — breadcrumb, header, product grid. */
export default function NewSessionLoading() {
  return (
    <div className="animate-fade-in">
      {/* Breadcrumb */}
      <Skeleton className="mb-4 h-4 w-40" />

      {/* Header */}
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-56 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} lines={2} />
        ))}
      </div>
    </div>
  );
}
