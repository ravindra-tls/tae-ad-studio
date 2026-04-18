/**
 * POST /api/pipeline/concept
 *
 * Pipeline stage 2. Given an approved brief, generates N (default 4)
 * candidate concepts with sameness detection, and persists them to the
 * `concepts` table. User picks 1-2 at checkpoint 2 in the UI.
 *
 * Request body:
 *   {
 *     brief_id: uuid,
 *     count?:   3 | 4 | 5   // default 4
 *   }
 *
 * Auth: user must own the brief (enforced via RLS on briefs → sessions).
 * Brand + product + brief write via service client once ownership is proven.
 *
 * Returns: { concepts: Concept[], trace: StageProgress[], sameness_retries, sameness_rounds }
 *
 * `sameness_rounds` is one entry per attempt, each carrying BOTH the Claude
 * verdict and the TF-IDF cosine verdict side by side. The UI can render them
 * so we can eyeball which method catches the right redundancy during dev.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getBrandConfig } from '@/lib/brand-config';
import { conceptStage } from '@/lib/pipeline/stages/concept';
import type { StageProgress } from '@/lib/pipeline/types';
import {
  CONCEPT_PROMPT_VERSION,
  SAMENESS_PROMPT_VERSION,
} from '@/lib/pipeline/prompts/concept';
import type { Brief, Product } from '@/types';

export const maxDuration = 120; // sameness retry + 2 Claude calls can push this

const RequestBody = z.object({
  brief_id: z.string().uuid(),
  count: z.number().int().min(3).max(5).optional(),
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

  // ── Ownership: read brief via RLS client. Policy requires the brief's
  //    session.user_id = auth.uid(), so a non-owner gets 404 here.
  const { data: briefRow, error: briefError } = await supabase
    .from('briefs')
    .select('*')
    .eq('id', parsed.brief_id)
    .single();

  if (briefError || !briefRow) {
    return NextResponse.json(
      { error: 'Brief not found or not accessible' },
      { status: 404 },
    );
  }

  // ── Fetch product + brand via service client ──────────────────────────────
  const service = await createServiceClient();
  const [{ data: product, error: productError }, brand] = await Promise.all([
    service.from('products').select('*').eq('id', briefRow.product_id).single(),
    getBrandConfig(),
  ]);

  if (productError || !product) {
    return NextResponse.json(
      { error: 'Product not found for brief' },
      { status: 404 },
    );
  }

  // ── Run the stage ─────────────────────────────────────────────────────────
  const trace: StageProgress[] = [];
  let stageOutput;
  try {
    stageOutput = await conceptStage.run(
      {
        count: parsed.count ?? 4,
        brief: briefRow as Brief,
        product: product as Product,
        brand,
      },
      trace,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/pipeline/concept] stage failed:', msg);
    return NextResponse.json(
      { error: `Concept stage failed: ${msg}`, trace },
      { status: 502 },
    );
  }

  // ── Persist each concept as its own row ──────────────────────────────────
  // We write once per concept so the UI can reference individual rows by id
  // when the user picks 1-2 at checkpoint 2.
  const rowsToInsert = stageOutput.concepts.map((c) => ({
    brief_id: briefRow.id,
    title: c.title,
    hook_archetype: c.hook_archetype,
    description: c.description,
    structured: {
      ...c,
      _meta: {
        prompt_version: stageOutput.prompt_version,
        sameness_prompt_version: SAMENESS_PROMPT_VERSION,
        model: stageOutput.model,
        sameness_retries: stageOutput.sameness_retries,
      },
    },
  }));

  const { data: insertedRows, error: insertError } = await service
    .from('concepts')
    .insert(rowsToInsert)
    .select();

  if (insertError || !insertedRows) {
    console.error(
      '[api/pipeline/concept] DB insert failed:',
      insertError?.message,
    );
    return NextResponse.json(
      {
        error: `Failed to persist concepts: ${insertError?.message}`,
        trace,
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      concepts: insertedRows,
      trace,
      sameness_retries: stageOutput.sameness_retries,
      sameness_rounds: stageOutput.sameness_rounds,
      _meta: {
        prompt_version: CONCEPT_PROMPT_VERSION,
        sameness_prompt_version: SAMENESS_PROMPT_VERSION,
        model: stageOutput.model,
      },
    },
    { status: 201 },
  );
}
