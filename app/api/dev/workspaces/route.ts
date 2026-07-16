/**
 * /api/dev/workspaces — dev-only workspace management.
 *
 * GET  — list all workspaces with member counts.
 * POST — create a workspace { name, slug } and transactionally seed its
 *        brand_config row (getBrandConfigStrict must never miss).
 */
import { NextResponse } from 'next/server';
import { requireDev } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireDev();
  if (!ctx.ok) return ctx.response;

  const { data: workspaces, error } = await ctx.service
    .from('workspaces')
    .select('id, name, slug, created_at')
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Member counts (cheap: one grouped read).
  const { data: members } = await ctx.service.from('profiles').select('workspace_id');
  const counts = new Map<string, number>();
  for (const m of members ?? []) {
    if (m.workspace_id) counts.set(m.workspace_id, (counts.get(m.workspace_id) ?? 0) + 1);
  }

  return NextResponse.json(
    (workspaces ?? []).map((w) => ({ ...w, member_count: counts.get(w.id) ?? 0 })),
  );
}

export async function POST(request: Request) {
  const ctx = await requireDev();
  if (!ctx.ok) return ctx.response;

  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? '').trim();
  const slug = String(body.slug ?? '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if (!name || !slug) {
    return NextResponse.json({ error: 'name and slug are required' }, { status: 400 });
  }

  const { data: ws, error: wsErr } = await ctx.service
    .from('workspaces')
    .insert({ name, slug, created_by: ctx.user.id })
    .select('id, name, slug, created_at')
    .single();
  if (wsErr) {
    if ((wsErr as { code?: string }).code === '23505') {
      return NextResponse.json({ error: `Slug "${slug}" is already taken.` }, { status: 409 });
    }
    return NextResponse.json({ error: wsErr.message }, { status: 500 });
  }

  // Seed brand_config — roll back the workspace if this fails so we never
  // leave a workspace whose getBrandConfigStrict() would throw.
  const { error: bcErr } = await ctx.service
    .from('brand_config')
    .insert({ workspace_id: ws.id, name, default_strictness: 'loose', updated_by: ctx.user.id });
  if (bcErr) {
    await ctx.service.from('workspaces').delete().eq('id', ws.id);
    return NextResponse.json({ error: `brand_config seed failed: ${bcErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ ...ws, member_count: 0 }, { status: 201 });
}
