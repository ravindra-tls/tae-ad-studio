'use client';

/**
 * Board | Finalized tabs with live counts (badge-pop on change, lime glow
 * when a background finalize lands) and the status line — which becomes the
 * slim progress bar + rotating message while a deal streams.
 */

import { cn } from '@/lib/utils';
import { useForgeStore, dedupedChampions } from '../state/forge-store';
import type { DealStats } from '../state/types';

export function ProgressPill() {
  return (
    <span className="inline-block h-1 w-24 shrink-0 overflow-hidden rounded-full bg-brand-sage/25 align-middle">
      <span
        className="block h-full animate-progress-slide rounded-full bg-gradient-to-r from-brand-forest via-brand-green to-brand-lime"
        style={{ backgroundSize: '200px 100%' }}
      />
    </span>
  );
}

function statusLine(stats: DealStats | null): string {
  return stats ? `${stats.passed} passed the quality check of ${stats.generated} generated` : '';
}

export function BoardTabs({
  dealing,
  loadingMessage,
}: {
  dealing: boolean;
  loadingMessage: string;
}) {
  const { state, dispatch } = useForgeStore();
  const { session, stats } = state;
  const { feedView, finalGlowTick } = state.ui;

  const boardCount = session?.board.length ?? 0;
  const finalCount = dedupedChampions(session).length;

  const tabClass = (selected: boolean) =>
    cn(
      'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors',
      selected
        ? 'bg-brand-forest text-white shadow-sm'
        : 'text-brand-slate hover:bg-brand-cream hover:text-brand-forest',
    );

  const countClass = (selected: boolean) =>
    cn(
      'inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold',
      selected ? 'bg-white/25 text-white' : 'bg-brand-sage/30 text-brand-forest',
    );

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={tabClass(feedView === 'board')}
          onClick={() => dispatch({ type: 'SET_FEED_VIEW', view: 'board' })}
        >
          Board
          <span key={boardCount} className={cn(countClass(feedView === 'board'), 'animate-badge-pop')}>
            {boardCount}
          </span>
        </button>
        <button
          type="button"
          className={tabClass(feedView === 'final')}
          onClick={() => dispatch({ type: 'SET_FEED_VIEW', view: 'final' })}
        >
          Finalized
          <span
            key={`${finalCount}:${finalGlowTick}`}
            className={cn(
              countClass(feedView === 'final'),
              finalGlowTick > 0 ? 'animate-count-glow' : 'animate-badge-pop',
            )}
          >
            {finalCount}
          </span>
        </button>
      </div>

      <div className="ml-auto flex min-w-0 items-center gap-2 text-xs text-brand-slate">
        {dealing ? (
          <>
            <ProgressPill />
            <span key={loadingMessage} className="animate-fade-in truncate">
              {loadingMessage}
            </span>
          </>
        ) : (
          <span className="truncate">
            {statusLine(stats) || (boardCount ? `${boardCount} concept(s)` : '')}
          </span>
        )}
      </div>
    </div>
  );
}
