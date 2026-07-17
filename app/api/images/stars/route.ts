/**
 * GET /api/images/stars — the caller's starred image ids, newest star first.
 *
 * Lightweight id-only feed for the useStarred hook; full image data comes from
 * /api/gallery?starred=1. Stars cascade-delete with their image, so this list
 * never contains dangling ids.
 */
import { NextResponse } from 'next/server';
import { requireMember } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireMember();
  if (!ctx.ok) return ctx.response;
  const { user, service } = ctx;

  const { data, error } = await service
    .from('image_stars')
    .select('image_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ids: (data ?? []).map((r: { image_id: string }) => r.image_id),
  });
}
