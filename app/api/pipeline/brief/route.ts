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
import type { PositioningResearch } from '@/lib/research/types';

export const maxDuration = 60;

const RequestBody = z.object({
  session_id: z.string().uuid(),
  objective: z.string().min(1).max(4000),
  strictness: z.enum(['off', 'loose', 'tight']).optional(),
  wild_card: z.boolean().optional(),
  source: z.enum(['quiz', 'freeform', 'imported']).optional(),
  funnel_stage: z.enum(['tofu', 'mofu', 'bofu']).optional(),
  persona_name: z.string().max(200).optional(),
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
  // RLS on the user-scoped client was returning null for legitimately-owned
  // sessions in Route Handler context (same issue the /prompts page worked
  // around). Enforce ownership explicitly with `user_id = user.id` on the
  // service client — the filter matches exactly what the RLS policy would
  // evaluate, just without the broken path.
  const service = await createServiceClient();
  const { data: session, error: sessionError } = await service
    .from('sessions')
    .select('id, user_id, product_id')
    .eq('id', parsed.session_id)
    .eq('user_id', user.id)
    .single();

  if (sessionError || !session) {
    return NextResponse.json(
      { error: 'Session not found or not accessible' },
      { status: 404 },
    );
  }

  // ── Fetch product + brand with service client ─────────────────────────────
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

  // ── Fetch positioning research (best match for this product) ──────────────
  // Queries for the most recent active research document that matches by
  // product name. Falls back gracefully to null — research is optional.
  const { data: researchRow } = await service
    .from('positioning_research')
    .select('research')
    .eq('product_name', product.name)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const research = (researchRow?.research as PositioningResearch) ?? null;

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
        research_context: research,
        funnel_stage: parsed.funnel_stage,
        persona_name: parsed.persona_name,
      },
      trace,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/pipeline/brief] stage failed:', msg);
    const friendlyError =
      msg.includes('usage limits') || msg.includes('rate_limit') || msg.includes('429')
        ? 'AI service usage limit reached. Please try again after your billing period resets.'
        : msg.includes('401') || msg.includes('authentication')
        ? 'AI service authentication error. Check the ANTHROPIC_API_KEY environment variable.'
        : msg.includes('overloaded') || msg.includes('529')
        ? 'AI service is temporarily overloaded. Please try again in a moment.'
        : 'Brief generation failed. Please try again.';
    return NextResponse.json(
      { error: friendlyError, trace },
      { status: 502 },
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
          funnel_stage: parsed.funnel_stage ?? null,
          persona_name: parsed.persona_name ?? null,
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
