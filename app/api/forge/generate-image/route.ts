/**
 * POST /api/forge/generate-image
 *
 * Render a finalized concept's export prompt with the live image provider,
 * with full gallery-contract parity (mirrors pipeline/direct-generate):
 *
 *   1. Auth/ownership → usage cap pre-check (429).
 *   2. Server-authoritative prompt: body.prompt overrides, else
 *      forge_concepts.export_record.prompt; aspect via normalizeAspect.
 *   3. References: state.userRefs if any, else product_images
 *      (is_reference-first, limit 6) + thumbnail_url — signed URLs minted AT
 *      submit time; .slice(0, 4).
 *   4. Insert generated_images row (status 'queued', forge_concept_id,
 *      template_id resolved from prompt_templates by number when templated).
 *   5. imageProvider.submitGeneration (quality default 'medium').
 *   6. try/catch ALWAYS updates the row: moderation/content-policy errors →
 *      'nsfw', other failures → 'failed'; completed → bucket upload
 *      ${user.id}/${genImage.id}.{ext} (3-retry) + increment_usage.
 *   7. Return { imageId, imageUrl, status }.
 *
 * Result: gallery, /session/[id]/results, regenerate, and upscale all work
 * with zero changes.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireForgeSession, jsonError, forgeErrorResponse } from '@/lib/forge/route-helpers';
import { getForgeState } from '@/lib/forge/state';
import { normalizeAspect, liveImageModelId } from '@/lib/forge/export';
import { imageProvider, getGeneratedFileExtension } from '@/lib/image-providers';
import { resolveReferenceImages } from '@/lib/storage/reference-images';
import type { ExportRecord } from '@/lib/forge/types';
import type { ProductImage } from '@/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const RequestBody = z
  .object({
    sessionId: z.uuid(),
    // The finalized concept can be addressed either way; the client uses
    // cardId (stable across refines), resolved via unique (session_id, card_id).
    forgeConceptId: z.uuid().optional(),
    cardId: z.uuid().optional(),
    prompt: z.string().min(1).max(20_000).optional(),
    aspectRatio: z.string().max(16).optional(),
    quality: z.enum(['low', 'medium', 'high']).optional(),
  })
  .refine((b) => b.forgeConceptId || b.cardId, { message: 'forgeConceptId or cardId required' });

const MODERATION_RE = /moderation|content[ _-]?policy|safety system|blocked by|violates|not allowed by/i;

export async function POST(request: Request) {
  let body: z.infer<typeof RequestBody>;
  try {
    body = RequestBody.parse(await request.json());
  } catch (err) {
    return jsonError(400, err instanceof Error ? err.message : 'Invalid request body');
  }

  const ctx = await requireForgeSession(body.sessionId);
  if (!ctx.ok) return ctx.response;
  const { user, service, session } = ctx;

  try {
    // ── 1. Usage cap pre-check ──────────────────────────────────────────────
    const { data: profile } = await service
      .from('profiles')
      .select('usage_count, usage_cap')
      .eq('id', user.id)
      .single();
    if (!profile) return jsonError(404, 'Profile not found');
    if (profile.usage_count >= profile.usage_cap) {
      return NextResponse.json(
        { error: 'Weekly generation limit reached.', used: profile.usage_count, cap: profile.usage_cap },
        { status: 429 },
      );
    }

    // ── 2. Server-authoritative prompt from the finalized concept ──────────
    let conceptQuery = service
      .from('forge_concepts')
      .select('id, session_id, export_record')
      .eq('session_id', session.id);
    conceptQuery = body.forgeConceptId
      ? conceptQuery.eq('id', body.forgeConceptId)
      : conceptQuery.eq('card_id', body.cardId as string);
    const { data: conceptRow } = await conceptQuery.maybeSingle();
    if (!conceptRow) {
      return jsonError(404, 'Finalized concept not found');
    }
    const exportRecord = (conceptRow.export_record as ExportRecord | null) ?? null;

    const finalPrompt = body.prompt ?? exportRecord?.prompt;
    if (!finalPrompt) {
      return jsonError(400, 'No prompt available — export the concept first.');
    }
    const aspectRatio = normalizeAspect(body.aspectRatio ?? exportRecord?.settings?.aspect_ratio);

    // ── 3. References resolved AT submit time ──────────────────────────────
    const snapshot = await getForgeState(service, session.id);
    const userRefs = snapshot?.state.userRefs ?? [];

    let referenceImageUrls: string[];
    if (userRefs.length) {
      // Session uploads REPLACE the product fallback.
      referenceImageUrls = userRefs.map((r) => r.url).slice(0, 4);
    } else {
      const [{ data: rawImages }, { data: productRow }] = await Promise.all([
        service
          .from('product_images')
          .select('*')
          .eq('product_id', session.product_id)
          .order('is_reference', { ascending: false })
          .limit(6),
        service
          .from('products')
          .select('thumbnail_url')
          .eq('id', session.product_id)
          .maybeSingle(),
      ]);
      const resolved = await resolveReferenceImages((rawImages ?? []) as ProductImage[]);
      referenceImageUrls = [
        ...resolved.map((img) => img.resolved_url).filter((u): u is string => !!u),
        ...(productRow?.thumbnail_url ? [productRow.thumbnail_url as string] : []),
      ].slice(0, 4);
    }

    // ── Provider + model ────────────────────────────────────────────────────
    const activeProvider = (process.env.IMAGE_PROVIDER || 'openai').toLowerCase();
    const apiProvider = activeProvider === 'vertex' ? 'vertex-ai' : activeProvider;
    const modelId = liveImageModelId();

    // template_id provenance when the export used a template.
    let templateId: string | null = null;
    const templateNumber = exportRecord?.settings?.template_number ?? null;
    if (templateNumber != null) {
      const { data: tplRow } = await service
        .from('prompt_templates')
        .select('id')
        .eq('number', templateNumber)
        .maybeSingle();
      templateId = tplRow?.id ?? null;
    }

    // ── 4. Insert the generated_images row (queued) ─────────────────────────
    const { data: genImage, error: genErr } = await service
      .from('generated_images')
      .insert({
        session_id: session.id,
        prompt_used: finalPrompt,
        aspect_ratio: aspectRatio,
        api_provider: apiProvider,
        model_id: modelId,
        status: 'queued',
        forge_concept_id: conceptRow.id,
        template_id: templateId,
        // Denormalized ownership (migration 025) — gallery/search scope predicates.
        user_id: user.id,
        product_id: session.product_id,
        workspace_id: session.workspace_id,
      })
      .select()
      .single();
    if (genErr || !genImage) {
      return jsonError(500, `Failed to create generated_image row: ${genErr?.message ?? 'unknown'}`);
    }

    // ── 5-6. Generate; ALWAYS update the row ────────────────────────────────
    try {
      const result = await imageProvider.submitGeneration({
        prompt: finalPrompt,
        aspectRatio,
        referenceImageUrls: referenceImageUrls.length ? referenceImageUrls : undefined,
        quality: body.quality ?? 'medium',
        modelId,
      });

      if (result.status === 'completed' && result.image) {
        const bytes = Buffer.from(result.image.data, 'base64');
        const ext = getGeneratedFileExtension(result.image.mimeType);
        const filePath = `${user.id}/${genImage.id}.${ext}`;

        let uploadErr: unknown = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          const { error } = await service.storage
            .from('generated-images')
            .upload(filePath, bytes, { contentType: result.image.mimeType, upsert: true });
          if (!error) { uploadErr = null; break; }
          uploadErr = error;
          if (attempt < 3) await new Promise((r) => setTimeout(r, 500 * attempt ** 2));
        }
        if (uploadErr) {
          throw new Error(`Image upload failed: ${uploadErr instanceof Error ? uploadErr.message : String(uploadErr)}`);
        }

        const { data: pub } = service.storage.from('generated-images').getPublicUrl(filePath);
        const imageUrl = pub.publicUrl;

        await service.from('generated_images').update({
          request_id: result.requestId ?? null,
          status: 'completed',
          image_url: imageUrl,
        }).eq('id', genImage.id);

        const { error: rpcErr } = await service.rpc('increment_usage', { user_id: user.id });
        if (rpcErr) console.error('[forge/generate-image] increment_usage failed:', rpcErr.message);

        return NextResponse.json({ imageId: genImage.id, imageUrl, status: 'completed' });
      }

      // Non-completed provider result — classify and persist.
      const reason = result.error ?? `Generation status: ${result.status}`;
      const status = result.status === 'nsfw' || MODERATION_RE.test(reason) ? 'nsfw' : 'failed';
      await service.from('generated_images').update({
        request_id: result.requestId ?? null,
        status,
        error_message: reason,
      }).eq('id', genImage.id);
      return NextResponse.json({ imageId: genImage.id, imageUrl: null, status, error: reason }, { status: 502 });
    } catch (err) {
      // The row must NEVER be left stuck on 'queued'.
      const msg = err instanceof Error ? err.message : String(err);
      const status = MODERATION_RE.test(msg) ? 'nsfw' : 'failed';
      await service.from('generated_images').update({
        status,
        error_message: msg,
      }).eq('id', genImage.id);
      return NextResponse.json({ imageId: genImage.id, imageUrl: null, status, error: msg }, { status: 502 });
    }
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
