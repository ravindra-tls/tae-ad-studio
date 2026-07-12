'use client';

/**
 * NDJSON deal stream + variants (breed — same engine, seeded by one card).
 *
 * During a run the board shows `expected` shimmer skeletons; each arriving
 * card replaces one. The first card closes the composer disclosure panels.
 * `done` adopts the authoritative snapshot (reconciles order + accumulates).
 */

import { useCallback, useRef, useState } from 'react';
import { iterateNdjson } from '@/lib/client/ndjson';
import { ForgeApiError, forgeFetch } from './api';
import { useForgeStore } from './forge-store';
import type { BreedResponse, ConceptCard, DealStreamMsg, Loadout } from './types';

export interface DealRun {
  expected: number;
  arrived: ConceptCard[];
}

export interface DealStreamApi {
  run: DealRun | null;
  deal: (loadout: Loadout) => Promise<void>;
  makeVariants: (card: ConceptCard) => Promise<void>;
}

export function useDealStream(): DealStreamApi {
  const { sessionId, state, dispatch, adopt, mutate, notifyError, showSnack } = useForgeStore();
  const [run, setRun] = useState<DealRun | null>(null);
  const streamingRef = useRef(false);

  const deal = useCallback(
    async (loadout: Loadout) => {
      if (streamingRef.current) return;
      streamingRef.current = true;
      dispatch({ type: 'STREAMING', value: true });
      dispatch({ type: 'SET_FEED_VIEW', view: 'board' });
      dispatch({ type: 'SET_STATS', stats: null });
      setRun({ expected: loadout.count, arrived: [] });
      let sawCard = false;

      try {
        const res = await fetch('/api/forge/deal', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sessionId, loadout }),
          signal: AbortSignal.timeout(240_000),
        });
        if (!res.ok || !res.body) {
          const d = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
          throw new ForgeApiError(d.error || `Request failed (${res.status})`, res.status, d.code);
        }
        for await (const raw of iterateNdjson(res.body)) {
          const msg = raw as DealStreamMsg;
          if (msg.type === 'card') {
            if (!sawCard) {
              sawCard = true;
              dispatch({ type: 'CLOSE_DRAWERS' });
            }
            setRun((r) => (r ? { ...r, arrived: [...r.arrived, msg.card] } : r));
          } else if (msg.type === 'done') {
            adopt(msg.session);
            dispatch({ type: 'SET_STATS', stats: msg.stats ?? null });
            if (msg.stats && msg.stats.passed === 0) {
              showSnack({
                message:
                  'No concepts cleared the quality bar — try loosening the brief (fewer constraints, allow the product, or a different persona/pain).',
                tone: 'error',
              });
            }
          } else if (msg.type === 'error') {
            throw new ForgeApiError(msg.error || 'Generation failed');
          }
        }
      } catch (err) {
        const name = (err as { name?: string } | null)?.name;
        if (name === 'TimeoutError' || name === 'AbortError') {
          notifyError(
            new ForgeApiError('The generation stream took too long or dropped. Try again.'),
          );
        } else {
          notifyError(err);
        }
      } finally {
        setRun(null);
        streamingRef.current = false;
        dispatch({ type: 'STREAMING', value: false });
      }
    },
    [sessionId, dispatch, adopt, notifyError, showSnack],
  );

  const makeVariants = useCallback(
    async (card: ConceptCard) => {
      if (state.pendingVariants[card.id]) return;
      dispatch({ type: 'VARIANTS_START', cardId: card.id });
      try {
        const data = await mutate(() =>
          forgeFetch<BreedResponse>('POST', '/api/forge/breed', {
            sessionId,
            parents: [card],
            loadout: { count: 3 },
          }),
        );
        dispatch({ type: 'SET_STATS', stats: data.stats ?? null });
        if (data.stats && data.stats.passed === 0) {
          showSnack({ message: 'No variants cleared the quality bar — try again.', tone: 'error' });
        } else {
          showSnack({ message: 'Variants added to the board' });
        }
      } catch (err) {
        notifyError(err);
      } finally {
        dispatch({ type: 'VARIANTS_END', cardId: card.id });
      }
    },
    [sessionId, state.pendingVariants, dispatch, mutate, notifyError, showSnack],
  );

  return { run, deal, makeVariants };
}
