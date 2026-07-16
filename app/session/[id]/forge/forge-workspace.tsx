'use client';

/**
 * Concept Forge workspace root — providers, the full-bleed viewport grid
 * (main column + chat rail), Esc layering (comment widget → extras drawer →
 * levers → detail), the '/' chat shortcut, and the select-to-comment
 * listener. ButtonGlowTracker is mounted globally in app/layout.tsx.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ForgeProvider, useForgeStore, dedupedChampions } from './state/forge-store';
import { useDealStream } from './state/use-deal-stream';
import { LOADING_MSGS, useRotatingMessage } from './state/messages';
import { Composer } from './composer/composer';
import { BoardTabs } from './board/board-tabs';
import { ConceptBoard } from './board/concept-board';
import { FinalizedList } from './board/finalized-list';
import { SkeletonCard } from './board/skeleton-card';
import { ConceptDetail } from './detail/concept-detail';
import { ChatRail } from './chat/chat-rail';
import { CommentWidget } from './comments/comment-widget';
import { useTextSelection, type SelectionTarget } from './comments/use-text-selection';
import type { ProductRefImage, TrimmedDeck } from './state/types';

export interface ForgeWorkspaceProps {
  sessionId: string;
  productName: string;
  productImages: ProductRefImage[];
  initialDeck: TrimmedDeck | null;
}

export function ForgeWorkspace(props: ForgeWorkspaceProps) {
  return (
    <ForgeProvider sessionId={props.sessionId} initialDeck={props.initialDeck}>
      <WorkspaceInner {...props} />
    </ForgeProvider>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <div className="forge-shimmer h-16 rounded-xl" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} delay={i * 60} />
        ))}
      </div>
    </div>
  );
}

function WorkspaceInner({ productName, productImages }: ForgeWorkspaceProps) {
  const {
    state,
    dispatch,
    detailId,
    closeConcept,
    focusChat,
    showSnack,
  } = useForgeStore();
  const dealStream = useDealStream();
  const loadingMessage = useRotatingMessage(LOADING_MSGS, !!dealStream.run, 4500);

  const [commentTarget, setCommentTarget] = useState<SelectionTarget | null>(null);
  const onSelect = useCallback((t: SelectionTarget) => setCommentTarget(t), []);
  useTextSelection(onSelect);

  const { status, loadError, deck, session } = state;
  const { leversOpen, extrasOpen, feedView } = state.ui;

  // ── Keyboard: Esc closes the topmost layer; '/' focuses the chat ─────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (commentTarget) {
          setCommentTarget(null);
          return;
        }
        if (extrasOpen) {
          dispatch({ type: 'SET_EXTRAS', open: false });
          return;
        }
        if (leversOpen) {
          dispatch({ type: 'SET_LEVERS', open: false });
          return;
        }
        if (detailId) closeConcept();
        return;
      }
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (commentTarget) return; // never steal focus while a comment is being written
        const t = e.target as HTMLElement | null;
        if (
          t &&
          (t.tagName === 'INPUT' ||
            t.tagName === 'TEXTAREA' ||
            t.tagName === 'SELECT' ||
            t.isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        focusChat();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [commentTarget, extrasOpen, leversOpen, detailId, dispatch, closeConcept, focusChat]);

  const boardCount = session?.board.length ?? 0;
  const finalCount = dedupedChampions(session).length;

  return (
    <div data-fullbleed className="flex h-screen min-h-0 bg-brand-cream">
      {/* ── Main column ── */}
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {/* Header strip */}
        <div className="flex items-center gap-3 border-b border-brand-forest/10 bg-brand-cream px-4 py-2">
          <Link
            href="/dashboard"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-brand-slate hover:text-brand-forest"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Dashboard
          </Link>
          <span className="min-w-0 truncate text-xs text-brand-slate">
            <span className="font-semibold text-brand-forest">{deck?.brand || productName}</span>
            {deck?.oneLiner ? ` — ${deck.oneLiner}` : ''}
          </span>
          <span className="ml-auto shrink-0 text-[11px] text-brand-slate/70">
            {boardCount} concept{boardCount !== 1 ? 's' : ''} · {finalCount} finalized
          </span>
        </div>

        {status === 'loading' && <LoadingSkeleton />}

        {status === 'error' && (
          <div className="mx-auto mt-10 flex w-full max-w-md flex-col items-start gap-3 rounded-xl border border-brand-wine/30 bg-white p-5">
            <div className="flex items-start gap-2 text-sm text-brand-wine">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{loadError || 'Failed to load this forge session.'}</span>
            </div>
            <Button size="sm" onClick={() => window.location.reload()}>
              Reload
            </Button>
          </div>
        )}

        {status === 'ready' &&
          (detailId ? (
            <ConceptDetail productImages={productImages} />
          ) : (
            <>
              <Composer onGenerate={(loadout) => void dealStream.deal(loadout)} streaming={state.streaming} />
              <div className="flex-1 px-4 pb-10 pt-3">
                <BoardTabs dealing={!!dealStream.run} loadingMessage={loadingMessage} />
                {feedView === 'board' ? (
                  <ConceptBoard
                    run={dealStream.run}
                    onVariants={(card) => void dealStream.makeVariants(card)}
                  />
                ) : (
                  <FinalizedList />
                )}
              </div>
            </>
          ))}
      </main>

      {/* ── Chat rail ── */}
      {status === 'ready' && <ChatRail />}

      {/* ── Floating comment popover ── */}
      {commentTarget && (
        <CommentWidget
          target={commentTarget}
          onClose={() => setCommentTarget(null)}
          onAdd={(comment) => {
            dispatch({
              type: 'ADD_COMMENT',
              mode: commentTarget.mode,
              cardId: commentTarget.id,
              item: { quote: commentTarget.quote, comment },
            });
            setCommentTarget(null);
            showSnack({ message: 'Comment added — hit Regenerate' });
          }}
        />
      )}
    </div>
  );
}
