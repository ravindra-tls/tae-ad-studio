/**
 * POST /api/forge/breed
 *
 * Breed new concepts from parent cards — backs the "Make variants" button on
 * every concept card (parents = the clicked card) and defaults to the
 * session's favorites when no parents are passed.
 *
 * Body:     { sessionId, parents?, loadout? }
 * Response: { cards, stats, session }
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireForgeSession, jsonError, forgeErrorResponse } from '@/lib/forge/route-helpers';
import { getDeckForSession } from '@/lib/forge/deck';
import { getForgeState, mutateForgeState, sessionView } from '@/lib/forge/state';
import { upsertCards, addHistory } from '@/lib/forge/state-ops';
import { breedHand } from '@/lib/forge/engine';
import type { ForgeCard, ForgeLoadout } from '@/lib/forge/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const CardSchema = z.looseObject({ id: z.string() });

const RequestBody = z.object({
  sessionId: z.uuid(),
  parents: z.array(CardSchema).max(12).optional(),
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

  try {
    const snapshot = await getForgeState(service, session.id);
    if (!snapshot) return jsonError(404, 'Session state not found');

    const parents = (body.parents && body.parents.length
      ? (body.parents as unknown as ForgeCard[])
      : snapshot.state.favorites);
    if (!parents || !parents.length) {
      return jsonError(400, 'No parent concepts to breed from. Keep at least one card first.');
    }

    const loadout: ForgeLoadout = { ...(snapshot.state.pins || {}), ...((body.loadout || {}) as ForgeLoadout) };
    const deck = (await getDeckForSession(service, session.product_id)).deck;

    const result = await breedHand({ deck, parents, loadout, suppressed: snapshot.state.suppressed });

    const { state, rev } = await mutateForgeState(service, session.id, (draft) => {
      upsertCards(draft, result.cards);
      addHistory(draft, { type: 'breed', returned: result.cards.length, stats: result.stats });
    });

    return NextResponse.json({
      cards: result.cards,
      stats: result.stats,
      session: sessionView(state, rev, session),
    });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
