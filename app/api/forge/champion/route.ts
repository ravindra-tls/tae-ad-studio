/**
 * POST /api/forge/champion
 *
 * Crown a champion (final Opus polish) and persist the finalized concept:
 *   - CAS state.champions (re-finalizing replaces, never duplicates) + score
 *   - upsert forge_concepts (UNIQUE session_id, card_id)
 *   - reject a same-card finalize while one is in flight (<120s): in-memory
 *     map (single-process) + forge_concepts.updated_at guard (multi-process).
 *
 * Body:     { sessionId, card }
 * Response: { champion, forgeConceptId, session }
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireForgeSession, jsonError, forgeErrorResponse } from '@/lib/forge/route-helpers';
import { getDeckForSession } from '@/lib/forge/deck';
import { mutateForgeState, sessionView } from '@/lib/forge/state';
import { polishChampion } from '@/lib/forge/champion';
import type { ChampionEntry, ForgeCard } from '@/lib/forge/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const IN_FLIGHT_TTL_MS = 120_000;
// Single-process in-flight guard (fine self-hosted; DB guard covers the rest).
const inFlight = new Map<string, number>();

function sweepInFlight(): void {
  const now = Date.now();
  for (const [k, at] of inFlight) {
    if (now - at > IN_FLIGHT_TTL_MS) inFlight.delete(k);
  }
}

const RequestBody = z.object({
  sessionId: z.uuid(),
  card: z.looseObject({ id: z.uuid() }),
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
  const flightKey = `${session.id}:${card.id}`;

  sweepInFlight();
  const startedAt = inFlight.get(flightKey);
  if (startedAt && Date.now() - startedAt < IN_FLIGHT_TTL_MS) {
    return jsonError(409, 'This concept is already being finalized — give it a moment.');
  }
  // Multi-process double-submit guard: a row updated within the TTL means an
  // identical finalize just landed (or is landing) elsewhere.
  const { data: recentRow } = await service
    .from('forge_concepts')
    .select('id, updated_at')
    .eq('session_id', session.id)
    .eq('card_id', card.id)
    .maybeSingle();
  if (recentRow?.updated_at && Date.now() - Date.parse(recentRow.updated_at) < IN_FLIGHT_TTL_MS) {
    return jsonError(409, 'This concept was just finalized — refresh to see the result.');
  }

  inFlight.set(flightKey, Date.now());

  try {
    const deck = (await getDeckForSession(service, session.product_id)).deck;
    const champion = await polishChampion({ deck, card });

    const entry: ChampionEntry = { id: card.id, dna: card.dna, champion, at: new Date().toISOString() };
    const { state, rev } = await mutateForgeState(service, session.id, (draft) => {
      const i = draft.champions.findIndex((c) => c.id === entry.id);
      if (i === -1) draft.champions.push(entry);
      else draft.champions[i] = entry; // re-finalizing replaces, never duplicates
      draft.score += 25;
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
  } finally {
    inFlight.delete(flightKey);
  }
}
