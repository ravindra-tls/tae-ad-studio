/**
 * POST /api/images/stars/import — one-time localStorage → DB star migration.
 *
 * Body: { ids: string[] } (capped at 500 per request). Ids are validated
 * against generated_images WITHIN the caller's workspace; anything unknown,
 * malformed, or outside the workspace is skipped (the old localStorage keys
 * accumulated ids across schema eras, so garbage in is expected).
 *
 * Returns { imported, skipped }. Idempotent — the upsert makes re-imports
 * harmless, and the client only clears its localStorage keys on a 2xx.
 */
import { NextResponse } from 'next/server';
import { requireMember } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

const MAX_IDS = 500;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const ctx = await requireMember();
  if (!ctx.ok) return ctx.response;
  const { user, service, workspaceId } = ctx;

  let body: { ids?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!Array.isArray(body.ids)) {
    return NextResponse.json({ error: 'ids must be an array' }, { status: 400 });
  }

  const submitted = body.ids.length;

  // Dedupe, drop non-uuid junk, enforce the per-request cap.
  const ids = [...new Set(
    body.ids.filter((x): x is string => typeof x === 'string' && UUID_RE.test(x.trim()))
      .map((x) => x.trim().toLowerCase()),
  )].slice(0, MAX_IDS);

  if (ids.length === 0) {
    return NextResponse.json({ imported: 0, skipped: submitted });
  }

  // Only ids that exist in the caller's workspace are importable.
  const { data: validRows, error: lookupError } = await service
    .from('generated_images')
    .select('id')
    .in('id', ids)
    .eq('workspace_id', workspaceId);

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  }

  const validIds = (validRows ?? []).map((r: { id: string }) => r.id);

  if (validIds.length > 0) {
    const { error: upsertError } = await service
      .from('image_stars')
      .upsert(
        validIds.map((id) => ({ image_id: id, user_id: user.id })),
        { onConflict: 'image_id,user_id' },
      );
    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    imported: validIds.length,
    skipped: submitted - validIds.length,
  });
}
