/**
 * POST /api/pipeline/visual
 *
 * Pipeline stage 4. Given a concept (+ optional copy block), produces a
 * structured visual spec + an assembled image-provider prompt, and persists
 * a row into visual_specs.
 *
 * Request body:
 *   {
 *     concept_id:    uuid,
 *     copy_block_id: uuid | null,          // pair with copy for text zones
 *     aspect_ratio?: '1:1' | '4:5' | '9:16' | '16:9' | '3:4'
 *   }
 *
 * Auth: user must own the concept via concepts → briefs → sessions.
 * If copy_block_id is provided, we additionally verify the copy_block
 * belongs to the same concept.
 *
 * Returns: { visual_spec: VisualSpec, trace: StageProgress[] }
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getBrandConfig } from '@/lib/brand-config';
import { visualStage } from '@/lib/pipeline/stages/visual';
import { VISUAL_PROMPT_VERSION } from '@/lib/pipeline/prompts/visual';
import type { StageProgress } from '@/lib/pipeline/types';
import type { Brief, Concept, Product } from '@/types';

export const maxDuration = 60;

const RequestBody = z.object({
  concept_id: z.string().uuid(),
  copy_block_id: z.string().uuid().nullable().optional(),
  aspect_ratio: z.enum(['1:1', '4:5', '9:16', '16:9', '3:4']).optional(),
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

  // ── Ownership: concept + chain to session via service client ────────────
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

  // ── Optional copy_block: must belong to the same concept ─────────────────
  let copyBlock: { id: string; structured: Record<string, unknown> } | null = null;
  if (parsed.copy_block_id) {
    const { data: cb, error: cbError } = await service
      .from('copy_blocks')
      .select('*')
      .eq('id', parsed.copy_block_id)
      .single();

    if (cbError || !cb) {
      return NextResponse.json(
        { error: 'Copy block not found or not accessible' },
        { status: 404 },
      );
    }
    if ((cb as { concept_id: string }).concept_id !== concept.id) {
      return NextResponse.json(
        { error: 'Copy block does not belong to the requested concept' },
        { status: 400 },
      );
    }
    copyBlock = cb as { id: string; structured: Record<string, unknown> };
  }

  // ── Brief + product + brand via service ──────────────────────────────────
  const { data: briefRow, error: briefError } = await service
    .from('briefs')
    .select('*')
    .eq('id', concept.brief_id)
    .single();

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

  // ── Run stage ────────────────────────────────────────────────────────────
  const trace: StageProgress[] = [];
  let stageOutput;
  try {
    stageOutput = await visualStage.run(
      {
        brief,
        concept,
        copy: copyBlock,
        product: product as Product,
        brand,
        aspect_ratio: parsed.aspect_ratio ?? '4:5',
      },
      trace,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/pipeline/visual] stage failed:', msg);
    return NextResponse.json(
      { error: `Visual stage failed: ${msg}`, trace },
      { status: 502 },
    );
  }

  // ── Persist ──────────────────────────────────────────────────────────────
  const { data: inserted, error: insertError } = await service
    .from('visual_specs')
    .insert({
      concept_id: concept.id,
      brief_id: brief.id,
      copy_block_id: copyBlock?.id ?? null,
      prompt_text: stageOutput.prompt_text,
      aspect_ratio: stageOutput.aspect_ratio,
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
      '[api/pipeline/visual] DB insert failed:',
      insertError?.message,
    );
    return NextResponse.json(
      {
        error: `Failed to persist visual spec: ${insertError?.message}`,
        trace,
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      visual_spec: inserted,
      trace,
      _meta: {
        prompt_version: VISUAL_PROMPT_VERSION,
        model: stageOutput.model,
      },
    },
    { status: 201 },
  );
}
