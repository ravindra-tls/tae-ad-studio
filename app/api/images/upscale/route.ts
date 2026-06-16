import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const maxDuration = 60; // upscaling a 1536×1024 image takes a few seconds

/**
 * POST /api/images/upscale
 *
 * Downloads a generated_image by ID, applies a 2× Lanczos3 upscale via
 * sharp, and streams the resulting PNG back as a file download.
 *
 * GPT Image-2 max native resolution is 1536×1024 / 1024×1536 / 1024×1024.
 * After upscale: 3072×2048 / 2048×3072 / 2048×2048 (~200 DPI equivalent
 * when printed at standard ad sizes).
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

  // ── Fetch image record ────────────────────────────────────────────────────
  const service = await createServiceClient();
  const { data: img, error: dbErr } = await service
    .from('generated_images')
    .select('id, image_url, aspect_ratio, status')
    .eq('id', image_id)
    .single();

  if (dbErr || !img) {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 });
  }

  if (!img.image_url) {
    return NextResponse.json({ error: 'Image has no URL (may have failed)' }, { status: 422 });
  }

  // ── Download original ─────────────────────────────────────────────────────
  let inputBuffer: Buffer;
  try {
    const res = await fetch(img.image_url, {
      headers: { 'User-Agent': 'TAE-AdStudio/1.0 ImageUpscaler' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    inputBuffer = Buffer.from(await res.arrayBuffer());
  } catch (err: any) {
    console.error('[upscale] download failed:', err.message);
    return NextResponse.json(
      { error: `Failed to download source image: ${err.message}` },
      { status: 502 },
    );
  }

  // ── Upscale 2× with Lanczos3 ──────────────────────────────────────────────
  let upscaled: Buffer;
  try {
    const meta = await sharp(inputBuffer).metadata();
    const origW = meta.width  ?? 1024;
    const origH = meta.height ?? 1024;
    const newW  = origW * 2;
    const newH  = origH * 2;

    console.log(`[upscale] ${origW}×${origH} → ${newW}×${newH} (Lanczos3) image=${image_id}`);

    upscaled = await sharp(inputBuffer)
      .resize(newW, newH, { kernel: sharp.kernel.lanczos3, fastShrinkOnLoad: false })
      .png({ compressionLevel: 8, effort: 10 })
      .toBuffer();
  } catch (err: any) {
    console.error('[upscale] sharp failed:', err.message);
    return NextResponse.json(
      { error: `Upscale processing failed: ${err.message}` },
      { status: 500 },
    );
  }

  // ── Stream back as attachment ─────────────────────────────────────────────
  const slug = image_id.slice(0, 8);
  const filename = `tae-ad-${slug}-2x.png`;

  return new NextResponse(upscaled, {
    status: 200,
    headers: {
      'Content-Type':        'image/png',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      String(upscaled.length),
      'Cache-Control':       'private, max-age=3600',
    },
  });
}
