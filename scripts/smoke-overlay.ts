/**
 * Overlay smoke — exercise composeOverlay on a synthetic image.
 *
 * Validates sharp integration + SVG layout for each aspect ratio and a
 * realistic set of text_zones. Writes output PNGs to tmp/ so we can
 * eyeball them. No network, no DB, no Claude.
 *
 * Usage:   npx tsx scripts/smoke-overlay.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';
import { composeOverlay } from '@/lib/pipeline/stages/overlay';
import type { AspectRatio, TextZone } from '@/lib/pipeline/schemas/visual';

async function syntheticBase(
  width: number,
  height: number,
  tint: { r: number; g: number; b: number },
): Promise<Buffer> {
  // Simple two-tone gradient so overlays visibly land on a real image
  // rather than solid color — catches text contrast issues early.
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = y / height;
      const i = (y * width + x) * 3;
      raw[i]     = Math.round(tint.r * (1 - t) + 240 * t);
      raw[i + 1] = Math.round(tint.g * (1 - t) + 230 * t);
      raw[i + 2] = Math.round(tint.b * (1 - t) + 210 * t);
    }
  }
  return sharp(raw, { raw: { width, height, channels: 3 } })
    .png()
    .toBuffer();
}

interface Case {
  name: string;
  aspectRatio: AspectRatio;
  zones: TextZone[];
  copy: {
    headline: string;
    subhead: string | null;
    body: string;
    cta: string;
    disclosure: string | null;
  };
  palette: string[];
  tint: { r: number; g: number; b: number };
}

const CASES: Case[] = [
  {
    name: 'lifestyle_aspiration_1_1',
    aspectRatio: '1:1',
    zones: [
      { element: 'headline', position: 'bottom-left', text: '' },
      { element: 'cta',      position: 'bottom-right', text: '' },
    ],
    copy: {
      headline: 'Quiet mornings, finally.',
      subhead: null,
      body: 'Start your day with the calm of Ayurveda.',
      cta: 'Shop now',
      disclosure: null,
    },
    palette: ['#2F5D3A', '#E8D9B5', '#1C3329'],
    tint: { r: 80, g: 110, b: 80 },
  },
  {
    name: 'stat_led_authority_4_5',
    aspectRatio: '4:5',
    zones: [
      { element: 'headline', position: 'top-left', text: '' },
      { element: 'subhead',  position: 'top-left', text: '' },
      { element: 'body',     position: 'bottom-left', text: '' },
      { element: 'cta',      position: 'bottom-right', text: '' },
    ],
    copy: {
      headline: '87%',
      subhead: 'reported softer skin in 14 days',
      body: 'Clinically tested Ayurvedic blend, verified on real users.',
      cta: 'See results',
      disclosure: null,
    },
    palette: ['#8B2E2E', '#F2EAD6', '#2B2424'],
    tint: { r: 180, g: 150, b: 120 },
  },
  {
    name: 'problem_agitation_9_16',
    aspectRatio: '9:16',
    zones: [
      { element: 'headline', position: 'top',    text: '' },
      { element: 'subhead',  position: 'top',    text: '' },
      { element: 'cta',      position: 'bottom', text: '' },
    ],
    copy: {
      headline: 'Tired eyes at 10 pm again?',
      subhead: 'You do not need another serum.',
      body: '',
      cta: 'Find your ritual',
      disclosure: 'Results vary',
    },
    palette: ['#3A2B2B', '#D9C4A3'],
    tint: { r: 90, g: 70, b: 60 },
  },
  {
    name: 'empty_zones_fallback',
    aspectRatio: '4:5',
    zones: [], // No zones — overlay should synthesize headline + CTA.
    copy: {
      headline: 'Ancient wisdom, modern routine.',
      subhead: null,
      body: 'Built for the morning rush.',
      cta: 'Get yours',
      disclosure: null,
    },
    palette: [],
    tint: { r: 120, g: 140, b: 100 },
  },
];

const CANVAS: Record<AspectRatio, { w: number; h: number }> = {
  '1:1':  { w: 1080, h: 1080 },
  '4:5':  { w: 1080, h: 1350 },
  '9:16': { w: 1080, h: 1920 },
  '16:9': { w: 1920, h: 1080 },
  '3:4':  { w: 1080, h: 1440 },
};

async function main(): Promise<void> {
  const outDir = path.resolve(process.cwd(), 'tmp/overlay');
  fs.mkdirSync(outDir, { recursive: true });

  let failed = 0;
  for (const c of CASES) {
    const canvas = CANVAS[c.aspectRatio];
    const base = await syntheticBase(canvas.w, canvas.h, c.tint);

    try {
      const result = await composeOverlay({
        imageBytes: base,
        aspectRatio: c.aspectRatio,
        textZones: c.zones,
        copy: c.copy,
        palette: c.palette,
      });

      const outPath = path.join(outDir, `${c.name}.png`);
      fs.writeFileSync(outPath, result.imageBytes);

      // Sanity-check the output is a valid PNG of the expected size.
      const meta = await sharp(result.imageBytes).metadata();
      if (meta.width !== canvas.w || meta.height !== canvas.h) {
        console.error(
          `✗ ${c.name}: size mismatch ${meta.width}x${meta.height} vs ${canvas.w}x${canvas.h}`,
        );
        failed++;
        continue;
      }
      if (meta.format !== 'png') {
        console.error(`✗ ${c.name}: format was ${meta.format}, expected png`);
        failed++;
        continue;
      }

      console.log(
        `✓ ${c.name} — ${result.zonesRendered} zones rendered → ${outPath}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`✗ ${c.name} threw: ${msg}`);
      failed++;
    }
  }

  if (failed > 0) {
    console.error(`\n${failed} case(s) failed`);
    process.exit(1);
  }
  console.log(`\nAll ${CASES.length} overlay cases passed.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
