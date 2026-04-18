import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const service = await createServiceClient();
  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user, service };
}

/** GET /api/admin/feature-flags — list every flag. */
export async function GET() {
  const ctx = await requireAdmin();
  if ('error' in ctx) return ctx.error;

  const { data, error } = await ctx.service
    .from('feature_flags')
    .select('*')
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** POST /api/admin/feature-flags — create a new flag. Body: { name, description? }. */
export async function POST(request: Request) {
  const ctx = await requireAdmin();
  if ('error' in ctx) return ctx.error;

  const { name, description } = await request.json();
  if (!name || typeof name !== 'string' || !/^[a-z0-9_]+$/.test(name)) {
    return NextResponse.json(
      { error: 'Flag name must be lowercase snake_case (letters, digits, underscore).' },
      { status: 400 },
    );
  }

  const { data, error } = await ctx.service
    .from('feature_flags')
    .insert({
      name,
      description: description ?? null,
      enabled: false,
      allowed_user_ids: [],
      rollout_percentage: 0,
      updated_by: ctx.user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
