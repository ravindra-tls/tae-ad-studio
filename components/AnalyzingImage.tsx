'use client';

/**
 * AnalyzingImage — simple circular loading ring.
 * Sized via Tailwind size-* utilities; color via currentColor.
 */

import { cn } from '@/lib/utils';

interface AnalyzingImageProps {
  className?: string;
}

export function AnalyzingImage({ className }: AnalyzingImageProps) {
  return (
    <div
      className={cn(
        'rounded-full border-[3px] border-current border-t-transparent animate-spin',
        'size-5',
        className,
      )}
      aria-label="Generating…"
      role="status"
    />
  );
}
