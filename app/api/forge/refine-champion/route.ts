/**
 * POST /api/forge/refine-champion
 *
 * Re-polish a finalized concept from inline comments (Opus). Updates the
 * champion entry in state and the durable forge_concepts row.
 *
 * Body:     { sessionId, card, champion, comments? }
 * Response: { champion, forgeConceptId, session }
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireForgeSession, jsonError, forgeErrorResponse } from '@/lib/forge/route-helpers';
import { getDeckForSession } from '@/lib/forge/deck';
import { mutateForgeState, sessionView } from '@/lib/forge/state';
import { refineChampion } from '@/lib/forge/champion';
import type { ChampionOutput, ForgeCard } from '@/lib/forge/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const RequestBody = z.object({
  sessionId: z.uuid(),
  card: z.looseObject({ id: z.uuid() }),
  champion: z.looseObject({ headline: z.string() }),
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

  const card = body.card as unknown as ForgeCard;

  try {
    const deck = (await getDeckForSession(service, session.product_id)).deck;
    const champion = await refineChampion({
      deck,
      card,
      champion: body.champion as unknown as ChampionOutput,
      comments: body.comments || [],
    });

    const { state, rev } = await mutateForgeState(service, session.id, (draft) => {
      const entry = draft.champions.find((c) => c.id === card.id);
      if (entry) {
        entry.champion = champion;
      } else {
        draft.champions.push({ id: card.id, dna: card.dna, champion, at: new Date().toISOString() });
      }
    });

    const { data: conceptRow, error: upsertErr } = await service
      .from('forge_concepts')
      .upsert(
        {
          session_id: session.id,
          card_id: card.id,
          dna: card.dna ?? null,
          card,
          champion,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'session_id,card_id' },
      )
      .select('id')
      .single();
    if (upsertErr || !conceptRow) {
      return jsonError(500, `Failed to persist finalized concept: ${upsertErr?.message ?? 'unknown'}`);
    }

    return NextResponse.json({
      champion,
      forgeConceptId: conceptRow.id,
      session: sessionView(state, rev, session),
    });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
