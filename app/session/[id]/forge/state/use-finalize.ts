'use client';

/**
 * Background finalize (Opus champion polish) — non-blocking, notify-don't-
 * hijack: the user keeps using the whole app; completion pulses the
 * Finalized tab count and offers a "View" snackbar action.
 */

import { useCallback } from 'react';
import { forgeFetch } from './api';
import { useForgeStore } from './forge-store';
import type { ChampionResponse, ConceptCard } from './types';

export function useFinalize() {
  const { sessionId, state, dispatch, mutate, notifyError, showSnack, openConcept } =
    useForgeStore();

  const finalize = useCallback(
    async (card: ConceptCard) => {
      if (state.pendingFinalizes[card.id]) return;
      dispatch({ type: 'FINALIZE_START', cardId: card.id });
      try {
        await mutate(() =>
          forgeFetch<ChampionResponse>('POST', '/api/forge/champion', { sessionId, card }),
        );
        dispatch({ type: 'FINALIZE_END', cardId: card.id });
        dispatch({ type: 'FINAL_GLOW' });
        showSnack({
          message: 'Concept finalized',
          action: { label: 'View', onClick: () => openConcept(card.id) },
        });
      } catch (err) {
        dispatch({ type: 'FINALIZE_END', cardId: card.id });
        notifyError(err);
      }
    },
    [sessionId, state.pendingFinalizes, dispatch, mutate, notifyError, showSnack, openConcept],
  );

  return { finalize };
}
