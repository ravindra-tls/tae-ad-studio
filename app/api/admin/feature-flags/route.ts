import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

/** GET /api/admin/feature-flags — list every flag. */
export async function GET() {
  const ctx = await requireAdmin();
  if (!ctx.ok) return ctx.response;

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
  if (!ctx.ok) return ctx.response;

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
