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
 * Use this when you want higher quality or a fresh take from the model,
 * not just a pixel-stretched version.
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

  // ── Fetch generated_image + session (ownership check via session.user_id) ─
  const { data: img, error: imgErr } = await service
    .from('generated_images')
    .select('id, prompt_used, aspect_ratio, model_id, session_id')
    .eq('id', image_id)
    .single();

  if (imgErr || !img) {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 });
  }

  if (!img.prompt_used) {
    return NextResponse.json({ error: 'Image has no stored prompt — cannot regenerate' }, { status: 422 });
  }

  // ── Verify ownership via session ──────────────────────────────────────────
  const { data: session, error: sessErr } = await service
    .from('sessions')
    .select('id, user_id, product_id')
    .eq('id', img.session_id)
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

  // ── Resolve product reference images ──────────────────────────────────────
  const { data: rawProductImages } = await service
    .from('product_images')
    .select('*')
    .eq('product_id', session.product_id)
    .order('is_reference', { ascending: false })
    .limit(6);

  const resolvedProductImages = await resolveReferenceImages(
    (rawProductImages ?? []) as ProductImage[]
  );
  const referenceImageUrls = [
    ...resolvedProductImages
      .map((img: any) => img.resolved_url as string | null)
      .filter((u): u is string => !!u),
  ].slice(0, 4);

  // ── Re-generate at max quality ────────────────────────────────────────────
  const aspectRatio = (img.aspect_ratio ?? '1:1') as AspectRatio;
  const modelId     = (img.model_id ?? process.env.OPENAI_MODEL_ID ?? 'gpt-image-2');

  console.log(
    `[regenerate] image=${image_id} model=${modelId} aspect=${aspectRatio}` +
    ` refs=${referenceImageUrls.length} quality=high prompt_len=${img.prompt_used.length}`,
  );

  let result: Awaited<ReturnType<typeof imageProvider.submitGeneration>>;
  try {
    result = await imageProvider.submitGeneration({
      prompt:             img.prompt_used,
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
