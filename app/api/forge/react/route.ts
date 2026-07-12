/**
 * POST /api/forge/react
 *
 * Keep (favorite) or discard a card — feeds the gene pool, score, streak,
 * favorites, and suppression list.
 *
 * Body:     { sessionId, card, keep }
 * Response: { session }
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireForgeSession, jsonError, forgeErrorResponse } from '@/lib/forge/route-helpers';
import { mutateForgeState, sessionView } from '@/lib/forge/state';
import { reinforce, suppressDna, removeCard } from '@/lib/forge/state-ops';
import type { ForgeCard } from '@/lib/forge/types';

export const dynamic = 'force-dynamic';

const RequestBody = z.object({
  sessionId: z.uuid(),
  card: z.looseObject({ id: z.string() }),
  keep: z.boolean().default(false),
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

  const card = body.card as unknown as ForgeCard;

  try {
    const { state, rev } = await mutateForgeState(service, session.id, (draft) => {
      if (body.keep) {
        if (!draft.favorites.find((c) => c.id === card.id)) draft.favorites.push(card);
        reinforce(draft, card.dna, +1);
        draft.score += Math.max(1, Math.round((card.scores?.overall || 50) / 10));
        draft.streak += 1;
      } else {
        reinforce(draft, card.dna, -1);
        suppressDna(draft, card.dna);
        removeCard(draft, card.id); // drop from board + favorites
        draft.streak = 0;
      }
    });
    return NextResponse.json({ session: sessionView(state, rev, session) });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
