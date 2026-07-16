/**
 * DELETE /api/admin/invites/[id] — revoke a live invite.
 * Revoking frees the email so it can be invited elsewhere (the live-invite
 * unique index only counts non-revoked, non-accepted rows).
 */
import { NextResponse } from 'next/server';
import { requireWorkspaceAdmin } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const ctx = await requireWorkspaceAdmin();
  if (!ctx.ok) return ctx.response;

  // Only revoke invites in the caller's workspace, and only if still live.
  const { data, error } = await ctx.service
    .from('workspace_invites')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('workspace_id', ctx.workspaceId)
    .is('accepted_at', null)
    .is('revoked_at', null)
    .select('id')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Invite not found or no longer revocable' }, { status: 404 });
  return NextResponse.json({ revoked: true });
}
