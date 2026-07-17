/**
 * POST   /api/images/[id]/star — star an image (idempotent upsert).
 * DELETE /api/images/[id]/star — remove the caller's star.
 *
 * Stars are personal bookmarks (image_stars, PK image_id+user_id). The POST
 * verifies the image exists inside the caller's workspace (404 otherwise —
 * existence-hiding, per guards.ts conventions) before writing; DELETE only
 * ever touches the caller's own row so no ownership lookup is needed.
 */
import { NextResponse } from 'next/server';
import { requireMember } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await requireMember();
  if (!ctx.ok) return ctx.response;
  const { user, service, workspaceId } = ctx;

  // The image must exist AND belong to the caller's workspace.
  const { data: image } = await service
    .from('generated_images')
    .select('id')
    .eq('id', params.id)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (!image) {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 });
  }

  const { error } = await service
    .from('image_stars')
    .upsert(
      { image_id: params.id, user_id: user.id },
      { onConflict: 'image_id,user_id' },
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await requireMember();
  if (!ctx.ok) return ctx.response;
  const { user, service } = ctx;

  const { error } = await service
    .from('image_stars')
    .delete()
    .eq('image_id', params.id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
