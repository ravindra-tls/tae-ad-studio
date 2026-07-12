import type { createServiceClient } from '@/lib/supabase/server';

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

const DAY_MS = 24 * 3600 * 1000;

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
 */
export async function pruneEmptySessions(serviceClient: ServiceClient, userId: string) {
  const { data: allSessions } = await serviceClient
    .from('sessions')
    .select('id, source, status, created_at')
    .eq('user_id', userId);

  if (!allSessions?.length) return;

  const active = allSessions.filter((s) => s.status !== 'archived');
  if (!active.length) return;

  const { data: populated } = await serviceClient
    .from('generated_images')
    .select('session_id')
    .eq('status', 'completed')
    .in('session_id', active.map((s) => s.id));

  const idsWithImages = new Set((populated ?? []).map((r) => r.session_id));

  const emptyNonForge = active
    .filter((s) => s.source !== 'forge' && !idsWithImages.has(s.id))
    .map((s) => s.id);

  const forgeCandidates = active.filter((s) => s.source === 'forge' && !idsWithImages.has(s.id));
  let staleForge: string[] = [];
  if (forgeCandidates.length) {
    const forgeIds = forgeCandidates.map((s) => s.id);
    const [{ data: states }, { data: champs }] = await Promise.all([
      serviceClient.from('forge_states').select('session_id, rev, updated_at').in('session_id', forgeIds),
      serviceClient.from('forge_concepts').select('session_id').in('session_id', forgeIds),
    ]);
    const stateById = new Map((states ?? []).map((r) => [r.session_id, r]));
    const hasConcepts = new Set((champs ?? []).map((r) => r.session_id));
    const now = Date.now();
    staleForge = forgeCandidates
      .filter((s) => {
        if (hasConcepts.has(s.id)) return false;
        const st = stateById.get(s.id);
        const ageMs = now - Date.parse(s.created_at);
        if ((st?.rev ?? 0) <= 1) return ageMs > DAY_MS;
        const idleMs = st?.updated_at ? now - Date.parse(st.updated_at) : ageMs;
        return idleMs > 14 * DAY_MS;
      })
      .map((s) => s.id);
  }

  const emptyIds = [...emptyNonForge, ...staleForge];
  if (emptyIds.length > 0) {
    const { error } = await serviceClient.from('sessions').delete().in('id', emptyIds);
    if (error) console.error('[pruneEmptySessions] delete error:', error.message);
  }
}
