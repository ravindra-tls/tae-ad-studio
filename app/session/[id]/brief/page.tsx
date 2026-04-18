/**
 * Brief-first session surface (gated by feature flag `brief_first_ui`).
 *
 * V1 Phase 1 shell. Flow:
 *   1. Marketer types a freeform objective + strictness + wild_card toggle.
 *   2. POST /api/pipeline/brief → structured brief card.
 *   3. Marketer approves → POST /api/pipeline/concept → concept gallery.
 *
 * Downstream stages (copy/visual/render) are Phase 2. The gallery here
 * just previews concepts — no generation yet.
 *
 * If the flag is OFF for this user, we redirect back to /session/[id]/prompts
 * so non-internal users never hit a half-built route.
 */

import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { isEnabled } from '@/lib/feature-flags';
import { BriefWorkspace } from './brief-workspace';
import type { Brief, Concept, Session } from '@/types';

export default async function BriefPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // ── Flag gate ────────────────────────────────────────────────────────────
  // Fallback: if the flag is off, users land on the existing template flow.
  const flagOn = await isEnabled('brief_first_ui', user.id);
  if (!flagOn) {
    redirect(`/session/${params.id}/prompts`);
  }

  // ── Fetch session (RLS enforces ownership) ───────────────────────────────
  const { data: sessionRow } = await supabase
    .from('sessions')
    .select('*, product:products(*)')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (!sessionRow) redirect('/dashboard');
  const session = sessionRow as Session & { product: Session['product'] };

  // ── Fetch the most recent brief for this session, if any ─────────────────
  // On a page refresh we want to resume where the user left off rather than
  // starting over. A newer brief supersedes older ones (V1 treats each brief
  // as a draft iteration).
  const service = await createServiceClient();
  const { data: briefRows } = await service
    .from('briefs')
    .select('*')
    .eq('session_id', session.id)
    .order('created_at', { ascending: false })
    .limit(1);

  const latestBrief = (briefRows?.[0] as Brief | undefined) ?? null;

  // ── If we have a brief, also fetch concepts for it (if any) ──────────────
  let concepts: Concept[] = [];
  if (latestBrief) {
    const { data: conceptRows } = await service
      .from('concepts')
      .select('*')
      .eq('brief_id', latestBrief.id)
      .order('created_at', { ascending: true });
    concepts = (conceptRows as Concept[]) ?? [];
  }

  return (
    <BriefWorkspace
      session={session}
      initialBrief={latestBrief}
      initialConcepts={concepts}
    />
  );
}
