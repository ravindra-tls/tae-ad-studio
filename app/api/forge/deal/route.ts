/**
 * POST /api/forge/deal
 *
 * Streaming deal: generate + judge concept cards in parallel chunks and emit
 * each gate-passer the moment its chunk is judged (NDJSON), so the board
 * fills progressively. One CAS write at stream end (idempotent card upserts).
 *
 * Body:   { sessionId, loadout? }
 * Stream: application/x-ndjson — one JSON object per line:
 *   { type: 'card', card }                       per gate-passing concept
 *   { type: 'done', stats, session }             session = sessionView incl. rev
 *   { type: 'error', error }                     on failure
 */
import { z } from 'zod';
import { requireForgeSession, jsonError } from '@/lib/forge/route-helpers';
import { getDeckForSession } from '@/lib/forge/deck';
import { getForgeState, mutateForgeState, sessionView } from '@/lib/forge/state';
import { upsertCards, addHistory } from '@/lib/forge/state-ops';
import { dealStream } from '@/lib/forge/engine';
import type { ForgeCard, ForgeLoadout } from '@/lib/forge/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const RequestBody = z.object({
  sessionId: z.uuid(),
  loadout: z.looseObject({}).optional(),
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

  const snapshot = await getForgeState(service, session.id);
  if (!snapshot) return jsonError(404, 'Session state not found');

  const loadout: ForgeLoadout = { ...(snapshot.state.pins || {}), ...((body.loadout || {}) as ForgeLoadout) };

  let deck;
  try {
    deck = (await getDeckForSession(service, session.product_id)).deck;
  } catch (err) {
    return jsonError(500, err instanceof Error ? err.message : 'Deck unavailable');
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (obj: unknown) => {
        try { controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n')); } catch { /* client gone */ }
      };
      try {
        const result = await dealStream({
          deck,
          loadout,
          onCard: (card: ForgeCard) => write({ type: 'card', card }),
        });
        // LLM work done — apply the results in one CAS window.
        const { state, rev } = await mutateForgeState(service, session.id, (draft) => {
          upsertCards(draft, result.cards);
          addHistory(draft, { type: 'deal', returned: result.cards.length, stats: result.stats });
        });
        write({ type: 'done', stats: result.stats, session: sessionView(state, rev, session) });
      } catch (err) {
        write({ type: 'error', error: err instanceof Error ? err.message : 'Generation failed' });
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
    cancel() {},
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
