/**
 * POST /api/dev/templates/[id]/promote — dev-only: promote a workspace-local
 * template to the universal catalog (workspace_id → NULL + provenance stamp).
 */
import { NextResponse } from 'next/server';
import { requireDev } from '@/lib/auth/guards';
import { invalidateTemplateCache } from '@/lib/templates/compat';

export const dynamic = 'force-dynamic';

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const ctx = await requireDev();
  if (!ctx.ok) return ctx.response;

  const { data, error } = await ctx.service
    .from('prompt_templates')
    .update({
      workspace_id: null,
      promoted_at: new Date().toISOString(),
      promoted_by: ctx.user.id,
    })
    .eq('id', params.id)
    .not('workspace_id', 'is', null) // only workspace-local rows are promotable
    .select('id, number, name')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Template not found or already universal' }, { status: 404 });

  invalidateTemplateCache();
  return NextResponse.json({ promoted: true, template: data });
}
