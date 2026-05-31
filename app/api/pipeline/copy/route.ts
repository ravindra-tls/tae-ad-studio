/**
 * POST /api/pipeline/copy
 *
 * Pipeline stage 3. Given a concept the user selected at checkpoint 2,
 * produces structured ad copy (headline + alternates + body + CTA) and
 * persists a row into copy_blocks.
 *
 * Request body:
 *   {
 *     concept_id: uuid,
 *     alternates?: 0-5         // default 3
 *   }
 *
 * Auth: user must own the concept via concepts → briefs → sessions (RLS).
 *
 * Returns: { copy_block: CopyBlock, trace: StageProgress[] }
 *
 * The route DOES NOT require concept.selected_at to be set — callers might
 * preview copy on any concept during exploration. The orchestrator route
 * (Phase 2, later) will gate by selection when fanning out.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getBrandConfig } from '@/lib/brand-config';
import { copyStage } from '@/lib/pipeline/stages/copy';
import { COPY_PROMPT_VERSION } from '@/lib/pipeline/prompts/copy';
import type { StageProgress } from '@/lib/pipeline/types';
import type { Brief, Concept, Product } from '@/types';

export const maxDuration = 60;

const RequestBody = z.object({
  concept_id: z.string().uuid(),
  alternates: z.number().int().min(0).max(5).optional(),
});

export async function POST(request: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Validate body ─────────────────────────────────────────────────────────
  let parsed: z.infer<typeof RequestBody>;
  try {
    parsed = RequestBody.parse(await request.json());
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid request body';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // ── Ownership: fetch concept + chain to session via service client.
  //    RLS on user-scoped client was returning null for legitimate owners
  //    in Route Handler context; enforce ownership explicitly instead.
  const service = await createServiceClient();
  const { data: conceptRow, error: conceptError } = await service
    .from('concepts')
    .select('*, brief:briefs!inner(session:sessions!inner(user_id))')
    .eq('id', parsed.concept_id)
    .single();

  if (
    conceptError ||
    !conceptRow ||
    (conceptRow as unknown as { brief: { session: { user_id: string } } }).brief.session.user_id !== user.id
  ) {
    return NextResponse.json(
      { error: 'Concept not found or not accessible' },
      { status: 404 },
    );
  }
  const concept = conceptRow as Concept;

  // ── Fetch brief + product + brand via service client ─────────────────────
  const [{ data: briefRow, error: briefError }] = await Promise.all([
    service.from('briefs').select('*').eq('id', concept.brief_id).single(),
  ]);

  if (briefError || !briefRow) {
    return NextResponse.json(
      { error: 'Brief not found for concept' },
      { status: 404 },
    );
  }
  const brief = briefRow as Brief;

  const [{ data: product, error: productError }, brand] = await Promise.all([
    service.from('products').select('*').eq('id', brief.product_id).single(),
    getBrandConfig(),
  ]);

  if (productError || !product) {
    return NextResponse.json(
      { error: 'Product not found for brief' },
      { status: 404 },
    );
  }

  // ── Run the stage ────────────────────────────────────────────────────────
  const trace: StageProgress[] = [];
  let stageOutput;
  try {
    stageOutput = await copyStage.run(
      {
        brief,
        concept,
        product: product as Product,
        brand,
        alternates: parsed.alternates ?? 3,
      },
      trace,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/pipeline/copy] stage failed:', msg);
    const friendlyError =
      msg.includes('usage limits') || msg.includes('rate_limit') || msg.includes('429')
        ? 'AI service usage limit reached. Please try again after your billing period resets.'
        : msg.includes('401') || msg.includes('authentication')
        ? 'AI service authentication error. Check the ANTHROPIC_API_KEY environment variable.'
        : msg.includes('overloaded') || msg.includes('529')
        ? 'AI service is temporarily overloaded. Please try again in a moment.'
        : 'Copy generation failed. Please try again.';
    return NextResponse.json(
      { error: friendlyError, trace },
      { status: 502 },
    );
  }

  // ── Persist ──────────────────────────────────────────────────────────────
  const { data: inserted, error: insertError } = await service
    .from('copy_blocks')
    .insert({
      concept_id: concept.id,
      brief_id: brief.id,
      structured: {
        ...stageOutput.structured,
        _meta: {
          prompt_version: stageOutput.prompt_version,
          model: stageOutput.model,
        },
      },
      prompt_version: stageOutput.prompt_version,
      model: stageOutput.model,
    })
    .select()
    .single();

  if (insertError || !inserted) {
    console.error(
      '[api/pipeline/copy] DB insert failed:',
      insertError?.message,
    );
    return NextResponse.json(
      {
        error: `Failed to persist copy block: ${insertError?.message}`,
        trace,
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      copy_block: inserted,
      trace,
      _meta: {
        prompt_version: COPY_PROMPT_VERSION,
        model: stageOutput.model,
      },
    },
    { status: 201 },
  );
}
