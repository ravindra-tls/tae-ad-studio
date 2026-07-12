'use client';

/**
 * The concept feed. During a deal stream, shimmer skeletons stand in for the
 * requested count and each arriving card replaces one; `done` adopts the
 * authoritative board.
 */

import { useEffect } from 'react';
import { Zap } from 'lucide-react';
import { useForgeStore } from '../state/forge-store';
import { ConceptCard } from './concept-card';
import { SkeletonCard } from './skeleton-card';
import type { DealRun } from '../state/use-deal-stream';
import type { ConceptCard as ConceptCardData } from '../state/types';

export function ConceptBoard({
  run,
  onVariants,
}: {
  run: DealRun | null;
  onVariants: (card: ConceptCardData) => void;
}) {
  const { state, dispatch, showSnack } = useForgeStore();
  const board = state.session?.board || [];
  const flashCardId = state.ui.flashCardId;

  // Cards streamed in but not yet in the adopted board.
  const arrivedExtra = run ? run.arrived.filter((a) => !board.some((b) => b.id === a.id)) : [];
  const skeletonCount = run ? Math.max(0, run.expected - arrivedExtra.length) : 0;
  const visible = [...board, ...arrivedExtra];

  // Chat concept chips: scroll to the card and flash it.
  useEffect(() => {
    if (!flashCardId) return;
    const el = document.querySelector(`[data-card-id="${CSS.escape(flashCardId)}"]`);
    if (!el) {
      showSnack({ message: 'That concept is no longer on the board' });
      dispatch({ type: 'FLASH_CARD', cardId: null });
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const t = setTimeout(() => dispatch({ type: 'FLASH_CARD', cardId: null }), 1700);
    return () => clearTimeout(t);
  }, [flashCardId, dispatch, showSnack]);

  if (!visible.length && !skeletonCount) {
    return (
      <div className="rounded-xl border border-dashed border-brand-sage/40 bg-white/50 p-10 text-center text-sm text-brand-slate">
        No concepts yet — set your Brief above and hit{' '}
        <span className="inline-flex items-center gap-1 font-semibold text-brand-forest">
          <Zap className="h-3.5 w-3.5" aria-hidden />
          Generate
        </span>
        , or ask the partner on the right.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {visible.map((card) => (
        <ConceptCard key={card.id} card={card} onVariants={onVariants} />
      ))}
      {Array.from({ length: skeletonCount }).map((_, i) => (
        <SkeletonCard key={`skeleton-${i}`} delay={i * 60} />
      ))}
    </div>
  );
}
