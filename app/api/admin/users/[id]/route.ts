import { requireAdmin, isDevRole } from '@/lib/auth/guards';
import { NextResponse } from 'next/server';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const ctx = await requireAdmin();
  if (!ctx.ok) return ctx.response;

  const updates = await request.json();

  // Load the target so a workspace admin is confined to their own workspace and
  // can't escalate a user to dev or move them to another workspace.
  const { data: target } = await ctx.service
    .from('profiles')
    .select('id, workspace_id')
    .eq('id', params.id)
    .maybeSingle();

  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  if (!isDevRole(ctx.profile.role)) {
    // Existence-hiding: a target outside the admin's workspace reads as absent.
    if (target.workspace_id !== ctx.workspaceId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    // Privilege-escalation attempts are role failures → 403.
    if (updates.role === 'dev') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (updates.workspace_id !== undefined && updates.workspace_id !== target.workspace_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const allowedFields = ['role', 'usage_cap', 'usage_count'];
  const sanitized: Record<string, any> = {};
  for (const key of allowedFields) {
    if (updates[key] !== undefined) sanitized[key] = updates[key];
  }

  const { data, error } = await ctx.service
    .from('profiles')
    .update(sanitized)
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
