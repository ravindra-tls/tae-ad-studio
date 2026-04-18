/**
 * POST /api/pipeline/critique
 *
 * Pipeline stage 6. Runs adversarial critique on the assembled bundle
 * (brief + concept + copy_block + visual_spec). If the verdict is 'refine'
 * and the caller didn't opt out, additionally runs ONE bounded refinement
 * pass (copy OR visual, picked from refine_targets[0]) and persists the
 * refined row alongside the critique.
 *
 * Request body:
 *   {
 *     concept_id:     uuid,
 *     copy_block_id:  uuid,            // required — we critique the bundle
 *     visual_spec_id: uuid,            // required — we critique the bundle
 *     judge_notes?:   string,          // extra guidance for the judge
 *     auto_refine?:   boolean          // default true; set false to just critique
 *   }
 *
 * Auth: user must own the concept via RLS. copy_block and visual_spec must
 * belong to that concept.
 *
 * Returns:
 *   {
 *     critique: Critique,                 // persisted row
 *     refined?: {
 *       target: 'copy' | 'visual',
 *       copy_block?:   CopyBlock,         // when target === 'copy'
 *       visual_spec?:  VisualSpec,        // when target === 'visual'
 *     },
 *     trace: StageProgress[]
 *   }
 *
 * Invariants:
 *   - Refinement runs AT MOST ONCE. If the critique says refine both copy
 *     AND visual, we take only the first target.
 *   - When we refine, we DO NOT re-run critique on the refined output in V1.
 *     The user sees the refined row and the critique's verdict/notes and
 *     decides whether to ship.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getBrandConfig } from '@/lib/brand-config';
import {
  critiqueStage,
  refineCopyStage,
  refineVisualStage,
} from '@/lib/pipeline/stages/critique';
import { CRITIQUE_PROMPT_VERSION } from '@/lib/pipeline/prompts/critique';
import type { StageProgress } from '@/lib/pipeline/types';
import type { AspectRatio } from '@/lib/pipeline/schemas/visual';
import type { Brief, Concept, CopyBlock, Product, VisualSpec } from '@/types';

// Critique + optional refine can chain 2 Claude calls; give headroom.
export const maxDuration = 90;

const RequestBody = z.object({
  concept_id: z.string().uuid(),
  copy_block_id: z.string().uuid(),
  visual_spec_id: z.string().uuid(),
  judge_notes: z.string().max(2000).optional(),
  auto_refine: z.boolean().optional(),
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

  const autoRefine = parsed.auto_refine ?? true;

  // ── Ownership: concept via RLS ────────────────────────────────────────────
  const { data: conceptRow, error: conceptError } = await supabase
    .from('concepts')
    .select('*')
    .eq('id', parsed.concept_id)
    .single();

  if (conceptError || !conceptRow) {
    return NextResponse.json(
      { error: 'Concept not found or not accessible' },
      { status: 404 },
    );
  }
  const concept = conceptRow as Concept;

  // ── Verify copy_block + visual_spec belong to this concept ───────────────
  const [{ data: cbRow, error: cbError }, { data: vsRow, error: vsError }] =
    await Promise.all([
      supabase
        .from('copy_blocks')
        .select('*')
        .eq('id', parsed.copy_block_id)
        .single(),
      supabase
        .from('visual_specs')
        .select('*')
        .eq('id', parsed.visual_spec_id)
        .single(),
    ]);

  if (cbError || !cbRow) {
    return NextResponse.json(
      { error: 'Copy block not found or not accessible' },
      { status: 404 },
    );
  }
  if ((cbRow as CopyBlock).concept_id !== concept.id) {
    return NextResponse.json(
      { error: 'Copy block does not belong to the requested concept' },
      { status: 400 },
    );
  }
  const copyBlock = cbRow as CopyBlock;

  if (vsError || !vsRow) {
    return NextResponse.json(
      { error: 'Visual spec not found or not accessible' },
      { status: 404 },
    );
  }
  if ((vsRow as VisualSpec).concept_id !== concept.id) {
    return NextResponse.json(
      { error: 'Visual spec does not belong to the requested concept' },
      { status: 400 },
    );
  }
  const visualSpec = vsRow as VisualSpec;

  // ── Brief + product + brand via service client ───────────────────────────
  const service = await createServiceClient();
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

  const [{ data: productRow, error: productError }, brand] = await Promise.all([
    service.from('products').select('*').eq('id', brief.product_id).single(),
    getBrandConfig(),
  ]);

  if (productError || !productRow) {
    return NextResponse.json(
      { error: 'Product not found for brief' },
      { status: 404 },
    );
  }
  const product = productRow as Product;

  // ── Run critique ─────────────────────────────────────────────────────────
  const trace: StageProgress[] = [];
  let critiqueOutput;
  try {
    critiqueOutput = await critiqueStage.run(
      {
        brief,
        concept,
        copy: { structured: copyBlock.structured },
        visual: { structured: visualSpec.structured },
        product,
        brand,
        judge_notes: parsed.judge_notes,
      },
      trace,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/pipeline/critique] stage failed:', msg);
    return NextResponse.json(
      { error: `Critique stage failed: ${msg}`, trace },
      { status: 502 },
    );
  }

  // ── Persist critique ─────────────────────────────────────────────────────
  const { data: critiqueRow, error: critiqueInsertError } = await service
    .from('critiques')
    .insert({
      concept_id: concept.id,
      brief_id: brief.id,
      copy_block_id: copyBlock.id,
      visual_spec_id: visualSpec.id,
      verdict: critiqueOutput.structured.verdict,
      structured: {
        ...critiqueOutput.structured,
        _meta: {
          prompt_version: critiqueOutput.prompt_version,
          model: critiqueOutput.model,
        },
      },
      prompt_version: critiqueOutput.prompt_version,
      model: critiqueOutput.model,
    })
    .select()
    .single();

  if (critiqueInsertError || !critiqueRow) {
    console.error(
      '[api/pipeline/critique] DB insert failed:',
      critiqueInsertError?.message,
    );
    return NextResponse.json(
      {
        error: `Failed to persist critique: ${critiqueInsertError?.message}`,
        trace,
      },
      { status: 500 },
    );
  }

  // ── Maybe run ONE refine pass ────────────────────────────────────────────
  let refined:
    | {
        target: 'copy' | 'visual';
        copy_block?: unknown;
        visual_spec?: unknown;
      }
    | undefined;

  const shouldRefine =
    autoRefine &&
    critiqueOutput.structured.verdict === 'refine' &&
    critiqueOutput.structured.refine_targets.length > 0;

  if (shouldRefine) {
    // Take the FIRST target — V1 runs at most one refinement.
    const target = critiqueOutput.structured.refine_targets[0];

    if (target.stage === 'copy') {
      let refineOut;
      try {
        refineOut = await refineCopyStage.run(
          {
            brief,
            concept,
            product,
            brand,
            previous_copy: copyBlock.structured,
            instruction: target.instruction,
          },
          trace,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[api/pipeline/critique] refine copy failed:', msg);
        // Return the critique even if refine fails — the critique is valid.
        return NextResponse.json(
          {
            critique: critiqueRow,
            refined: null,
            refine_error: msg,
            trace,
          },
          { status: 200 },
        );
      }

      const { data: newCopy, error: newCopyErr } = await service
        .from('copy_blocks')
        .insert({
          concept_id: concept.id,
          brief_id: brief.id,
          structured: {
            ...refineOut.structured,
            _meta: {
              prompt_version: refineOut.prompt_version,
              model: refineOut.model,
              refined_from: copyBlock.id,
              refine_instruction: target.instruction,
            },
          },
          prompt_version: refineOut.prompt_version,
          model: refineOut.model,
        })
        .select()
        .single();

      if (newCopyErr || !newCopy) {
        console.error(
          '[api/pipeline/critique] refined copy insert failed:',
          newCopyErr?.message,
        );
        return NextResponse.json(
          {
            critique: critiqueRow,
            refined: null,
            refine_error: `Failed to persist refined copy: ${newCopyErr?.message}`,
            trace,
          },
          { status: 200 },
        );
      }

      refined = { target: 'copy', copy_block: newCopy };
    } else if (target.stage === 'visual') {
      const aspect = visualSpec.aspect_ratio as AspectRatio;

      let refineOut;
      try {
        refineOut = await refineVisualStage.run(
          {
            brief,
            concept,
            copy: { structured: copyBlock.structured },
            product,
            brand,
            previous_visual: visualSpec.structured,
            instruction: target.instruction,
            aspect_ratio: aspect,
          },
          trace,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[api/pipeline/critique] refine visual failed:', msg);
        return NextResponse.json(
          {
            critique: critiqueRow,
            refined: null,
            refine_error: msg,
            trace,
          },
          { status: 200 },
        );
      }

      const { data: newVisual, error: newVisualErr } = await service
        .from('visual_specs')
        .insert({
          concept_id: concept.id,
          brief_id: brief.id,
          copy_block_id: copyBlock.id,
          prompt_text: refineOut.prompt_text,
          aspect_ratio: refineOut.aspect_ratio,
          structured: {
            ...refineOut.structured,
            _meta: {
              prompt_version: refineOut.prompt_version,
              model: refineOut.model,
              refined_from: visualSpec.id,
              refine_instruction: target.instruction,
            },
          },
          prompt_version: refineOut.prompt_version,
          model: refineOut.model,
        })
        .select()
        .single();

      if (newVisualErr || !newVisual) {
        console.error(
          '[api/pipeline/critique] refined visual insert failed:',
          newVisualErr?.message,
        );
        return NextResponse.json(
          {
            critique: critiqueRow,
            refined: null,
            refine_error: `Failed to persist refined visual: ${newVisualErr?.message}`,
            trace,
          },
          { status: 200 },
        );
      }

      refined = { target: 'visual', visual_spec: newVisual };
    }
  }

  return NextResponse.json(
    {
      critique: critiqueRow,
      refined: refined ?? null,
      trace,
      _meta: {
        prompt_version: CRITIQUE_PROMPT_VERSION,
        model: critiqueOutput.model,
      },
    },
    { status: 201 },
  );
}
