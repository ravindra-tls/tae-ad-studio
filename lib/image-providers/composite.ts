/**
 * Server-side masked compositing
 *
 * Approach:
 *   1. xAI generates a full-quality edit of the whole image
 *   2. The lasso mask cuts the generated image to the selected area only
 *   3. That cutout is layered on top of the original
 *   → Selected area: 100% from generated image
 *   → Non-selected:  100% from original image
 *   → Feathered blur on the mask boundary gives smooth edges
 */

import sharp from 'sharp';

// ─── Image fetch ──────────────────────────────────────────────────────────────

async function fetchBuffer(src: string): Promise<Buffer> {
  if (src.startsWith('data:')) {
    const match = src.match(/^data:[^;]+;base64,(.+)$/);
    if (!match) throw new Error('Invalid data URI');
    return Buffer.from(match[1], 'base64');
  }
  if (src.startsWith('/') && !src.startsWith('//')) {
    const { readFile } = await import('fs/promises');
    const { join }     = await import('path');
    return readFile(join(process.cwd(), 'public', src));
  }
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Failed to fetch image (HTTP ${res.status}): ${src}`);
  return Buffer.from(await res.arrayBuffer());
}

// ─── Core composite ───────────────────────────────────────────────────────────

export async function compositeMaskedEdit(
  originalSrc:     string,
  generatedBase64: string,
  maskDataUri:     string,
): Promise<string> {

  // ── 1. Original image → establish canvas dimensions ───────────────────────
  const origBuffer = await fetchBuffer(originalSrc);
  const origMeta   = await sharp(origBuffer).metadata();
  const width      = origMeta.width  ?? 1024;
  const height     = origMeta.height ?? 1024;
  console.log(`[composite] original: ${width}×${height}`);

  const { data: origRaw } = await sharp(origBuffer)
    .resize(width, height, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // ── 2. Generated image → same dimensions, raw RGBA ────────────────────────
  const { data: genRaw } = await sharp(Buffer.from(generatedBase64, 'base64'))
    .resize(width, height, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // ── 3. Build selection mask from the lasso PNG ────────────────────────────
  const base64Mask = maskDataUri.replace(/^data:image\/\w+;base64,/, '');
  const maskBuffer = Buffer.from(base64Mask, 'base64');
  const maskMeta   = await sharp(maskBuffer).metadata();
  console.log(`[composite] mask PNG: ${maskMeta.width}×${maskMeta.height}, channels=${maskMeta.channels}, hasAlpha=${maskMeta.hasAlpha}`);

  let selectionRaw: Buffer;

  if (maskMeta.hasAlpha) {
    // Canvas: transparent everywhere, opaque fill in lasso area → alpha IS the selection
    selectionRaw = await sharp(maskBuffer)
      .resize(width, height, { fit: 'fill', kernel: 'nearest' })
      .extractChannel('alpha')
      .raw()
      .toBuffer();
  } else {
    // Fallback: mask exported as RGB — detect red pixels
    console.warn('[composite] mask has no alpha — falling back to red-channel detection');
    const channels = maskMeta.channels ?? 3;
    const { data: rawMask } = await sharp(maskBuffer)
      .resize(width, height, { fit: 'fill', kernel: 'nearest' })
      .raw()
      .toBuffer({ resolveWithObject: true });
    selectionRaw = Buffer.alloc(width * height);
    for (let i = 0; i < width * height; i++) {
      const r = rawMask[i * channels];
      const g = rawMask[i * channels + 1];
      const b = rawMask[i * channels + 2];
      selectionRaw[i] = r > 100 && r > g + 30 && r > b + 30 ? 255 : 0;
    }
  }

  const selected = selectionRaw.reduce((n: number, v: number) => n + (v > 0 ? 1 : 0), 0);
  console.log(`[composite] selected: ${selected}/${width * height} (${((selected / (width * height)) * 100).toFixed(1)}%)`);

  if (selected === 0) {
    console.warn('[composite] empty mask — returning generated image');
    return generatedBase64;
  }

  // ── 4. Feather the selection edges ────────────────────────────────────────
  // Feather radius: dry-run benchmark (tmp/lasso-local-check) showed blur(14) gives
  // the softest, most natural blend at the lasso boundary. Increase for softer edges,
  // decrease (min ~3) for harder cut.
  const featheredRaw = await sharp(selectionRaw, { raw: { width, height, channels: 1 } })
    .blur(14)
    .raw()
    .toBuffer();

  // ── 5. Per-pixel blend: orig × (1−α) + gen × α ───────────────────────────
  // Diagnostic: find peak alpha and first strongly-selected pixel
  let diagIdx = -1;
  let maxAlpha = 0;
  let maxAlphaIdx = -1;
  for (let i = 0; i < width * height; i++) {
    const a = featheredRaw[i];
    if (a > maxAlpha) { maxAlpha = a; maxAlphaIdx = i; }
    if (a > 200 && diagIdx < 0) diagIdx = i;
  }
  console.log(`[composite] peak alpha=${maxAlpha} at pixel@${maxAlphaIdx}`);
  const sampleIdx = diagIdx >= 0 ? diagIdx : maxAlphaIdx;
  if (sampleIdx >= 0) {
    const p = sampleIdx * 4;
    console.log(
      `[composite] pixel@${sampleIdx} (alpha=${featheredRaw[sampleIdx]}): ` +
      `orig=RGB(${origRaw[p]},${origRaw[p+1]},${origRaw[p+2]}) ` +
      `gen=RGB(${genRaw[p]},${genRaw[p+1]},${genRaw[p+2]})`,
    );
  }

  const outputRaw = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const alpha = featheredRaw[i] / 255;   // 0 = keep original, 1 = use generated
    const inv   = 1 - alpha;
    const p     = i * 4;
    outputRaw[p]     = Math.round(origRaw[p]     * inv + genRaw[p]     * alpha);
    outputRaw[p + 1] = Math.round(origRaw[p + 1] * inv + genRaw[p + 1] * alpha);
    outputRaw[p + 2] = Math.round(origRaw[p + 2] * inv + genRaw[p + 2] * alpha);
    outputRaw[p + 3] = 255;
  }

  // ── 6. Encode and return ──────────────────────────────────────────────────
  const outputPng = await sharp(outputRaw, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();

  console.log(`[composite] done — ${width}×${height}`);
  return outputPng.toString('base64');
}
