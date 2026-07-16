import { cn } from '@/lib/utils';

/**
 * Skeleton — brand shimmer placeholder built on the .forge-shimmer utility
 * (app/globals.css). Size and shape it with className (h-*, w-*, aspect-*,
 * rounded-*). Server-component safe.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('forge-shimmer rounded-md', className)} />;
}

/**
 * SkeletonCard — card-shaped placeholder: a title bar plus `lines` body
 * lines inside the standard white card chrome.
 */
export function SkeletonCard({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('flex flex-col gap-2.5 rounded-xl border border-brand-sage/20 bg-white p-4', className)}
    >
      <Skeleton className="h-4 w-3/5" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-3', i === lines - 1 ? 'w-2/5' : 'w-[90%]')} />
      ))}
    </div>
  );
}
