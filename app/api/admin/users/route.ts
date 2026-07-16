import { requireAdmin, isDevRole } from '@/lib/auth/guards';
import { NextResponse } from 'next/server';

export async function GET() {
  const ctx = await requireAdmin();
  if (!ctx.ok) return ctx.response;

  // Devs see every profile globally; workspace admins only their own workspace.
  const base = ctx.service.from('profiles').select('*');
  const scoped = isDevRole(ctx.profile.role)
    ? base
    : base.eq('workspace_id', ctx.workspaceId);

  const { data, error } = await scoped.order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
