'use client';

/**
 * Chat copilot — send/retry with an AbortController-backed Stop, optimistic
 * user-turn echo, and an unread dot when a reply lands while the rail is
 * collapsed.
 */

import { useCallback, useRef, useState } from 'react';
import { ForgeApiError, forgeFetch } from './api';
import { useForgeStore } from './forge-store';
import type { ChatResponse } from './types';

export interface ForgeChatApi {
  /** True while a reply is in flight (Send button doubles as Stop). */
  pending: boolean;
  /** Optimistic user turn not yet in session.chat. */
  echo: string | null;
  send: (text: string | null, opts?: { retry?: boolean; onAborted?: (draft: string) => void }) => Promise<void>;
  stop: () => void;
}

export function useForgeChat(): ForgeChatApi {
  const { sessionId, state, dispatch, mutate, notifyError, showSnack } = useForgeStore();
  const [pending, setPending] = useState(false);
  const [echo, setEcho] = useState<string | null>(null);
  const ctlRef = useRef<AbortController | null>(null);
  const railOpenRef = useRef(state.ui.railOpen);
  railOpenRef.current = state.ui.railOpen;

  const stop = useCallback(() => {
    ctlRef.current?.abort();
  }, []);

  const send = useCallback(
    async (
      text: string | null,
      opts: { retry?: boolean; onAborted?: (draft: string) => void } = {},
    ) => {
      const retry = !!opts.retry;
      if (ctlRef.current) {
        // Button doubles as Stop while pending.
        ctlRef.current.abort();
        return;
      }
      const message = retry ? null : (text || '').trim();
      if (!retry && !message) return;
      if (!retry && message) setEcho(message);

      const ctl = new AbortController();
      ctlRef.current = ctl;
      setPending(true);
      try {
        const data = await mutate(() =>
          forgeFetch<ChatResponse>(
            'POST',
            '/api/forge/chat',
            retry ? { sessionId, retry: true } : { sessionId, message },
            { signal: ctl.signal },
          ),
        );
        if (data.suggestions?.length) {
          dispatch({ type: 'SET_SUGGESTIONS', suggestions: data.suggestions });
        }
        if (!railOpenRef.current) dispatch({ type: 'SET_UNREAD', value: true });
        if (data.cards?.length) {
          showSnack({ message: `${data.cards.length} concept(s) added to the board` });
        }
      } catch (err) {
        if (err instanceof ForgeApiError && err.aborted) {
          if (!retry && message) opts.onAborted?.(message); // give the draft back
          showSnack({ message: 'Stopped' });
        } else {
          notifyError(err);
        }
      } finally {
        ctlRef.current = null;
        setPending(false);
        setEcho(null);
      }
    },
    [sessionId, dispatch, mutate, notifyError, showSnack],
  );

  return { pending, echo, send, stop };
}
