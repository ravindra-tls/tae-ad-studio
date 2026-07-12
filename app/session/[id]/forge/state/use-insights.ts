'use client';

/**
 * Human-insight mining (Opus) for the pinned persona (+pain). Pending lives
 * on the Mine button; the app stays usable throughout.
 */

import { useCallback } from 'react';
import { forgeFetch } from './api';
import { useForgeStore } from './forge-store';
import type { InsightsResponse } from './types';

export function useInsights() {
  const { sessionId, state, dispatch, mutate, notifyError, showSnack } = useForgeStore();

  const mine = useCallback(async () => {
    const pins = state.session?.pins || {};
    if (!pins.persona) {
      showSnack({ message: 'Pick a persona first — insights are mined for one person.', tone: 'error' });
      return;
    }
    if (state.miningInsights) return;
    dispatch({ type: 'MINING', value: true });
    try {
      const data = await mutate(() =>
        forgeFetch<InsightsResponse>('POST', '/api/forge/insights', {
          sessionId,
          persona: pins.persona,
          pain: pins.pain || '',
        }),
      );
      showSnack({
        message: data.cached
          ? 'Loaded mined insights'
          : `Surfaced ${(data.insights || []).length} human truths`,
      });
    } catch (err) {
      notifyError(err);
    } finally {
      dispatch({ type: 'MINING', value: false });
    }
  }, [sessionId, state.session, state.miningInsights, dispatch, mutate, notifyError, showSnack]);

  return { mine, mining: state.miningInsights };
}
