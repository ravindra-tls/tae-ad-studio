import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/feature-flags/[name]
 *
 * Body (any subset):
 *   { enabled?: boolean,
 *     rollout_percentage?: number (0-100),
 *     description?: string | null,
 *     add_user_email?: string,     // resolves email → user_id, appends to allowed_user_ids
 *     remove_user_id?: string }    // removes uuid from allowed_user_ids
 *
 * Mutually exclusive: `add_user_email` and `remove_user_id` should not be sent together.
 * We handle the allowlist mutations server-side so admins don't need to know uuids.
 */
export async function PATCH(
  request: Request,
  { params }: { params: { name: string } },
) {
  const ctx = await requireAdmin();
  if (!ctx.ok) return ctx.response;

  const body = await request.json();

  // Fetch existing flag — needed for allowlist mutation and to confirm existence.
  const { data: existing, error: fetchErr } = await ctx.service
    .from('feature_flags')
    .select('*')
    .eq('name', params.name)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: 'Flag not found' }, { status: 404 });

  const patch: Record<string, any> = { updated_by: ctx.user.id };

  if (typeof body.enabled === 'boolean') {
    patch.enabled = body.enabled;
  }

  if (typeof body.rollout_percentage === 'number') {
    const n = Math.round(body.rollout_percentage);
    if (n < 0 || n > 100) {
      return NextResponse.json(
        { error: 'rollout_percentage must be between 0 and 100' },
        { status: 400 },
      );
    }
    patch.rollout_percentage = n;
  }

  if (body.description !== undefined) {
    patch.description = body.description;
  }

  // Allowlist mutation via email lookup — resolve email to profile id server-side.
  if (typeof body.add_user_email === 'string' && body.add_user_email.trim()) {
    const email = body.add_user_email.trim().toLowerCase();
    const { data: profile, error: lookupErr } = await ctx.service
      .from('profiles')
      .select('id, email')
      .ilike('email', email)
      .maybeSingle();

    if (lookupErr) return NextResponse.json({ error: lookupErr.message }, { status: 500 });
    if (!profile) {
      return NextResponse.json(
        { error: `No user found with email "${email}"` },
        { status: 404 },
      );
    }

    const current: string[] = existing.allowed_user_ids ?? [];
    if (!current.includes(profile.id)) {
      patch.allowed_user_ids = [...current, profile.id];
    }
  }

  if (typeof body.remove_user_id === 'string' && body.remove_user_id) {
    const current: string[] = existing.allowed_user_ids ?? [];
    patch.allowed_user_ids = current.filter((id) => id !== body.remove_user_id);
  }

  const { data, error } = await ctx.service
    .from('feature_flags')
    .update(patch)
    .eq('name', params.name)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** DELETE /api/admin/feature-flags/[name] — permanently remove a flag. */
export async function DELETE(
  _request: Request,
  { params }: { params: { name: string } },
) {
  const ctx = await requireAdmin();
  if (!ctx.ok) return ctx.response;

  const { error } = await ctx.service
    .from('feature_flags')
    .delete()
    .eq('name', params.name);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
