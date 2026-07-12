'use client';

/**
 * Concept Forge store — a single `{session (state doc), rev}` document in a
 * useReducer + Context pair (NOT React Query: per-key cache invalidation
 * fights the whole-doc CAS shape).
 *
 * Core invariants ported from the prototype:
 *  - ADOPT is rev-guarded: a slow background response (finalize) landing
 *    AFTER a newer one (pin save, chat) is dropped losslessly — the newer
 *    snapshot already contains the older write.
 *  - Pending work (finalize/refine) lives OUTSIDE the rendered cards as
 *    Record<cardId, true> so re-renders never lose it.
 *  - CAS conflicts (409): silent refetch + re-apply once; only a second
 *    conflict surfaces the "board changed in another tab" snackbar.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type ReactNode,
} from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useSnackbar } from '@/components/ui/snackbar';
import { ForgeApiError, forgeFetch, getSessionSnapshot } from './api';
import type {
  ChampionEntry,
  CommentItem,
  DealStats,
  ForgePins,
  ForgeSession,
  MinedInsight,
  Taxonomies,
  TrimmedDeck,
} from './types';

// ── State ────────────────────────────────────────────────────────────────────

export type FeedView = 'board' | 'final';

export interface ForgeUiState {
  feedView: FeedView;
  leversOpen: boolean;
  extrasOpen: boolean;
  railOpen: boolean;
  /** Below-xl only: chat rendered as a fixed overlay sheet. */
  overlayOpen: boolean;
  unread: boolean;
  /** Card to scroll-to + flash on the board (chat concept chips). */
  flashCardId: string | null;
  /** Bumped when a finalize lands → Finalized tab count glows. */
  finalGlowTick: number;
}

export interface ForgeStoreState {
  status: 'loading' | 'ready' | 'error';
  loadError: string | null;
  session: ForgeSession | null;
  deck: TrimmedDeck | null;
  taxonomies: Taxonomies | null;
  suggestions: string[];
  stats: DealStats | null;
  streaming: boolean;
  miningInsights: boolean;
  pendingFinalizes: Record<string, true>;
  pendingRefines: Record<string, true>;
  pendingVariants: Record<string, true>;
  /** Client-only comment stores (never persisted). */
  cardComments: Record<string, CommentItem[]>;
  championComments: Record<string, CommentItem[]>;
  ui: ForgeUiState;
}

export type ForgeAction =
  | { type: 'BOOTSTRAP'; session: ForgeSession; deck: TrimmedDeck | null; taxonomies: Taxonomies; suggestions: string[] }
  | { type: 'BOOTSTRAP_ERROR'; error: string }
  | { type: 'ADOPT'; session: ForgeSession }
  | { type: 'PINS_LOCAL'; pins: Partial<ForgePins> }
  | { type: 'SET_SUGGESTIONS'; suggestions: string[] }
  | { type: 'SET_STATS'; stats: DealStats | null }
  | { type: 'STREAMING'; value: boolean }
  | { type: 'MINING'; value: boolean }
  | { type: 'FINALIZE_START'; cardId: string }
  | { type: 'FINALIZE_END'; cardId: string }
  | { type: 'REFINE_START'; cardId: string }
  | { type: 'REFINE_END'; cardId: string }
  | { type: 'VARIANTS_START'; cardId: string }
  | { type: 'VARIANTS_END'; cardId: string }
  | { type: 'ADD_COMMENT'; mode: 'card' | 'champion'; cardId: string; item: CommentItem }
  | { type: 'REMOVE_COMMENT'; mode: 'card' | 'champion'; cardId: string; index: number }
  | { type: 'CLEAR_COMMENTS'; mode: 'card' | 'champion'; cardId: string }
  | { type: 'SET_FEED_VIEW'; view: FeedView }
  | { type: 'SET_LEVERS'; open: boolean }
  | { type: 'SET_EXTRAS'; open: boolean }
  | { type: 'CLOSE_DRAWERS' }
  | { type: 'SET_RAIL'; open: boolean }
  | { type: 'SET_OVERLAY'; open: boolean }
  | { type: 'SET_UNREAD'; value: boolean }
  | { type: 'FLASH_CARD'; cardId: string | null }
  | { type: 'FINAL_GLOW' };

