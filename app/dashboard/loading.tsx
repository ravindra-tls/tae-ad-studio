import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';

/** Dashboard route loading state — mirrors header, workflow cards, usage row, sessions. */
export default function DashboardLoading() {
  return (
    <div className="animate-fade-in">
      {/* Welcome header */}
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-64 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      {/* Workflow cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} lines={4} className="min-h-[200px] rounded-2xl" />
        ))}
      </div>

      {/* Usage + stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <SkeletonCard lines={2} className="sm:col-span-2" />
        <SkeletonCard lines={2} />
      </div>

      {/* Recent sessions */}
      <SkeletonCard lines={6} />
    </div>
  );
}
