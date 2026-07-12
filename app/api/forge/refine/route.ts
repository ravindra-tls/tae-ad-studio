/**
 * POST /api/forge/refine
 *
 * Refine a concept from inline comments (select-text → comment → regenerate),
 * then re-judge it. The refined card keeps its id, replacing the original on
 * the board.
 *
 * Body:     { sessionId, card, comments? }
 * Response: { card, session }
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireForgeSession, jsonError, forgeErrorResponse } from '@/lib/forge/route-helpers';
import { getDeckForSession } from '@/lib/forge/deck';
import { getForgeState, mutateForgeState, sessionView } from '@/lib/forge/state';
import { upsertCards } from '@/lib/forge/state-ops';
import { refineCard } from '@/lib/forge/refine';
import { scoreCards } from '@/lib/forge/judge';
import type { ForgeCard } from '@/lib/forge/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const RequestBody = z.object({
  sessionId: z.uuid(),
  card: z.looseObject({ id: z.string() }),
  comments: z.array(z.object({
    quote: z.string().max(2000),
    comment: z.string().max(2000),
  })).max(30).optional(),
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

    const deck = (await getDeckForSession(service, session.product_id)).deck;
    const refined = await refineCard({
      deck,
      card: body.card as unknown as ForgeCard,
      comments: body.comments || [],
      pins: snapshot.state.pins,
    });
    const [judged] = await scoreCards({ deck, cards: [refined] });

    const { state, rev } = await mutateForgeState(service, session.id, (draft) => {
      upsertCards(draft, [judged]);
    });

    return NextResponse.json({ card: judged, session: sessionView(state, rev, session) });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
