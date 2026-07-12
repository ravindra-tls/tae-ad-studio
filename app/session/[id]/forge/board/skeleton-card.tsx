'use client';

/**
 * Shimmer skeleton standing in for an arriving concept during a deal stream.
 */

export function SkeletonCard({ delay = 0 }: { delay?: number }) {
  return (
    <div
      className="pointer-events-none flex animate-stagger-in flex-col gap-2.5 rounded-xl border border-brand-sage/20 bg-white p-4"
      style={{ animationDelay: `${delay}ms` }}
      aria-hidden
    >
      <div className="forge-shimmer h-4 w-3/5 rounded-md" />
      <div className="forge-shimmer h-4 w-[90%] rounded-md" />
      <div className="forge-shimmer h-4 w-4/5 rounded-md" />
      <div className="forge-shimmer h-16 rounded-md" />
      <div className="forge-shimmer h-4 w-[70%] rounded-md" />
    </div>
  );
}
