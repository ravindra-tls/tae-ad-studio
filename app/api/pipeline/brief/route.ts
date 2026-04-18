/**
 * POST /api/pipeline/brief
 *
 * Pipeline stage 1. Takes a marketer's freeform objective + session context,
 * runs the brief stage, and persists a `briefs` row. The returned row drives
 * checkpoint 1 in the UI — the marketer edits/approves before stage 2
 * (concept) runs.
 *
 * Request body:
 *   {
 *     session_id: uuid,
 *     objective:  string,
 *     strictness: 'off' | 'loose' | 'tight' | undefined   // default from brand_config, fallback 'loose'
 *     wild_card:  boolean | undefined                     // default false
 *     source:     'quiz' | 'freeform' | 'imported' | undefined  // default 'freeform'
 *   }
 *
 * Auth: user must own the session. We read the session via the RLS client
 * first (which doubles as ownership enforcement), then switch to the service
 * client for brand/product/brief writes to keep the data path consistent with
 * the rest of the app.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getBrandConfig } from '@/lib/brand-config';
import { briefStage } from '@/lib/pipeline/stages/brief';
import type { StageProgress } from '@/lib/pipeline/types';
import type { Product } from '@/types';

export const maxDuration = 60;

const RequestBody = z.object({
  session_id: z.string().uuid(),
  objective: z.string().min(1).max(4000),
  strictness: z.enum(['off', 'loose', 'tight']).optional(),
  wild_card: z.boolean().optional(),
  source: z.enum(['quiz', 'freeform', 'imported']).optional(),
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

  // ── Parse + validate body ─────────────────────────────────────────────────
  let parsed: z.infer<typeof RequestBody>;
  try {
    const json = await request.json();
    parsed = RequestBody.parse(json);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid request body';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // ── Ownership check: the session must belong to this user ─────────────────
  // Using the RLS-aware client forces auth.uid() = user.id on the sessions
  // policy, so a user cannot produce a brief on someone else's session.
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id, user_id, product_id')
    .eq('id', parsed.session_id)
    .single();

  if (sessionError || !session) {
    return NextResponse.json(
      { error: 'Session not found or not accessible' },
      { status: 404 },
    );
  }

  // ── Fetch product + brand with service client ─────────────────────────────
  const service = await createServiceClient();

  const [{ data: product, error: productError }, brand] = await Promise.all([
    service.from('products').select('*').eq('id', session.product_id).single(),
    getBrandConfig(),
  ]);

  if (productError || !product) {
    return NextResponse.json(
      { error: 'Product not found for session' },
      { status: 404 },
    );
  }

  // ── Resolve strictness default: body > brand_config > 'loose' ─────────────
  const strictness =
    parsed.strictness ?? brand?.default_strictness ?? 'loose';

  // ── Run the stage ─────────────────────────────────────────────────────────
  const trace: StageProgress[] = [];
  let stageOutput;
  try {
    stageOutput = await briefStage.run(
      {
        objective: parsed.objective,
        strictness,
        wild_card: parsed.wild_card ?? false,
        source: parsed.source ?? 'freeform',
        brand,
        product: product as Product,
      },
      trace,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/pipeline/brief] stage failed:', msg);
    return NextResponse.json(
      { error: `Brief stage failed: ${msg}`, trace },
      { status: 502 }, // upstream (Claude) failed
    );
  }

  // ── Persist ───────────────────────────────────────────────────────────────
  // Denormalize audience / offer / hypothesis onto their own columns for
  // easy querying; keep the full structured payload in `structured`.
  const { data: briefRow, error: insertError } = await service
    .from('briefs')
    .insert({
      session_id: session.id,
      product_id: session.product_id,
      objective: parsed.objective,
      audience: stageOutput.structured.audience,
      offer: stageOutput.structured.offer,
      hypothesis: stageOutput.structured.hypothesis,
      structured: {
        ...stageOutput.structured,
        _meta: {
          prompt_version: stageOutput.prompt_version,
          model: stageOutput.model,
        },
      },
      source: parsed.source ?? 'freeform',
      strictness,
      wild_card: parsed.wild_card ?? false,
    })
    .select()
    .single();

  if (insertError || !briefRow) {
    console.error(
      '[api/pipeline/brief] DB insert failed:',
      insertError?.message,
    );
    return NextResponse.json(
      { error: `Failed to persist brief: ${insertError?.message}`, trace },
      { status: 500 },
    );
  }

  return NextResponse.json({ brief: briefRow, trace }, { status: 201 });
}
