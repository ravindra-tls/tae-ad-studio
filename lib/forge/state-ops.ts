/**
 * Pure, re-appliable mutators over the ForgeState document.
 * Ported from Concept Forge lib/session.js (fs persistence dropped).
 *
 * Every mutator MUST be safe to re-apply to a fresh copy of state — the CAS
 * loop in lib/forge/state.ts re-runs mutators on conflict retries.
 */
import type {
  CardDna,
  ForgeCard,
  ForgeChatMessage,
  ForgeHistoryEntry,
  ForgeInsight,
  ForgePins,
  ForgeState,
} from './types';

export const BOARD_CAP = 100;
export const CHAT_CAP = 60;
export const HISTORY_CAP = 200;

/** A fresh, empty state document (rev 1 shape). */
export function emptyState(): ForgeState {
  return {
    board: [],
    pins: {},
    chat: [],
    champions: [],
    insightsCache: {},
    genePool: {},
    suppressed: [],
    favorites: [],
    history: [],
    score: 0,
    streak: 0,
    userRefs: [],
  };
}

/** Ensure fields added in later versions exist on rehydrated states. */
export function normalize(s: Partial<ForgeState> | null | undefined): ForgeState {
  const out = (s && typeof s === 'object' ? s : {}) as ForgeState;
  if (!Array.isArray(out.board)) out.board = [];
  if (!out.pins || typeof out.pins !== 'object') out.pins = {};
  if (!Array.isArray(out.chat)) out.chat = [];
  if (!Array.isArray(out.champions)) out.champions = [];
  if (!out.insightsCache || typeof out.insightsCache !== 'object') out.insightsCache = {};
  if (!out.genePool || typeof out.genePool !== 'object') out.genePool = {};
  if (!Array.isArray(out.suppressed)) out.suppressed = [];
  if (!Array.isArray(out.favorites)) out.favorites = [];
  if (!Array.isArray(out.history)) out.history = [];
  if (typeof out.score !== 'number') out.score = 0;
  if (typeof out.streak !== 'number') out.streak = 0;
  if (!Array.isArray(out.userRefs)) out.userRefs = [];
  return out;
}

/**
 * Add or replace cards on the board (newest first). Match by id.
 * Enforces BOARD_CAP by evicting the oldest non-favorite card
 * (oldest overall if everything is a favorite).
 */
export function upsertCards(state: ForgeState, cards: ForgeCard[] | null | undefined): void {
  for (const card of cards || []) {
    const clean: ForgeCard = { ...card };
    delete clean.replaces;
    const i = state.board.findIndex((c) => c.id === clean.id);
    if (i === -1) state.board.unshift(clean);
    else state.board[i] = clean;
  }
  if (state.board.length > BOARD_CAP) {
    const favIds = new Set(state.favorites.map((c) => c.id));
    while (state.board.length > BOARD_CAP) {
      let evicted = false;
      for (let i = state.board.length - 1; i >= 0; i--) {
        if (!favIds.has(state.board[i].id)) {
          state.board.splice(i, 1);
          evicted = true;
          break;
        }
      }
      if (!evicted) state.board.pop(); // all favorites — still enforce the cap
    }
  }
}

export function removeCard(state: ForgeState, id: string): void {
  state.board = state.board.filter((c) => c.id !== id);
  state.favorites = state.favorites.filter((c) => c.id !== id);
}

/** Merge pins; an empty string (or null) clears that slot. */
export function setPins(state: ForgeState, pins: ForgePins | null | undefined): void {
  for (const [k, v] of Object.entries(pins || {})) {
    if (v === '' || v === null) delete state.pins[k];
    else if (v !== undefined) state.pins[k] = v;
  }
}

export function setInsightsCache(state: ForgeState, key: string, insights: ForgeInsight[] | null | undefined): void {
  if (!state.insightsCache || typeof state.insightsCache !== 'object') state.insightsCache = {};
  state.insightsCache[key] = { at: new Date().toISOString(), insights: insights || [] };
}

export function addChat(
  state: ForgeState,
  role: 'user' | 'assistant',
  text: string,
  extra?: Record<string, unknown>,
): void {
  if (!text) return;
  state.chat.push({ role, text, at: new Date().toISOString(), ...(extra || {}) } as ForgeChatMessage);
  if (state.chat.length > CHAT_CAP) state.chat = state.chat.slice(-CHAT_CAP);
}

export function addHistory(
  state: ForgeState,
  entry: { type: string; at?: string; [key: string]: unknown },
): void {
  const full: ForgeHistoryEntry = { ...entry, at: entry.at ?? new Date().toISOString() };
  state.history.push(full);
  if (state.history.length > HISTORY_CAP) state.history = state.history.slice(-HISTORY_CAP);
}

/** Bump gene-pool weights for a kept card's DNA; negative delta decays them. */
export function reinforce(state: ForgeState, dna: CardDna | null | undefined, delta: number): void {
  if (!dna) return;
  for (const [dim, value] of Object.entries(dna)) {
    if (!value) continue;
    const key = `${dim}:${value}`;
    state.genePool[key] = (state.genePool[key] || 0) + delta;
    if (state.genePool[key] <= 0) delete state.genePool[key];
  }
}

export function suppressDna(state: ForgeState, dna: CardDna | null | undefined): void {
  if (!dna) return;
  // Suppress the most defining dims (mechanic + format + hookTactic) so breeding avoids them.
  for (const dim of ['mechanic', 'format', 'hookTactic'] as const) {
    if (dna[dim]) {
      const key = `${dim}:${dna[dim]}`;
      if (!state.suppressed.includes(key)) state.suppressed.push(key);
    }
  }
}
