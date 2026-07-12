'use client';

/**
 * Pins (the Brief) — optimistic save with rollback. `pinsSavingRef` is
 * awaited by Enter-to-generate so a mid-flight pin save always lands before
 * the deal snapshot is taken server-side.
 */

import { useCallback } from 'react';
import { forgeFetch } from './api';
import { useForgeStore, usePinLabels, truncate } from './forge-store';
import type { ConceptCard, ForgePins, MinedInsight, PinsResponse, PinKey } from './types';

export const TARGET_KEYS: PinKey[] = ['persona', 'pain', 'awarenessStage'];
export const LEVER_KEYS: PinKey[] = [
  'angle', 'mechanic', 'format', 'hookTactic', 'tagline', 'visualIdea', 'cta', 'product', 'notes',
];
const ALL_PIN_KEYS: PinKey[] = [...TARGET_KEYS, ...LEVER_KEYS];

export function usePins() {
  const { sessionId, state, dispatch, mutate, notifyError, showSnack, pinsSavingRef } =
    useForgeStore();
  const { displayPin } = usePinLabels();
  const session = state.session;

  const savePins = useCallback(
    (partial: Partial<ForgePins>): Promise<void> => {
      const prevPins = session?.pins || {};
      // Rollback patch: restore previous values ('' clears keys that were absent).
      const rollback: Record<string, unknown> = {};
      for (const key of Object.keys(partial)) {
        const prev = (prevPins as Record<string, unknown>)[key];
        rollback[key] = prev ?? (Array.isArray((partial as Record<string, unknown>)[key]) ? [] : '');
      }
      dispatch({ type: 'PINS_LOCAL', pins: partial });
      const p = (async () => {
        try {
          await mutate(() =>
            forgeFetch<PinsResponse>('POST', '/api/forge/pins', { sessionId, pins: partial }),
          );
        } catch (err) {
          dispatch({ type: 'PINS_LOCAL', pins: rollback as Partial<ForgePins> });
          notifyError(err);
        }
      })();
      pinsSavingRef.current = p;
      return p;
    },
    [session, sessionId, dispatch, mutate, notifyError, pinsSavingRef],
  );

  /** Click a card part to add it to the Brief. */
  const pinPart = useCallback(
    (key: PinKey, value: string) => {
      void savePins({ [key]: value });
      showSnack({ message: `Added to Brief · ${key}: ${truncate(displayPin(key, value), 60)}` });
    },
    [savePins, showSnack, displayPin],
  );

  /** Copy a whole card's setup into the Brief. */
  const pinFrame = useCallback(
    (card: ConceptCard) => {
      const d = card.dna;
      void savePins({
        persona: d.persona,
        pain: d.pain,
        awarenessStage: d.awarenessStage,
        mechanic: d.mechanic,
        format: d.format,
        angle: card.messagingAngle,
      });
      showSnack({
        message: 'Copied this setup into your Brief — Generate or ask the partner to iterate',
      });
    },
    [savePins, showSnack],
  );

  const clearBrief = useCallback(() => {
    const cleared: Partial<ForgePins> = { constraints: [], enhancers: [], insights: [] };
    for (const key of ALL_PIN_KEYS) (cleared as Record<string, unknown>)[key] = '';
    void savePins(cleared);
  }, [savePins]);

  const toggleConstraint = useCallback(
    (id: string) => {
      const cur = [...(session?.pins.constraints || [])];
      const i = cur.indexOf(id);
      if (i === -1) cur.push(id);
      else cur.splice(i, 1);
      void savePins({ constraints: cur });
    },
    [session, savePins],
  );

  const toggleEnhancer = useCallback(
    (id: string) => {
      const cur = [...(session?.pins.enhancers || [])];
      const i = cur.indexOf(id);
      if (i === -1) cur.push(id);
      else cur.splice(i, 1);
      void savePins({ enhancers: cur });
    },
    [session, savePins],
  );

  const toggleInsight = useCallback(
    (id: string, mined: MinedInsight[]) => {
      const cur = [...(session?.pins.insights || [])];
      const i = cur.findIndex((x) => x.id === id);
      if (i === -1) {
        if (cur.length >= 4) {
          showSnack({ message: 'Pick up to 4 — the truest ones.', tone: 'error' });
          return;
        }
        const obj = mined.find((x) => x.id === id);
        if (obj) cur.push(obj);
      } else {
        cur.splice(i, 1);
      }
      void savePins({ insights: cur });
    },
    [session, savePins, showSnack],
  );

  return {
    savePins,
    pinPart,
    pinFrame,
    clearBrief,
    toggleConstraint,
    toggleEnhancer,
    toggleInsight,
  };
}
