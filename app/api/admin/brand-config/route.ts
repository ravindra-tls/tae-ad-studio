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

/**
 * PATCH /api/admin/brand-config
 *
 * Updates the singleton brand config (id = 1). All body fields optional —
 * only provided fields are written.
 *
 * Body shape:
 *   { name?: string,
 *     default_strictness?: 'off' | 'loose' | 'tight',
 *     non_negotiables?: string[],
 *     voice?: Record<string, unknown>,
 *     visual?: Record<string, unknown> }
 */
export async function PATCH(request: Request) {
  const ctx = await requireAdmin();
  if ('error' in ctx) return ctx.error;

  const body = await request.json();
  const patch: Record<string, unknown> = { updated_by: ctx.user.id };

  if (typeof body.name === 'string') {
    const n = body.name.trim();
    if (!n) return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 });
    patch.name = n;
  }

  if (body.default_strictness !== undefined) {
    if (!['off', 'loose', 'tight'].includes(body.default_strictness)) {
      return NextResponse.json(
        { error: 'default_strictness must be one of: off, loose, tight' },
        { status: 400 },
      );
    }
    patch.default_strictness = body.default_strictness;
  }

  if (body.non_negotiables !== undefined) {
    if (!Array.isArray(body.non_negotiables) || !body.non_negotiables.every((s: unknown) => typeof s === 'string')) {
      return NextResponse.json(
        { error: 'non_negotiables must be an array of strings' },
        { status: 400 },
      );
    }
    // Drop empties, trim, keep order, dedupe.
    const cleaned = Array.from(
      new Set(
        (body.non_negotiables as string[])
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    );
    patch.non_negotiables = cleaned;
  }

  for (const key of ['voice', 'visual'] as const) {
    if (body[key] !== undefined) {
      if (typeof body[key] !== 'object' || body[key] === null || Array.isArray(body[key])) {
        return NextResponse.json(
          { error: `${key} must be a JSON object` },
          { status: 400 },
        );
      }
      patch[key] = body[key];
    }
  }

  patch.updated_at = new Date().toISOString();

  const { data, error } = await ctx.service
    .from('brand_config')
    .update(patch)
    .eq('id', 1)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
