import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Role } from '@/lib/auth/guards';

/**
 * Sidebar badge counts, keyed by role:
 *   admin (non-dev) → pendingProposals: pending template proposals in their workspace
 *   dev             → pendingFeedback: pending general feedback (global dev inbox)
 * Both are cheap head-only counts backed by the partial indexes from 023.
 */
export interface BadgeCounts {
  pendingProposals?: number;
  pendingFeedback?: number;
}

/**
 * Compute the sidebar badge counts for a role. Plain members get {} (no
 * queries fired). Errors degrade to a hidden badge rather than failing the
 * page render.
 */
export async function getBadgeCounts(
  service: SupabaseClient,
  role: Role | null | undefined,
  workspaceId: string | null | undefined,
): Promise<BadgeCounts> {
  try {
    if (role === 'dev') {
      const { count } = await service
        .from('feedback_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('kind', 'feedback')
        .eq('status', 'pending');
      return { pendingFeedback: count ?? 0 };
    }

    if (role === 'admin' && workspaceId) {
      const { count } = await service
        .from('feedback_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('kind', 'template_proposal')
        .eq('status', 'pending')
        .eq('workspace_id', workspaceId);
      return { pendingProposals: count ?? 0 };
    }
  } catch {
    // Badge is decorative — never block the shell on it.
  }
  return {};
}

export async function getProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const serviceClient = await createServiceClient();
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('id, full_name, email, role, workspace_id')
    .eq('id', user.id)
    .single();

  if (!profile) return profile;

  const badgeCounts = await getBadgeCounts(
    serviceClient,
    profile.role as Role,
    profile.workspace_id as string | null,
  );

  return { ...profile, badgeCounts };
}
