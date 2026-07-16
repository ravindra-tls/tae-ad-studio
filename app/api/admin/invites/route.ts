/**
 * /api/admin/invites  — workspace membership invites.
 *
 * An invite is a pre-authorized email row (no email is sent). At signup,
 * handle_new_user() matches by lower(email) and places the user in the
 * workspace. Inviting an email that ALREADY signed up (and is pending)
 * attaches them immediately here.
 *
 * GET  — list this workspace's invites (+ live/accepted/revoked state)
 * POST — create an invite { email, role: 'user'|'admin' }
 */
import { NextResponse } from 'next/server';
import { requireWorkspaceAdmin, isDevRole } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireWorkspaceAdmin();
  if (!ctx.ok) return ctx.response;

  const { data, error } = await ctx.service
    .from('workspace_invites')
    .select('id, email, role, created_at, accepted_at, revoked_at, invited_by')
    .eq('workspace_id', ctx.workspaceId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const ctx = await requireWorkspaceAdmin();
  if (!ctx.ok) return ctx.response;
  const { service, user, profile, workspaceId } = ctx;

  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? '').trim().toLowerCase();
  const role = body.role === 'admin' ? 'admin' : 'user'; // 'dev' is never invitable

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
  }

  // Does a profile already exist for this email?
  const { data: existing } = await service
    .from('profiles')
    .select('id, workspace_id, role')
    .eq('email', email)
    .maybeSingle();

  if (existing) {
    if (existing.workspace_id === workspaceId) {
      return NextResponse.json({ error: 'This person is already in your workspace.' }, { status: 409 });
    }
    if (existing.workspace_id && !isDevRole(profile.role)) {
      // Neutral message — don't leak which workspace they belong to.
      return NextResponse.json(
        { error: 'This email cannot be invited — contact a dev.' },
        { status: 409 },
      );
    }
    // Pending user (workspace_id null) → attach now. Dev force-moving a member
    // from another workspace also lands here.
    const { error: upErr } = await service
      .from('profiles')
      .update({ workspace_id: workspaceId, role })
      .eq('id', existing.id);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    // Record an already-accepted invite for the audit trail.
    await service.from('workspace_invites').insert({
      email, workspace_id: workspaceId, role, invited_by: user.id,
      accepted_at: new Date().toISOString(), accepted_user_id: existing.id,
    });
    return NextResponse.json({ attached: true, email, role }, { status: 200 });
  }

  // No profile yet → create a live invite. The partial unique index
  // (one live invite per email) is the backstop.
  const { data, error } = await service
    .from('workspace_invites')
    .insert({ email, workspace_id: workspaceId, role, invited_by: user.id })
    .select('id, email, role, created_at')
    .single();

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json(
        { error: 'This email already has a pending invite (possibly to another workspace).' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
