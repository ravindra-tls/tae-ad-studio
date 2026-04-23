/**
 * PATCH /api/pipeline/concept/[id]/select
 *
 * Toggles whether a concept is "selected" for downstream generation
 * (copy → visual → render). This is checkpoint 2 in the brief-first flow.
 *
 * Request body:
 *   { selected: boolean }
 *
 * Enforced constraints:
 *   - Auth: user must own the concept via concepts → briefs → sessions chain
 *     (RLS returns 404 for non-owners).
 *   - No cap on number of selected concepts per brief (product decision —
 *     marketers want to explore wider; downstream fan-out cost accepted).
 *   - No-op if `selected` matches current state (returns 200 with the row).
 *
 * Returns: { concept: Concept }  (freshly read row, including selected_at)
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import type { Concept } from '@/types';

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

  // ── Ownership: concept + chain to session via service client ────────────
  const service = await createServiceClient();
  const { data: conceptRow, error: readError } = await service
    .from('concepts')
    .select('*, brief:briefs!inner(session:sessions!inner(user_id))')
    .eq('id', params.id)
    .single();

  if (
    readError ||
    !conceptRow ||
    (conceptRow as unknown as { brief: { session: { user_id: string } } }).brief.session.user_id !== user.id
  ) {
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

  // ── Write via service client (already created above) ─────────────────────
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
