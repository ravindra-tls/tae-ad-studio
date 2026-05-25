import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const service = await createServiceClient();
  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  return profile?.role === 'admin' ? service : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const service = await assertAdmin();
  if (!service) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

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
  const service = await assertAdmin();
  if (!service) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { error } = await service
    .from('prompt_templates')
    .delete()
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
