import { requireMember } from '@/lib/auth/guards';
import { NextResponse } from 'next/server';

export async function GET() {
  const ctx = await requireMember();
  if (!ctx.ok) return ctx.response;

  // Union catalog: universal templates (workspace_id NULL) + this workspace's
  // own, active only. `*` keeps the response shape and includes workspace_id
  // so the client can badge scope.
  const { data, error } = await ctx.service
    .from('prompt_templates')
    .select('*')
    .or(`workspace_id.is.null,workspace_id.eq.${ctx.workspaceId}`)
    .eq('is_active', true)
    .order('number');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
