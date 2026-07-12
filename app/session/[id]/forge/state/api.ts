'use client';

/**
 * Fetch helper for /api/forge/* — JSON in/out, 240s timeout (generation on
 * rich decks can run long; a dropped connection must fail LOUDLY instead of
 * hanging a loader forever), optional caller AbortSignal for Stop buttons.
 */

import type { SessionResponse } from './types';

export class ForgeApiError extends Error {
  status: number;
  code?: string;
  aborted?: boolean;
  /** Set when the store already surfaced this failure (e.g. CAS-conflict snackbar). */
  handled?: boolean;

  constructor(message: string, status = 0, code?: string) {
    super(message);
    this.name = 'ForgeApiError';
    this.status = status;
    this.code = code;
  }
}

const DEFAULT_TIMEOUT_MS = 240_000;

function combineSignals(timeout: AbortSignal, caller?: AbortSignal): AbortSignal {
  if (!caller) return timeout;
  const anyFn = (AbortSignal as unknown as {
    any?: (signals: AbortSignal[]) => AbortSignal;
  }).any;
  return anyFn ? anyFn([timeout, caller]) : caller;
}

export async function forgeFetch<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: unknown,
  opts: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<T> {
  const timeout = AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const signal = combineSignals(timeout, opts.signal);

  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if (opts.signal?.aborted) {
      const e = new ForgeApiError('Stopped');
      e.aborted = true;
      throw e;
    }
    const name = (err as { name?: string } | null)?.name;
    if (name === 'TimeoutError' || name === 'AbortError') {
      throw new ForgeApiError(
        'The server took too long or the connection dropped. Reload the page and try again.',
      );
    }
    throw new ForgeApiError('Could not reach the server. Check your connection and try again.');
  }

  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
  } & T;

  if (!res.ok) {
    throw new ForgeApiError(
      data.error || `Request failed (${res.status})`,
      res.status,
      data.code,
    );
  }
  return data;
}

/** Authoritative snapshot refetch — used on 409/404 recovery. */
export function getSessionSnapshot(sessionId: string): Promise<SessionResponse> {
  return forgeFetch<SessionResponse>('GET', `/api/forge/session/${sessionId}`);
}
