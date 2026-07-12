/**
 * POST   /api/forge/references — upload session reference images.
 * DELETE /api/forge/references — remove one.
 *
 * POST body: { sessionId, references: [{ imageBase64, mimeType }] }
 *   Client-compressed (~1280px JPEG) data-URLs or bare base64; max 4 per
 *   session total; ~1.5MB binary sanity cap per item. Uploaded to the public
 *   `generated-images` bucket at forge-refs/{sessionId}/{uuid}.{ext}
 *   (copy-ad precedent — the public URL never expires), then CAS'd into
 *   state.userRefs.
 * Response: { userRefs, session }
 *
 * DELETE body: { sessionId, path }
 * Response: { userRefs, session }
 */
import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireForgeSession, jsonError, forgeErrorResponse } from '@/lib/forge/route-helpers';
import { getForgeState, mutateForgeState, sessionView } from '@/lib/forge/state';
import type { UserRef } from '@/lib/forge/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_REFS = 4;
// ~1.5MB binary ≈ 2M base64 chars (plus data-URL prefix headroom).
const MAX_BASE64_CHARS = 2_100_000;

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const PostBody = z.object({
  sessionId: z.uuid(),
  references: z.array(z.object({
    imageBase64: z.string().min(16).max(MAX_BASE64_CHARS),
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  })).min(1).max(MAX_REFS),
});

const DeleteBody = z.object({
  sessionId: z.uuid(),
  path: z.string().min(1).max(500),
});

export async function POST(request: Request) {
  let body: z.infer<typeof PostBody>;
  try {
    body = PostBody.parse(await request.json());
  } catch (err) {
    return jsonError(400, err instanceof Error ? err.message : 'Invalid request body');
  }

  const ctx = await requireForgeSession(body.sessionId);
  if (!ctx.ok) return ctx.response;
  const { service, session } = ctx;

  try {
    const snapshot = await getForgeState(service, session.id);
    if (!snapshot) return jsonError(404, 'Session state not found');

    const existing = snapshot.state.userRefs || [];
    if (existing.length + body.references.length > MAX_REFS) {
      return jsonError(400, `A session can hold at most ${MAX_REFS} reference images (${existing.length} already uploaded).`);
    }

    const uploaded: UserRef[] = [];
    for (const ref of body.references) {
      const base64Data = ref.imageBase64.includes(',') ? ref.imageBase64.split(',')[1] : ref.imageBase64;
      let bytes: Buffer;
      try {
        bytes = Buffer.from(base64Data, 'base64');
      } catch {
        return jsonError(400, 'Invalid base64 image data');
      }
      if (!bytes.length) return jsonError(400, 'Empty image data');

      const ext = MIME_TO_EXT[ref.mimeType] || 'jpg';
      const path = `forge-refs/${session.id}/${randomUUID()}.${ext}`;

      const { error: upErr } = await service.storage
        .from('generated-images')
        .upload(path, bytes, { contentType: ref.mimeType, upsert: true });
      if (upErr) {
        return jsonError(500, `Reference upload failed: ${upErr.message}`);
      }
      const { data: pub } = service.storage.from('generated-images').getPublicUrl(path);
      uploaded.push({ url: pub.publicUrl, path });
    }

    const { state, rev } = await mutateForgeState(service, session.id, (draft) => {
      const known = new Set(draft.userRefs.map((r) => r.path));
      for (const ref of uploaded) {
        if (!known.has(ref.path)) draft.userRefs.push(ref);
      }
      // Re-applied on CAS retry: enforce the cap deterministically.
      if (draft.userRefs.length > MAX_REFS) draft.userRefs = draft.userRefs.slice(-MAX_REFS);
    });

    return NextResponse.json({
      userRefs: state.userRefs,
      session: sessionView(state, rev, session),
    });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}

export async function DELETE(request: Request) {
  let body: z.infer<typeof DeleteBody>;
  try {
    body = DeleteBody.parse(await request.json());
  } catch (err) {
    return jsonError(400, err instanceof Error ? err.message : 'Invalid request body');
  }

  const ctx = await requireForgeSession(body.sessionId);
  if (!ctx.ok) return ctx.response;
  const { service, session } = ctx;

  // Only paths inside this session's folder may be removed.
  if (!body.path.startsWith(`forge-refs/${session.id}/`)) {
    return jsonError(400, 'Path does not belong to this session');
  }

  try {
    const { error: rmErr } = await service.storage
      .from('generated-images')
      .remove([body.path]);
    if (rmErr) console.warn('[forge/references] storage remove failed:', rmErr.message);

    const { state, rev } = await mutateForgeState(service, session.id, (draft) => {
      draft.userRefs = draft.userRefs.filter((r) => r.path !== body.path);
    });

    return NextResponse.json({
      userRefs: state.userRefs,
      session: sessionView(state, rev, session),
    });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
