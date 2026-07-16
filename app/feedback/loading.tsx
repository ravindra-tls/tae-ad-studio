import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';

/** Feedback route loading state — header + stacked feedback cards. */
export default function FeedbackLoading() {
  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-48 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      {/* Feedback cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} lines={3} />
        ))}
      </div>
    </div>
  );
}
