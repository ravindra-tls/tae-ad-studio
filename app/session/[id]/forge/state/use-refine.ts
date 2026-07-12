'use client';

/**
 * Comment-driven regeneration — board cards (busy shimmer, board stays live)
 * and finalized champions (pending lives on the detail's regen button).
 */

import { useCallback } from 'react';
import { forgeFetch } from './api';
import { useForgeStore } from './forge-store';
import type {
  Champion,
  ChampionResponse,
  ConceptCard,
  DetailCardLike,
  RefineResponse,
} from './types';

export function useRefine() {
  const { sessionId, state, dispatch, mutate, notifyError, showSnack } = useForgeStore();

  const refineCard = useCallback(
    async (card: ConceptCard) => {
      const comments = state.cardComments[card.id] || [];
      if (!comments.length || state.pendingRefines[card.id]) return;
      dispatch({ type: 'REFINE_START', cardId: card.id });
      try {
        await mutate(() =>
          forgeFetch<RefineResponse>('POST', '/api/forge/refine', { sessionId, card, comments }),
        );
        dispatch({ type: 'CLEAR_COMMENTS', mode: 'card', cardId: card.id });
        showSnack({ message: 'Concept regenerated from your comments' });
      } catch (err) {
        notifyError(err);
      } finally {
        dispatch({ type: 'REFINE_END', cardId: card.id });
      }
    },
    [sessionId, state.cardComments, state.pendingRefines, dispatch, mutate, notifyError, showSnack],
  );

  /** Returns the updated champion, or null on failure. */
  const refineChampion = useCallback(
    async (card: DetailCardLike, champion: Champion): Promise<Champion | null> => {
      const comments = state.championComments[card.id] || [];
      if (!comments.length) return null;
      try {
        const data = await mutate(() =>
          forgeFetch<ChampionResponse>('POST', '/api/forge/refine-champion', {
            sessionId,
            card,
            champion,
            comments,
          }),
        );
        dispatch({ type: 'CLEAR_COMMENTS', mode: 'champion', cardId: card.id });
        showSnack({ message: 'Finalized concept updated from your comments' });
        return data.champion;
      } catch (err) {
        notifyError(err);
        return null;
      }
    },
    [sessionId, state.championComments, dispatch, mutate, notifyError, showSnack],
  );

  return { refineCard, refineChampion };
}

/** Discard a concept from the board. */
export function useDiscard() {
  const { sessionId, mutate, notifyError } = useForgeStore();
  return useCallback(
    async (card: ConceptCard) => {
      try {
        await mutate(() =>
          forgeFetch<{ session: import('./types').ForgeSession }>('POST', '/api/forge/react', {
            sessionId,
            card,
            keep: false,
          }),
        );
      } catch (err) {
        notifyError(err);
      }
    },
    [sessionId, mutate, notifyError],
  );
}
