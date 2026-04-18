/**
 * PATCH /api/pipeline/concept/[id]/select
 *
 * Toggles whether a concept is "selected" for downstream generation
 * (copy → visual → render). This is checkpoint 2 in the brief-first flow —
 * marketers pick 1-2 concepts to advance.
 *
 * Request body:
 *   { selected: boolean }
 *
 * Enforced constraints:
 *   - Auth: user must own the concept via concepts → briefs → sessions chain
 *     (RLS returns 404 for non-owners).
 *   - Max 2 concepts selected per brief at any time. 3rd selection → 409.
 *     Rationale: downstream stages fan out per concept; 2 is the V1 soft cap
 *     on cost / wait time. Loosen later if product wants wider exploration.
 *   - No-op if `selected` matches current state (returns 200 with the row).
 *
 * Returns: { concept: Concept }  (freshly read row, including selected_at)
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import type { Concept } from '@/types';

const MAX_SELECTIONS_PER_BRIEF = 2;

const RequestBody = z.object({
  selected: z.boolean(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  // ── Auth ─────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Validate body ────────────────────────────────────────────────────────
  let body: z.infer<typeof RequestBody>;
  try {
    body = RequestBody.parse(await request.json());
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid request body';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // ── Ownership: read concept via RLS client. 404 if not accessible. ───────
  const { data: conceptRow, error: readError } = await supabase
    .from('concepts')
    .select('*')
    .eq('id', params.id)
    .single();

  if (readError || !conceptRow) {
    return NextResponse.json(
      { error: 'Concept not found or not accessible' },
      { status: 404 },
    );
  }

  const concept = conceptRow as Concept;
  const isCurrentlySelected = concept.selected_at !== null;

  // No-op if state matches intent
  if (isCurrentlySelected === body.selected) {
    return NextResponse.json({ concept });
  }

  // ── Enforce max selections when selecting ────────────────────────────────
  if (body.selected) {
    // Count via RLS client so we naturally scope to concepts the user can see
    // under the same brief.
    const { count, error: countError } = await supabase
      .from('concepts')
      .select('id', { count: 'exact', head: true })
      .eq('brief_id', concept.brief_id)
      .not('selected_at', 'is', null);

    if (countError) {
      return NextResponse.json(
        { error: `Failed to validate selection: ${countError.message}` },
        { status: 500 },
      );
    }
    if ((count ?? 0) >= MAX_SELECTIONS_PER_BRIEF) {
      return NextResponse.json(
        {
          error: `At most ${MAX_SELECTIONS_PER_BRIEF} concepts can be selected per brief. Deselect one first.`,
        },
        { status: 409 },
      );
    }
  }

  // ── Write via service client ─────────────────────────────────────────────
  const service = await createServiceClient();
  const { data: updated, error: updateError } = await service
    .from('concepts')
    .update({ selected_at: body.selected ? new Date().toISOString() : null })
    .eq('id', params.id)
    .select()
    .single();

  if (updateError || !updated) {
    return NextResponse.json(
      { error: `Failed to update concept: ${updateError?.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ concept: updated as Concept });
}