const INITIAL_UI: ForgeUiState = {
  feedView: 'board',
  leversOpen: false,
  extrasOpen: false,
  railOpen: true,
  overlayOpen: false,
  unread: false,
  flashCardId: null,
  finalGlowTick: 0,
};

const INITIAL_STATE: ForgeStoreState = {
  status: 'loading',
  loadError: null,
  session: null,
  deck: null,
  taxonomies: null,
  suggestions: [],
  stats: null,
  streaming: false,
  miningInsights: false,
  pendingFinalizes: {},
  pendingRefines: {},
  pendingVariants: {},
  cardComments: {},
  championComments: {},
  ui: INITIAL_UI,
};

// ── Pure helpers ─────────────────────────────────────────────────────────────

/** Merge a partial pins patch client-side, mirroring server semantics: '' clears. */
export function mergePins(current: ForgePins, patch: Partial<ForgePins>): ForgePins {
  const next: ForgePins = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (value === '' || value == null) {
      delete (next as Record<string, unknown>)[key];
    } else {
      (next as Record<string, unknown>)[key] = value;
    }
  }
  return next;
}

/** Champions deduped by card id (last finalize wins), newest first. */
export function dedupedChampions(session: ForgeSession | null): ChampionEntry[] {
  if (!session) return [];
  const map = new Map<string, ChampionEntry>();
  for (const c of session.champions || []) map.set(c.id, c);
  return [...map.values()].reverse();
}

export function buildSuggestions(deck: TrimmedDeck | null): string[] {
  if (!deck) return [];
  const personas = deck.personas || [];
  const pains = deck.pains || [];
  const out: string[] = [];
  if (personas[0] && pains[0]) out.push(`Concepts for ${personas[0].name} about "${pains[0].label}"`);
  out.push(`3 scroll-stopping visual ideas for ${(deck.brand || '').split('(')[0].trim()}`);
  if (pains[1]) out.push(`Give me a concept that leans into "${pains[1].label}"`);
  out.push(`Which angle would convert best for ${personas[1] ? personas[1].name : 'our buyer'}?`);
  return out.slice(0, 4);
}

export function truncate(s: string | undefined | null, n: number): string {
  const str = String(s ?? '');
  return str.length > n ? `${str.slice(0, n - 1)}…` : str;
}

/** Score → tone classes (CF barColor port, mapped to brand tokens). */
export function scoreTone(v: number): { text: string; bg: string } {
  if (v >= 85) return { text: 'text-brand-green', bg: 'bg-brand-green' };
  if (v >= 70) return { text: 'text-amber-600', bg: 'bg-amber-500' };
  return { text: 'text-brand-wine', bg: 'bg-brand-wine' };
}

/** Insights mined for the currently-pinned persona (+pain), from the cache. */
export function currentInsights(session: ForgeSession | null): MinedInsight[] {
  const p = session?.pins || {};
  if (!p.persona) return [];
  const key = p.pain ? `${p.persona}::${p.pain}` : p.persona;
  const entry = (session?.insightsCache || {})[key];
  return entry?.insights || [];
}

function without<T extends Record<string, unknown>>(rec: T, key: string): T {
  if (!(key in rec)) return rec;
  const next = { ...rec };
  delete next[key];
  return next;
}

// ── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state: ForgeStoreState, action: ForgeAction): ForgeStoreState {
  switch (action.type) {
    case 'BOOTSTRAP':
      return {
        ...state,
        status: 'ready',
        loadError: null,
        session: action.session,
        deck: action.deck,
        taxonomies: action.taxonomies,
        suggestions: action.suggestions,
      };
    case 'BOOTSTRAP_ERROR':
      return { ...state, status: 'error', loadError: action.error };
    case 'ADOPT': {
      const cur = state.session;
      const next = action.session;
      if (!next) return state;
      // Monotonic rev guard: skipping a stale snapshot is lossless.
      if (
        cur &&
        cur.id === next.id &&
        typeof cur.rev === 'number' &&
        typeof next.rev === 'number' &&
        next.rev < cur.rev
      ) {
        return state;
      }
      return { ...state, session: next };
    }
    case 'PINS_LOCAL': {
      if (!state.session) return state;
      return {
        ...state,
        session: { ...state.session, pins: mergePins(state.session.pins || {}, action.pins) },
      };
    }
    case 'SET_SUGGESTIONS':
      return { ...state, suggestions: action.suggestions };
    case 'SET_STATS':
      return { ...state, stats: action.stats };
    case 'STREAMING':
      return { ...state, streaming: action.value };
    case 'MINING':
      return { ...state, miningInsights: action.value };
    case 'FINALIZE_START':
      return { ...state, pendingFinalizes: { ...state.pendingFinalizes, [action.cardId]: true } };
    case 'FINALIZE_END':
      return { ...state, pendingFinalizes: without(state.pendingFinalizes, action.cardId) };
    case 'REFINE_START':
      return { ...state, pendingRefines: { ...state.pendingRefines, [action.cardId]: true } };
    case 'REFINE_END':
      return { ...state, pendingRefines: without(state.pendingRefines, action.cardId) };
    case 'VARIANTS_START':
      return { ...state, pendingVariants: { ...state.pendingVariants, [action.cardId]: true } };
    case 'VARIANTS_END':
      return { ...state, pendingVariants: without(state.pendingVariants, action.cardId) };
    case 'ADD_COMMENT': {
      const key = action.mode === 'card' ? 'cardComments' : 'championComments';
      const store = state[key];
      const list = [...(store[action.cardId] || []), action.item];
      return { ...state, [key]: { ...store, [action.cardId]: list } };
    }
    case 'REMOVE_COMMENT': {
      const key = action.mode === 'card' ? 'cardComments' : 'championComments';
      const store = state[key];
      const list = (store[action.cardId] || []).filter((_, i) => i !== action.index);
      const nextStore = { ...store };
      if (list.length) nextStore[action.cardId] = list;
      else delete nextStore[action.cardId];
      return { ...state, [key]: nextStore };
    }
    case 'CLEAR_COMMENTS': {
      const key = action.mode === 'card' ? 'cardComments' : 'championComments';
      return { ...state, [key]: without(state[key], action.cardId) };
    }
    case 'SET_FEED_VIEW':
      return { ...state, ui: { ...state.ui, feedView: action.view } };
    case 'SET_LEVERS':
      return { ...state, ui: { ...state.ui, leversOpen: action.open } };
    case 'SET_EXTRAS':
      return { ...state, ui: { ...state.ui, extrasOpen: action.open } };
    case 'CLOSE_DRAWERS':
      if (!state.ui.leversOpen && !state.ui.extrasOpen) return state;
      return { ...state, ui: { ...state.ui, leversOpen: false, extrasOpen: false } };
    case 'SET_RAIL':
      return {
        ...state,
        ui: { ...state.ui, railOpen: action.open, unread: action.open ? false : state.ui.unread },
      };
    case 'SET_OVERLAY':
      return {
        ...state,
        ui: { ...state.ui, overlayOpen: action.open, unread: action.open ? false : state.ui.unread },
      };
    case 'SET_UNREAD':
      return { ...state, ui: { ...state.ui, unread: action.value } };
    case 'FLASH_CARD':
      return { ...state, ui: { ...state.ui, flashCardId: action.cardId } };
    case 'FINAL_GLOW':
      return { ...state, ui: { ...state.ui, finalGlowTick: state.ui.finalGlowTick + 1 } };
    default:
      return state;
  }
}

// ── Context ──────────────────────────────────────────────────────────────────

interface MutableResponse {
  session?: ForgeSession;
}

export interface ForgeStoreContextValue {
  sessionId: string;
  state: ForgeStoreState;
  dispatch: Dispatch<ForgeAction>;
  /** Adopt a server session snapshot (rev-guarded). */
  adopt: (session: ForgeSession | undefined | null) => void;
  /**
   * Run a mutation with CAS-conflict recovery: on 409/404 refetch the
   * snapshot, adopt it, and re-apply ONCE. A second conflict adopts the
   * fresh snapshot, shows the multi-tab snackbar, and rethrows (marked
   * `handled` so callers skip their own error toast).
   */
  mutate: <T extends MutableResponse>(fn: () => Promise<T>) => Promise<T>;
  /** Snackbar an error unless it was already handled (aborts stay silent too). */
  notifyError: (err: unknown) => void;
  showSnack: (opts: { message: string; tone?: 'default' | 'error'; action?: { label: string; onClick: () => void }; duration?: number }) => void;
  /** Awaited by Enter-to-generate so a mid-flight pin save lands first. */
  pinsSavingRef: MutableRefObject<Promise<void>>;
  chatInputRef: MutableRefObject<HTMLTextAreaElement | null>;
  composerRef: MutableRefObject<HTMLElement | null>;
  /** Detail navigation (?concept=<cardId> via native history). */
  detailId: string | null;
  openConcept: (cardId: string) => void;
  closeConcept: () => void;
  /** Chat concept chips: land on a visible board and flash the card. */
  revealCard: (cardId: string) => void;
  setRail: (open: boolean, opts?: { focus?: boolean }) => void;
  focusChat: () => void;
}

