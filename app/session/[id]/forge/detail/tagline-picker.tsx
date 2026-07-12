'use client';

/**
 * Hero tagline picker — the headline + all tagline variants, de-duplicated.
 * The selected line becomes the hero headline used downstream (export →
 * generated image). Options are commentable copy.
 */

import { CommentMarkers } from '../board/comments-list';
import { cn } from '@/lib/utils';
import type { CommentItem } from '../state/types';

export function TaglinePicker({
  options,
  value,
  onChange,
  markers,
  comments,
}: {
  options: string[];
  value: string;
  onChange: (headline: string) => void;
  markers: Record<string, number[]>;
  comments: CommentItem[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {options.map((t, i) => (
        <label
          key={i}
          className={cn(
            'flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors',
            'border-brand-sage/30 hover:border-brand-forest/40',
            'has-[:checked]:border-brand-forest has-[:checked]:bg-brand-forest/5',
          )}
        >
          <input
            type="radio"
            name="hero-tagline"
            className="mt-0.5 accent-brand-forest"
            checked={t === value}
            onChange={() => onChange(t)}
          />
          <span data-commentable className="text-sm leading-snug text-brand-navy">
            {t}
            <CommentMarkers indices={markers[`tl-${i}`]} comments={comments} />
          </span>
        </label>
      ))}
    </div>
  );
}
