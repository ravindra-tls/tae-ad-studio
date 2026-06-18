import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { imageProvider, getGeneratedFileExtension } from '@/lib/image-providers';
import { resolveReferenceImages } from '@/lib/storage/reference-images';
import type { ProductImage } from '@/types';
import type { AspectRatio } from '@/lib/hooks/use-generation-stream';

export const maxDuration = 120; // GPT Image-2 can take up to 2 min for max quality

/**
 * POST /api/images/regenerate
 *
 * Re-submits the original prompt + product reference images to GPT Image-2
 * with quality set to 'high' (maximum). This is a fresh generation — not
 * an algorithmic upscale — so the output may differ from the original.
 *
 * Product ID is resolved with a two-step fallback:
 *   1. session.product_id  — set for copy-ad sessions
 *   2. brief.product_id    — set for pipeline sessions (template-generate)
 * This ensures product images are always passed regardless of which
 * workflow created the original image.
 *
 * Body: { image_id: string }
 * Response: image/png with Content-Disposition: attachment
 */
export async function POST(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { image_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { image_id } = body;
  if (!image_id) {
    return NextResponse.json({ error: 'image_id is required' }, { status: 400 });
  }

  const service = await createServiceClient();

  // ── Fetch generated_image record (also grab brief_id for the fallback) ────
  const { data: genImg, error: imgErr } = await service
    .from('generated_images')
    .select('id, prompt_used, aspect_ratio, model_id, session_id, brief_id')
    .eq('id', image_id)
    .single();

  if (imgErr || !genImg) {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 });
  }

  if (!genImg.prompt_used) {
    return NextResponse.json({ error: 'Image has no stored prompt — cannot regenerate' }, { status: 422 });
  }

  // ── Verify ownership via session ──────────────────────────────────────────
  const { data: session, error: sessErr } = await service
    .from('sessions')
    .select('id, user_id, product_id')
    .eq('id', genImg.session_id)
    .single();

  if (sessErr || !session || session.user_id !== user.id) {
    return NextResponse.json({ error: 'Image not found or not accessible' }, { status: 404 });
  }

  // ── Usage cap check (regenerate counts as 1 credit) ──────────────────────
  const { data: profile } = await service
    .from('profiles')
    .select('usage_count, usage_cap')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }
  if (profile.usage_count >= profile.usage_cap) {
    return NextResponse.json(
      { error: 'Weekly generation limit reached.' },
      { status: 429 },
    );
  }

  // ── Resolve product_id (session → brief fallback) ─────────────────────────
  //
  // copy-ad sessions store product_id directly on the session row.
  // Pipeline (template-generate) sessions store product_id on the brief,
  // not the session — so we fall back to the brief when session.product_id
  // is null to ensure product images are always resolved.
  let productId: string | null = session.product_id ?? null;

  if (!productId && genImg.brief_id) {
    const { data: brief } = await service
      .from('briefs')
      .select('product_id')
      .eq('id', genImg.brief_id)
      .single();
    productId = brief?.product_id ?? null;
  }

  // ── Fetch product row (for thumbnail_url) + product_images ───────────────
  let thumbnailUrl: string | null = null;
  let rawProductImages: ProductImage[] = [];

  if (productId) {
    const [productRes, imagesRes] = await Promise.all([
      service
        .from('products')
        .select('id, thumbnail_url')
        .eq('id', productId)
        .single(),
      service
        .from('product_images')
        .select('*')
        .eq('product_id', productId)
        .order('is_reference', { ascending: false })
        .limit(6),
    ]);

    thumbnailUrl    = productRes.data?.thumbnail_url ?? null;
    rawProductImages = (imagesRes.data ?? []) as ProductImage[];
  } else {
    console.warn('[regenerate] No product_id found via session or brief — generating without product images');
  }

  // ── Resolve signed URLs for product_images ────────────────────────────────
  const resolvedProductImages = await resolveReferenceImages(rawProductImages);

  const referenceImageUrls: string[] = [
    ...resolvedProductImages
      .map((r) => r.resolved_url)
      .filter((u): u is string => !!u),
    ...(thumbnailUrl ? [thumbnailUrl] : []),
  ].slice(0, 4);

  // ── Re-generate at max quality ────────────────────────────────────────────
  const aspectRatio = (genImg.aspect_ratio ?? '1:1') as AspectRatio;
  const modelId     = genImg.model_id ?? process.env.OPENAI_MODEL_ID ?? 'gpt-image-2';

  console.log(
    `[regenerate] image=${image_id} model=${modelId} aspect=${aspectRatio}` +
    ` product=${productId ?? 'none'} refs=${referenceImageUrls.length}` +
    ` quality=high prompt_len=${genImg.prompt_used.length}`,
  );

  let result: Awaited<ReturnType<typeof imageProvider.submitGeneration>>;
  try {
    result = await imageProvider.submitGeneration({
      prompt:             genImg.prompt_used,
      aspectRatio,
      modelId,
      referenceImageUrls: referenceImageUrls.length > 0 ? referenceImageUrls : undefined,
      quality:            'high',
    });
  } catch (err: any) {
    console.error('[regenerate] provider error:', err.message);
    return NextResponse.json({ error: `Generation failed: ${err.message}` }, { status: 502 });
  }

  if (result.status !== 'completed' || !result.image) {
    const reason = result.error ?? `Unexpected status: ${result.status}`;
    console.error('[regenerate] non-completed result:', reason);
    return NextResponse.json({ error: reason }, { status: 502 });
  }

  // ── Increment usage ───────────────────────────────────────────────────────
  const { error: rpcErr } = await service.rpc('increment_usage', { user_id: user.id });
  if (rpcErr) console.error('[regenerate] increment_usage failed:', rpcErr.message);

  // ── Stream result back as attachment ──────────────────────────────────────
  const imgBytes = Buffer.from(result.image.data, 'base64');
  const ext      = getGeneratedFileExtension(result.image.mimeType);
  const slug     = image_id.slice(0, 8);
  const filename = `tae-ad-${slug}-hq.${ext}`;

  return new NextResponse(new Uint8Array(imgBytes), {
    status: 200,
    headers: {
      'Content-Type':        result.image.mimeType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      String(imgBytes.length),
      'Cache-Control':       'private, max-age=3600',
    },
  });
}
