/**
 * POST /api/forge/export
 *
 * Build the reproducible image prompt for a finalized concept (template-fill
 * or concept-first compose — Opus) and persist the export record to
 * forge_concepts.export_record.
 *
 * Body:     { sessionId, card, champion, templateNumber? } — templateNumber
 *           may be a template number or the string 'freeform'.
 * Response: { record, forgeConceptId, warnings }
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireForgeSession, jsonError, forgeErrorResponse } from '@/lib/forge/route-helpers';
import { getDeckForSession } from '@/lib/forge/deck';
import { getForgeState } from '@/lib/forge/state';
import { exportConcept } from '@/lib/forge/export';
import type { ChampionOutput, ForgeCard } from '@/lib/forge/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const RequestBody = z.object({
  sessionId: z.uuid(),
  card: z.looseObject({ id: z.uuid() }),
  champion: z.looseObject({ headline: z.string() }),
  templateNumber: z.union([z.number().int().positive(), z.literal('freeform')]).nullish(),
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
  const champion = body.champion as unknown as ChampionOutput;

  try {
    const snapshot = await getForgeState(service, session.id);
    if (!snapshot) return jsonError(404, 'Session state not found');

    const deck = (await getDeckForSession(service, session.product_id)).deck;

    // Session uploads are durable public URLs (generated-images bucket); when
    // none exist the generate route falls back to product images, so the prompt
    // should still assume refs will be attached.
    const userRefUrls = (snapshot.state.userRefs || []).map((r) => r.url);

    const out = await exportConcept({
      deck,
      champion,
      card,
      referenceImages: userRefUrls,
      pins: snapshot.state.pins || {},
      brandSlug: deck.brand,
      templateNumber: body.templateNumber ?? null,
      assumeRefs: true,
      workspaceId: session.workspace_id,
    });

    if (!out.record) {
      return jsonError(422, out.error || 'Export failed — no record produced.');
    }

    // Persist to the durable finalized concept (created at finalize time).
    const { data: conceptRow, error: upErr } = await service
      .from('forge_concepts')
      .update({ export_record: out.record, updated_at: new Date().toISOString() })
      .eq('session_id', session.id)
      .eq('card_id', card.id)
      .select('id')
      .maybeSingle();

    let forgeConceptId = conceptRow?.id ?? null;
    if (upErr) {
      return jsonError(500, `Failed to persist export record: ${upErr.message}`);
    }
    if (!forgeConceptId) {
      // Concept row missing (finalize never persisted) — create it now.
      const { data: created, error: insErr } = await service
        .from('forge_concepts')
        .upsert(
          {
            session_id: session.id,
            card_id: card.id,
            dna: card.dna ?? null,
            card,
            champion,
            export_record: out.record,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'session_id,card_id' },
        )
        .select('id')
        .single();
      if (insErr || !created) {
        return jsonError(500, `Failed to persist export record: ${insErr?.message ?? 'unknown'}`);
      }
      forgeConceptId = created.id;
    }

    return NextResponse.json({
      record: out.record,
      forgeConceptId,
      warnings: out.record.warnings,
    });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
