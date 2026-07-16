import { requireAdmin } from '@/lib/auth/guards';
import { NextResponse } from 'next/server';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await requireAdmin();
  if (!ctx.ok) return ctx.response;
  const service = ctx.service;

  const body = await request.json();
  const { name, category, template, default_aspect_ratio } = body;

  if (!name || !category || !template || !default_aspect_ratio) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Increment version on every save so changes are traceable
  const { data: existing } = await service
    .from('prompt_templates')
    .select('version')
    .eq('id', params.id)
    .single();

  const { data, error } = await service
    .from('prompt_templates')
    .update({
      name:                 name.trim(),
      category:             category.trim(),
      template:             template.trim(),
      default_aspect_ratio: default_aspect_ratio,
      version:              (existing?.version ?? 1) + 1,
    })
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await requireAdmin();
  if (!ctx.ok) return ctx.response;
  const service = ctx.service;

  const { error } = await service
    .from('prompt_templates')
    .delete()
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
