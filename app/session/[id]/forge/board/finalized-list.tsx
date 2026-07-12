'use client';

/**
 * Finalized tab — champions deduped by card id (last finalize wins), newest
 * first. Reopening shows the stored champion directly: no re-polish, no
 * Opus spend.
 */

import { Star } from 'lucide-react';
import { useForgeStore, dedupedChampions } from '../state/forge-store';

export function FinalizedList() {
  const { state, openConcept } = useForgeStore();
  const champs = dedupedChampions(state.session);

  if (!champs.length) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-brand-sage/40 bg-white/50 p-10 text-sm text-brand-slate">
        <Star className="h-4 w-4 text-brand-sage" aria-hidden />
        Nothing finalized yet — finalize a concept on the Board and it locks in here.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {champs.map((c) => {
        const when = c.at
          ? new Date(c.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
          : '';
        const sub = [c.dna?.format, c.dna?.mechanic, when].filter(Boolean).join(' · ');
        return (
          <div
            key={c.id}
            className="session-row flex items-center gap-3 rounded-xl border border-brand-sage/25 bg-white px-4 py-3 shadow-sm"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate font-serif text-base leading-snug text-brand-forest">
                {c.champion.headline}
              </div>
              {sub && <div className="mt-0.5 text-[11px] text-brand-slate">{sub}</div>}
            </div>
            <button
              type="button"
              onClick={() => openConcept(c.id)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-brand-forest/25 bg-white px-3 py-1.5 text-xs font-medium text-brand-forest hover:bg-brand-cream"
            >
              Open
              <Star className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}
