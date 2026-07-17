import type { createServiceClient } from '@/lib/supabase/server';

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

const DAY_MS = 24 * 3600 * 1000;

/**
 * What pruneEmptySessions already had to read — returned so callers (the
 * dashboard) don't pay extra round-trips re-querying the same tables.
 */
export interface PruneResult {
  /**
   * The user's surviving (non-pruned) session rows, ordered created_at desc,
   * selected as `*, product:products(name, brand, sub_brand, thumbnail_url)`.
   * Includes archived and is_test rows — filter at the call site as needed.
   */
  sessions: any[];
  /** Completed generated_images (session_id, status) rows across the user's sessions. */
  images: Array<{ session_id: string; status: string }>;
}

/**
 * Deletes a user's dead sessions. Shared by the dashboard page and the
 * sessions API route so the rules can never drift between the two.
 *
 * Rules:
 * - Archived sessions are never pruned.
 * - Non-forge sessions with zero completed images are pruned (original behavior).
 * - Forge sessions hold live working state (board/chat/champions) long before
 *   any image exists, so they are exempt unless:
 *     - never actually used (state rev <= 1) and older than 24h, or
 *     - no completed images, no finalized concepts, and idle for 14+ days.
 *   Sessions with finalized concepts are always kept (paid model output).
 *
 * Returns the data it read (see PruneResult) so callers can reuse it instead
 * of re-querying sessions/generated_images after the prune.
 */
export async function pruneEmptySessions(serviceClient: ServiceClient, userId: string): Promise<PruneResult> {
  // The two initial reads are independent — one parallel stage instead of two
  // (the images read scopes by the session join rather than an id in-list).
  const [{ data: allSessions }, { data: populatedRaw }] = await Promise.all([
    serviceClient
      .from('sessions')
      .select('*, product:products(name, brand, sub_brand, thumbnail_url)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    serviceClient
      .from('generated_images')
      .select('session_id, status, session:sessions!inner(user_id)')
      .eq('session.user_id', userId)
      .eq('status', 'completed'),
  ]);

  const populated: Array<{ session_id: string; status: string }> =
    (populatedRaw ?? []).map((r: any) => ({ session_id: r.session_id, status: r.status }));

  if (!allSessions?.length) return { sessions: [], images: populated };

  const active = allSessions.filter((s: any) => s.status !== 'archived');
  if (!active.length) return { sessions: allSessions, images: populated };

  const idsWithImages = new Set(populated.map((r) => r.session_id));

  const emptyNonForge = active
    .filter((s: any) => s.source !== 'forge' && !idsWithImages.has(s.id))
    .map((s: any) => s.id);

  const forgeCandidates = active.filter((s: any) => s.source === 'forge' && !idsWithImages.has(s.id));
  let staleForge: string[] = [];
  if (forgeCandidates.length) {
    const forgeIds = forgeCandidates.map((s: any) => s.id);
    const [{ data: states }, { data: champs }] = await Promise.all([
      serviceClient.from('forge_states').select('session_id, rev, updated_at').in('session_id', forgeIds),
      serviceClient.from('forge_concepts').select('session_id').in('session_id', forgeIds),
    ]);
    const stateById = new Map((states ?? []).map((r) => [r.session_id, r]));
    const hasConcepts = new Set((champs ?? []).map((r) => r.session_id));
    const now = Date.now();
    staleForge = forgeCandidates
      .filter((s: any) => {
        if (hasConcepts.has(s.id)) return false;
        const st = stateById.get(s.id);
        const ageMs = now - Date.parse(s.created_at);
        if ((st?.rev ?? 0) <= 1) return ageMs > DAY_MS;
        const idleMs = st?.updated_at ? now - Date.parse(st.updated_at) : ageMs;
        return idleMs > 14 * DAY_MS;
      })
      .map((s: any) => s.id);
  }

  const emptyIds = [...emptyNonForge, ...staleForge];
  let prunedIds = new Set(emptyIds);
  if (emptyIds.length > 0) {
    const { error } = await serviceClient.from('sessions').delete().in('id', emptyIds);
    if (error) {
      console.error('[pruneEmptySessions] delete error:', error.message);
      prunedIds = new Set(); // delete failed — the rows still exist
    }
  }

  return {
    sessions: allSessions.filter((s: any) => !prunedIds.has(s.id)),
    images: populated,
  };
}
