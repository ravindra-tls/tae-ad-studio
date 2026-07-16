/**
 * POST /api/dev/acting-workspace — dev picks the workspace they act within.
 * Sets the acting_workspace cookie that resolveActingWorkspace() reads.
 * Body: { workspaceId: string | null }  (null clears it).
 */
import { NextResponse } from 'next/server';
import { requireDev, ACTING_WORKSPACE_COOKIE } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const ctx = await requireDev();
  if (!ctx.ok) return ctx.response;

  const body = await request.json().catch(() => ({}));
  const workspaceId: string | null = body.workspaceId ?? null;

  if (workspaceId) {
    // Validate the workspace exists before committing a dev to it.
    const { data: ws } = await ctx.service
      .from('workspaces').select('id').eq('id', workspaceId).maybeSingle();
    if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  const res = NextResponse.json({ actingWorkspace: workspaceId });
  if (workspaceId) {
    res.cookies.set(ACTING_WORKSPACE_COOKIE, workspaceId, {
      httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30,
    });
  } else {
    res.cookies.delete(ACTING_WORKSPACE_COOKIE);
  }
  return res;
}
