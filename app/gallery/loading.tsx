import { Skeleton } from '@/components/ui/skeleton';

/**
 * Gallery route loading state — header, filter row, masonry-ish image grid.
 * This segment has no layout.tsx (the page renders AppLayout itself), so the
 * skeleton mimics AppLayout's content container.
 */
export default function GalleryLoading() {
  return (
    <div className="mx-auto max-w-6xl animate-fade-in p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-7 w-24 rounded-full" />
      </div>

      {/* Filter row */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Skeleton className="h-9 w-56 rounded-xl" />
        <Skeleton className="h-9 w-40 rounded-xl" />
        <Skeleton className="ml-auto h-9 w-44 rounded-xl" />
      </div>

      {/* Image grid */}
      <div className="grid grid-cols-2 gap-5 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2.5 rounded-xl border border-brand-sage/20 bg-white p-3">
            <Skeleton className={i % 2 === 0 ? 'aspect-[4/5] w-full rounded-lg' : 'aspect-square w-full rounded-lg'} />
            <Skeleton className="h-3 w-2/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