const ForgeStoreContext = createContext<ForgeStoreContextValue | null>(null);

export function useForgeStore(): ForgeStoreContextValue {
  const ctx = useContext(ForgeStoreContext);
  if (!ctx) throw new Error('useForgeStore must be used within <ForgeProvider>');
  return ctx;
}

const RAIL_STORAGE_KEY = 'forge.railOpen';

export function ForgeProvider({
  sessionId,
  initialDeck,
  children,
}: {
  sessionId: string;
  initialDeck: TrimmedDeck | null;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const snackbar = useSnackbar();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const pinsSavingRef = useRef<Promise<void>>(Promise.resolve());
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const composerRef = useRef<HTMLElement | null>(null);
  const detailReturnFocusRef = useRef<HTMLElement | null>(null);
  const pushedDetailRef = useRef(false);

  const detailId = searchParams.get('concept');
  const detailIdRef = useRef<string | null>(detailId);
  detailIdRef.current = detailId;

  const adopt = useCallback((session: ForgeSession | undefined | null) => {
    if (session) dispatch({ type: 'ADOPT', session });
  }, []);

  const showSnack = snackbar.show;

  const notifyError = useCallback(
    (err: unknown) => {
      if (err instanceof ForgeApiError && (err.aborted || err.handled)) return;
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      showSnack({ message, tone: 'error' });
    },
    [showSnack],
  );

  const mutate = useCallback(
    async <T extends MutableResponse>(fn: () => Promise<T>): Promise<T> => {
      const apply = async (): Promise<T> => {
        const res = await fn();
        if (res.session) dispatch({ type: 'ADOPT', session: res.session });
        return res;
      };
      try {
        return await apply();
      } catch (err) {
        const conflict =
          err instanceof ForgeApiError && (err.status === 409 || err.status === 404);
        if (!conflict) throw err;
        // Silent refetch + re-apply once.
        const snap = await getSessionSnapshot(sessionId);
        dispatch({ type: 'ADOPT', session: snap.session });
        try {
          return await apply();
        } catch (err2) {
          if (err2 instanceof ForgeApiError && err2.status === 409) {
            const snap2 = await getSessionSnapshot(sessionId).catch(() => null);
            if (snap2) dispatch({ type: 'ADOPT', session: snap2.session });
            showSnack({ message: 'This board changed in another tab — refreshed', tone: 'error' });
            err2.handled = true;
          }
          throw err2;
        }
      }
    },
    [sessionId, showSnack],
  );

  // ── Bootstrap: snapshot + taxonomies (loading skeleton meanwhile) ────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [snap, tax] = await Promise.all([
          getSessionSnapshot(sessionId),
          forgeFetch<Taxonomies>('GET', '/api/forge/taxonomies'),
        ]);
        if (cancelled) return;
        const deck = snap.deck ?? initialDeck;
        dispatch({
          type: 'BOOTSTRAP',
          session: snap.session,
          deck,
          taxonomies: snap.taxonomies ?? tax,
          suggestions: buildSuggestions(deck),
        });
      } catch (err) {
        if (cancelled) return;
        dispatch({
          type: 'BOOTSTRAP_ERROR',
          error: err instanceof Error ? err.message : 'Failed to load this forge session.',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // ── Rail open/closed persisted per browser ───────────────────────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RAIL_STORAGE_KEY);
      if (stored === '0') dispatch({ type: 'SET_RAIL', open: false });
    } catch {
      /* private mode */
    }
  }, []);

  const setRail = useCallback(
    (open: boolean, opts: { focus?: boolean } = {}) => {
      dispatch({ type: 'SET_RAIL', open });
      try {
        localStorage.setItem(RAIL_STORAGE_KEY, open ? '1' : '0');
      } catch {
        /* private mode */
      }
      if (open && opts.focus) {
        // Wait for the rail to render before focusing.
        setTimeout(() => chatInputRef.current?.focus(), 0);
      }
    },
    [],
  );

  const focusChat = useCallback(() => {
    dispatch({ type: 'SET_OVERLAY', open: true }); // below-xl sheet; no-op markup at xl+
    setRail(true, { focus: true });
  }, [setRail]);

  // ── Detail navigation (?concept=<id> — native history, state-driven) ─────
  const openConcept = useCallback(
    (cardId: string) => {
      const url = `${pathname}?concept=${encodeURIComponent(cardId)}`;
      if (detailIdRef.current) {
        // Switching concepts inside the detail replaces the entry — one Back
        // press always returns to the board, never through a detail trail.
        window.history.replaceState(null, '', url);
      } else {
        detailReturnFocusRef.current =
          document.activeElement instanceof HTMLElement ? document.activeElement : null;
        window.history.pushState(null, '', url);
        pushedDetailRef.current = true;
      }
    },
    [pathname],
  );

  const closeConcept = useCallback(() => {
    if (!detailIdRef.current) return;
    if (pushedDetailRef.current) {
      pushedDetailRef.current = false;
      window.history.back();
    } else {
      // Deep-linked entry — back() would leave the app; strip the param instead.
      window.history.replaceState(null, '', pathname);
    }
  }, [pathname]);

  // Focus management: restore focus to the opener when the detail closes
  // (covers our close button, Esc, and the browser Back button alike).
  const prevDetailRef = useRef<string | null>(detailId);
  useEffect(() => {
    const prev = prevDetailRef.current;
    prevDetailRef.current = detailId;
    if (prev && !detailId) {
      pushedDetailRef.current = false;
      const el = detailReturnFocusRef.current;
      detailReturnFocusRef.current = null;
      if (el && document.contains(el)) {
        try {
          el.focus();
        } catch {
          /* gone */
        }
      }
    }
  }, [detailId]);

  const revealCard = useCallback(
    (cardId: string) => {
      if (detailIdRef.current) closeConcept();
      dispatch({ type: 'SET_FEED_VIEW', view: 'board' });
      dispatch({ type: 'FLASH_CARD', cardId });
    },
    [closeConcept],
  );

  const value = useMemo<ForgeStoreContextValue>(
    () => ({
      sessionId,
      state,
      dispatch,
      adopt,
      mutate,
      notifyError,
      showSnack,
      pinsSavingRef,
      chatInputRef,
      composerRef,
      detailId,
      openConcept,
      closeConcept,
      revealCard,
      setRail,
      focusChat,
    }),
    [
      sessionId,
      state,
      adopt,
      mutate,
      notifyError,
      showSnack,
      detailId,
      openConcept,
      closeConcept,
      revealCard,
      setRail,
      focusChat,
    ],
  );

  return <ForgeStoreContext.Provider value={value}>{children}</ForgeStoreContext.Provider>;
}

// ── Name lookups (deck/taxonomy id → label) ──────────────────────────────────

export function usePinLabels() {
  const { state } = useForgeStore();
  const { deck, taxonomies } = state;
  return useMemo(
    () => ({
      personaName: (id: string) =>
        (deck?.personas || []).find((p) => p.id === id)?.name ?? id,
      painLabel: (id: string) => (deck?.pains || []).find((p) => p.id === id)?.label ?? id,
      stageName: (id: string) =>
        (taxonomies?.stages || []).find((s) => s.id === id)?.name ?? id,
      displayPin: (key: string, val: string) => {
        if (key === 'persona') return (deck?.personas || []).find((p) => p.id === val)?.name ?? val;
        if (key === 'pain') return (deck?.pains || []).find((p) => p.id === val)?.label ?? val;
        if (key === 'awarenessStage')
          return (taxonomies?.stages || []).find((s) => s.id === val)?.name ?? val;
        return val;
      },
    }),
    [deck, taxonomies],
  );
}
