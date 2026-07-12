/**
 * Forge state persistence: whole-row optimistic CAS on `forge_states.rev`.
 *
 * Every mutation: read {state, rev} → normalize a deep copy → apply a pure,
 * re-appliable mutator → UPDATE ... WHERE session_id = $id AND rev = $expected.
 * If another request wrote first, 0 rows update; we re-read and re-apply with
 * jittered backoff (max 5 attempts), then surface a 409-able conflict error.
 *
 * LLM work must always happen OUTSIDE the CAS window (snapshot → Claude call →
 * CAS-apply onto fresh state) so a pin saved mid-finalize survives.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalize } from './state-ops';
import type { ForgeState, ForgeSessionView } from './types';

export class ForgeStateConflictError extends Error {
  status = 409;
  code = 'FORGE_STATE_CONFLICT';
  constructor(sessionId: string) {
    super(`Forge state for session ${sessionId} changed concurrently too many times — refetch and retry.`);
    this.name = 'ForgeStateConflictError';
  }
}

export class ForgeStateNotFoundError extends Error {
  status = 404;
  code = 'FORGE_STATE_NOT_FOUND';
  constructor(sessionId: string) {
    super(`No forge state found for session ${sessionId}.`);
    this.name = 'ForgeStateNotFoundError';
  }
}

/**
 * Thrown by a mutator to abort the CAS loop cleanly (no write happens).
 * Routes use this for idempotency guards (e.g. insights pending marker).
 */
export class MutationAbortError extends Error {
  code = 'FORGE_MUTATION_ABORT';
  constructor(message: string) {
    super(message);
    this.name = 'MutationAbortError';
  }
}

export interface ForgeStateSnapshot {
  state: ForgeState;
  rev: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Read the current {state, rev} for a session (normalized copy). Null if missing. */
export async function getForgeState(
  service: SupabaseClient,
  sessionId: string,
): Promise<ForgeStateSnapshot | null> {
  const { data, error } = await service
    .from('forge_states')
    .select('state, rev')
    .eq('session_id', sessionId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load forge state: ${error.message}`);
  if (!data) return null;
  return { state: normalize(data.state as Partial<ForgeState>), rev: data.rev as number };
}

/**
 * Apply a pure mutator to the session's state with compare-and-swap semantics.
 * The mutator may be re-invoked on a fresh copy when a concurrent write wins.
 * Returns the persisted {state, rev}.
 */
export async function mutateForgeState(
  service: SupabaseClient,
  sessionId: string,
  mutator: (draft: ForgeState) => void | Promise<void>,
  opts: { maxAttempts?: number } = {},
): Promise<ForgeStateSnapshot> {
  const maxAttempts = opts.maxAttempts ?? 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const snapshot = await getForgeState(service, sessionId);
    if (!snapshot) throw new ForgeStateNotFoundError(sessionId);

    const draft = normalize(structuredClone(snapshot.state));
    await mutator(draft); // MutationAbortError propagates to the caller

    const nextRev = snapshot.rev + 1;
    const { data, error } = await service
      .from('forge_states')
      .update({ state: draft, rev: nextRev, updated_at: new Date().toISOString() })
      .eq('session_id', sessionId)
      .eq('rev', snapshot.rev)
      .select('rev');

    if (error) throw new Error(`Failed to save forge state: ${error.message}`);
    if (data && data.length > 0) return { state: draft, rev: nextRev };

    // Lost the race — jittered backoff, then re-read + re-apply.
    if (attempt < maxAttempts) {
      await sleep(60 * attempt + Math.floor(Math.random() * 120));
    }
  }
  throw new ForgeStateConflictError(sessionId);
}

/** Minimal session-row fields sessionView needs. */
export interface SessionRowLike {
  id: string;
  product_id: string;
  name: string;
}

/**
 * Client-safe projection of a session (no secrets). Mirrors Concept Forge's
 * sessionView: id, rev, board, pins, chat, champions, insightsCache, genePool,
 * suppressed, favorites, history, score, streak, userRefs (+ product identity).
 */
export function sessionView(
  state: ForgeState,
  rev: number,
  sessionRow: SessionRowLike,
): ForgeSessionView {
  const s = normalize(state);
  return {
    id: sessionRow.id,
    rev,
    productId: sessionRow.product_id,
    name: sessionRow.name,
    score: s.score,
    streak: s.streak,
    favorites: s.favorites,
    genePool: s.genePool,
    suppressed: s.suppressed,
    champions: s.champions,
    history: s.history,
    board: s.board,
    pins: s.pins,
    chat: s.chat,
    insightsCache: s.insightsCache,
    userRefs: s.userRefs,
  };
}
