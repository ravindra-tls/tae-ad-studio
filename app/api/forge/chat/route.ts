/**
 * POST /api/forge/chat
 *
 * One creative-director turn (Sonnet) + judge pass on any emitted cards
 * (Haiku). Two-phase CAS, preserving Concept Forge's semantics:
 *
 *   CAS #1: append the user turn (or, for retry, pop trailing assistant
 *           messages and re-run the last user turn without duplicating it).
 *   LLM:    directorTurn on the post-CAS snapshot (outside any CAS window).
 *   CAS #2: upsert judged cards + merge AI pins (only into slots unchanged
 *           since the snapshot) + append the assistant reply.
 *
 * Body:     { sessionId, message? } or { sessionId, retry: true }
 * Response: { reply, cards, pins, suggestions, session }
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireForgeSession, jsonError, forgeErrorResponse } from '@/lib/forge/route-helpers';
import { getDeckForSession } from '@/lib/forge/deck';
import { mutateForgeState, sessionView, MutationAbortError } from '@/lib/forge/state';
import { addChat, setPins, upsertCards } from '@/lib/forge/state-ops';
import { directorTurn } from '@/lib/forge/director';
import { scoreCards } from '@/lib/forge/judge';
import type { ForgeCard, ForgeChatMessage, ForgePins } from '@/lib/forge/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const RequestBody = z.object({
  sessionId: z.uuid(),
  message: z.string().max(4000).optional(),
  retry: z.boolean().optional(),
});

export async function POST(request: Request) {
  let body: z.infer<typeof RequestBody>;
  try {
    body = RequestBody.parse(await request.json());
  } catch (err) {
    return jsonError(400, err instanceof Error ? err.message : 'Invalid request body');
  }

  const ctx = await requireForgeSession(body.sessionId);
  if (!ctx.ok) return ctx.response;
  const { service, session } = ctx;

  if (body.retry !== true && !String(body.message || '').trim()) {
    return jsonError(400, 'message required');
  }

  try {
    // ── Phase 1: CAS the user turn into the chat ──────────────────────────
    let message = '';

    let phase1;
    try {
      phase1 = await mutateForgeState(service, session.id, (draft) => {
        if (body.retry === true) {
          // Regenerate: re-run the last user turn without duplicating history.
          while (draft.chat.length && draft.chat[draft.chat.length - 1].role === 'assistant') draft.chat.pop();
          const idx = draft.chat.map((m) => m.role).lastIndexOf('user');
          if (idx === -1) throw new MutationAbortError('Nothing to regenerate yet.');
          message = draft.chat[idx].text;
        } else {
          message = String(body.message || '').trim();
          addChat(draft, 'user', message);
        }
      });
    } catch (err) {
      if (err instanceof MutationAbortError) return jsonError(400, err.message);
      throw err;
    }

    // Snapshot for the LLM turn (post-phase-1 state).
    const chat = phase1.state.chat;
    const lastUserIdx = chat.map((m) => m.role).lastIndexOf('user');
    const priorChat: ForgeChatMessage[] = lastUserIdx === -1 ? chat.slice() : chat.slice(0, lastUserIdx);
    const pinsSnapshot: ForgePins = structuredClone(phase1.state.pins || {});
    const boardSnapshot = phase1.state.board;

    // ── LLM work (outside any CAS window) ────────────────────────────────
    const deck = (await getDeckForSession(service, session.product_id)).deck;
    const turn = await directorTurn({
      deck,
      message,
      chat: priorChat,
      board: boardSnapshot,
      pins: pinsSnapshot,
    });

    let judged: ForgeCard[] = [];
    if (turn.cards && turn.cards.length) {
      judged = await scoreCards({ deck, cards: turn.cards });
    }

    // ── Phase 2: CAS the results in ───────────────────────────────────────
    const { state, rev } = await mutateForgeState(service, session.id, (draft) => {
      if (judged.length) upsertCards(draft, judged);
      if (turn.pins) {
        // Merge AI pins only into slots the user has not changed since the snapshot.
        const safePins: ForgePins = {};
        for (const [k, v] of Object.entries(turn.pins)) {
          const current = draft.pins[k];
          const snapshotVal = pinsSnapshot[k];
          if (JSON.stringify(current ?? null) === JSON.stringify(snapshotVal ?? null)) {
            safePins[k] = v;
          }
        }
        setPins(draft, safePins);
      }
      // Card refs ride on the chat entry so replies stay linked to the concepts they made.
      addChat(draft, 'assistant', turn.reply,
        judged.length ? { cards: judged.map((c) => ({ id: c.id, tagline: c.tagline })) } : undefined);
    });

    return NextResponse.json({
      reply: turn.reply,
      cards: judged,
      pins: state.pins,
      suggestions: turn.suggestions,
      session: sessionView(state, rev, session),
    });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
