/**
 * PATCH/DELETE /api/admin/templates/[id] — workspace-scoped template management.
 *
 * PATCH:  admins may edit only their OWN workspace's templates (universal and
 *         other-workspace rows 404 — existence-hiding); devs may edit anything.
 * DELETE: admin → SOFT ARCHIVE (is_active=false) of their own workspace's
 *         templates only → { archived: true }; dev → hard DELETE on anything
 *         → { deleted: true }.
 * Both paths invalidate the template cache after a successful write.
 */
import { requireAdmin, isDevRole } from '@/lib/auth/guards';
import { invalidateTemplateCache } from '@/lib/templates/compat';
import { NextResponse } from 'next/server';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await requireAdmin();
  if (!ctx.ok) return ctx.response;
  const service = ctx.service;

  // Load first: 404 if missing, 404 if out of scope (existence-hiding).
  const { data: existing } = await service
    .from('prompt_templates')
    .select('id, workspace_id, version')
    .eq('id', params.id)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const dev = isDevRole(ctx.profile.role);
  const ownWorkspaceRow =
    existing.workspace_id !== null && existing.workspace_id === ctx.workspaceId;
  if (!dev && !ownWorkspaceRow) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json();
  const { name, category, template, default_aspect_ratio } = body;

  if (!name || !category || !template || !default_aspect_ratio) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Increment version on every save so changes are traceable
  const { data, error } = await service
    .from('prompt_templates')
    .update({
      name:                 name.trim(),
      category:             category.trim(),
      template:             template.trim(),
      default_aspect_ratio: default_aspect_ratio,
      version:              ((existing.version as number | null) ?? 1) + 1,
    })
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  invalidateTemplateCache();
  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await requireAdmin();
  if (!ctx.ok) return ctx.response;
  const service = ctx.service;

  const { data: existing } = await service
    .from('prompt_templates')
    .select('id, workspace_id')
    .eq('id', params.id)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Dev: hard delete, any template.
  if (isDevRole(ctx.profile.role)) {
    const { error } = await service
      .from('prompt_templates')
      .delete()
      .eq('id', params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    invalidateTemplateCache();
    return NextResponse.json({ deleted: true });
  }

  // Admin: soft archive, own workspace's templates only (404 otherwise).
  const ownWorkspaceRow =
    existing.workspace_id !== null && existing.workspace_id === ctx.workspaceId;
  if (!ownWorkspaceRow) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { error } = await service
    .from('prompt_templates')
    .update({ is_active: false })
    .eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  invalidateTemplateCache();
  return NextResponse.json({ archived: true });
}
