'use client';

/**
 * Shared comment-list renderer (board cards + finalized detail) and the
 * numbered inline markers rendered next to the copy each comment targets.
 */

import { X } from 'lucide-react';
import { truncate } from '../state/forge-store';
import type { CommentItem } from '../state/types';

export function CommentsList({
  comments,
  onRemove,
}: {
  comments: CommentItem[];
  onRemove: (index: number) => void;
}) {
  if (!comments.length) return null;
  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-brand-cream/50 p-2.5">
      {comments.map((cm, idx) => (
        <div key={idx} className="flex items-start gap-1.5 text-[11px] leading-snug">
          <button
            type="button"
            onClick={() => onRemove(idx)}
            title="Remove comment"
            className="mt-0.5 shrink-0 rounded p-0.5 text-brand-slate/50 hover:bg-brand-wine/10 hover:text-brand-wine"
          >
            <X className="h-3 w-3" />
          </button>
          <span className="mt-px inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-lime text-[9px] font-bold text-brand-forest">
            {idx + 1}
          </span>
          <span className="min-w-0">
            <span className="italic text-brand-slate">&ldquo;{truncate(cm.quote, 60)}&rdquo;</span>{' '}
            <span className="font-medium text-brand-forest">{cm.comment}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/** Numbered circle markers on the copy that carries each comment. */
export function CommentMarkers({
  indices,
  comments,
}: {
  indices: number[] | undefined;
  comments: CommentItem[];
}) {
  if (!indices?.length) return null;
  return (
    <>
      {indices.map((i) => (
        <span
          key={i}
          title={comments[i]?.comment}
          className="ml-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-lime align-text-top text-[9px] font-bold text-brand-forest"
        >
          {i + 1}
        </span>
      ))}
    </>
  );
}
