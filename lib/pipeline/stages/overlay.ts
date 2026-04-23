/**
 * Overlay stage — composite ad copy onto the rendered image.
 *
 * Stage 5 of the pipeline (sits between render and critique). Image models
 * can't render text reliably, so we tell them NOT to, then stamp the copy
 * ourselves using the text_zones the visual stage emits. Without this stage
 * every concept ships as a background image with no headline/CTA — which is
 * exactly what was happening before.
 *
 * Inputs:
 *   - base image bytes (PNG/JPEG) from render
 *   - aspect_ratio  (drives canvas dimensions — we composite at the image's
 *     native resolution to avoid double-scaling)
 *   - visual.text_zones  (where each element sits: element + position)
 *   - copy.structured    (what the literal text is)
 *   - brand palette      (defaults for overlay text + scrim color)
 *
 * Output: a PNG buffer with headline/subhead/body/cta/disclosure composited.
 *
 * Strategy: we build ONE SVG overlay at the image's native size and have
 * sharp composite it on top. SVG is the right tool here — it gives us
 * system-font fallback chains, text auto-wrap via foreignObject, and a
 * scrim rectangle per zone for legibility without forcing us to learn
 * font metrics. If sharp or SVG rendering fails, callers fall back to the
 * raw render image (see orchestrator).
 */

import sharp from 'sharp';
import type { AspectRatio, TextZone } from '../schemas/visual';

// ─── Public types ───────────────────────────────────────────────────────────

export interface OverlayCopy {
  headline: string;
  subhead: string | null;
  body: string;
  cta: string;
  disclosure: string | null;
}

export interface OverlayInput {
  /** Raw image bytes from the render stage. */
  imageBytes: Buffer;
  /** Aspect ratio of the source image — used to resolve canvas dimensions. */
  aspectRatio: AspectRatio;
  /** Zones emitted by the visual stage (element + position; text we ignore, it may be stale). */
  textZones: TextZone[];
  /** Literal copy to render (wins over whatever text the visual stage echoed). */
  copy: OverlayCopy;
  /**
   * Brand palette as an array of hex or named colors. Used to pick the
   * accent color for the CTA pill and, if the image is too busy for white
   * text, a fallback body color. Missing palette → sensible wellness defaults.
   */
  palette?: string[];
}

export interface OverlayOutput {
  /** Composited PNG bytes. */
  imageBytes: Buffer;
  /** Mime type — always image/png after overlay. */
  mimeType: 'image/png';
  /** How many zones were actually rendered (skipped empties are counted as 0). */
  zonesRendered: number;
}

// ─── Canvas sizing per aspect ratio ─────────────────────────────────────────

/**
 * Target render dimensions per aspect ratio. These are the canvas sizes the
 * image provider tends to return (xAI returns 1024-ish on the long edge); we
 * match them here so we don't resize the base image before compositing.
 *
 * Sharp will auto-scale our SVG overlay to the actual base image size if it
 * differs — these are just defaults for fallback SVG construction when we
 * can't probe the image.
 */
const ASPECT_CANVAS: Record<AspectRatio, { width: number; height: number }> = {
  '1:1':  { width: 1080, height: 1080 },
  '4:5':  { width: 1080, height: 1350 },
  '9:16': { width: 1080, height: 1920 },
  '16:9': { width: 1920, height: 1080 },
  '3:4':  { width: 1080, height: 1440 },
};

// ─── Position → SVG rect math ───────────────────────────────────────────────

type Position = TextZone['position'];

interface ZoneRect {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Horizontal text anchor inside the rect. */
  align: 'left' | 'center' | 'right';
  /** Vertical anchor inside the rect. */
  vAlign: 'top' | 'middle' | 'bottom';
}

/**
 * Resolve an abstract position ('bottom-left', 'top', etc.) to a pixel
 * rectangle on the canvas. We reserve the outer 6% as breathing room on
 * every side and divide the inner area into a 3×3 grid. Each zone gets a
 * rectangle that is ~1/3 of the width and ~1/5 of the height; this leaves
 * the subject area readable while giving the copy a reliable home.
 */
function rectFor(
  position: Position,
  canvas: { width: number; height: number },
): ZoneRect {
  const padX = Math.round(canvas.width * 0.06);
  const padY = Math.round(canvas.height * 0.06);
  const innerW = canvas.width - padX * 2;
  const innerH = canvas.height - padY * 2;

  // Default zone: half-width, ~22% of canvas height.
  const zoneW = Math.round(innerW * 0.66);
  const zoneH = Math.round(innerH * 0.22);
  const narrowW = Math.round(innerW * 0.4);

  const topY    = padY;
  const midY    = padY + Math.round(innerH / 2) - Math.round(zoneH / 2);
  const botY    = canvas.height - padY - zoneH;
  const leftX   = padX;
  const rightX  = canvas.width - padX - zoneW;
  const narrowRightX = canvas.width - padX - narrowW;

  switch (position) {
    case 'top':
      return { x: leftX, y: topY, w: innerW, h: zoneH, align: 'center', vAlign: 'top' };
    case 'top-left':
      return { x: leftX, y: topY, w: zoneW, h: zoneH, align: 'left', vAlign: 'top' };
    case 'top-right':
      return { x: narrowRightX, y: topY, w: narrowW, h: zoneH, align: 'right', vAlign: 'top' };
    case 'center':
      return { x: leftX, y: midY, w: innerW, h: zoneH, align: 'center', vAlign: 'middle' };
    case 'bottom':
      return { x: leftX, y: botY, w: innerW, h: zoneH, align: 'center', vAlign: 'bottom' };
    case 'bottom-left':
      return { x: leftX, y: botY, w: zoneW, h: zoneH, align: 'left', vAlign: 'bottom' };
    case 'bottom-right':
      return { x: narrowRightX, y: botY, w: narrowW, h: zoneH, align: 'right', vAlign: 'bottom' };
    default:
      return { x: leftX, y: botY, w: zoneW, h: zoneH, align: 'left', vAlign: 'bottom' };
  }
}

// ─── Element → font metrics ────────────────────────────────────────────────

interface ElementStyle {
  /** Font size as fraction of canvas height. Typographic scale, not pixel. */
  sizeRatio: number;
  /** Line-height multiplier. */
  lineHeight: number;
  /** Font weight for the SVG. */
  weight: number;
  /** Font style posture. */
  family: string;
  /** Max chars per line — wrapping heuristic. */
  maxCharsPerLine: number;
  /** Whether this element gets a CTA-style pill background. */
  pill: boolean;
}

const ELEMENT_STYLE: Record<TextZone['element'], ElementStyle> = {
  headline: {
    sizeRatio: 0.055,
    lineHeight: 1.1,
    weight: 700,
    family: `'Inter', 'Helvetica Neue', Arial, sans-serif`,
    maxCharsPerLine: 18,
    pill: false,
  },
  subhead: {
    sizeRatio: 0.028,
    lineHeight: 1.2,
    weight: 500,
    family: `'Inter', 'Helvetica Neue', Arial, sans-serif`,
    maxCharsPerLine: 34,
    pill: false,
  },
  body: {
    sizeRatio: 0.022,
    lineHeight: 1.3,
    weight: 400,
    family: `'Inter', 'Helvetica Neue', Arial, sans-serif`,
    maxCharsPerLine: 48,
    pill: false,
  },
  cta: {
    sizeRatio: 0.024,
    lineHeight: 1.1,
    weight: 600,
    family: `'Inter', 'Helvetica Neue', Arial, sans-serif`,
    maxCharsPerLine: 20,
    pill: true,
  },
  disclosure: {
    sizeRatio: 0.015,
    lineHeight: 1.2,
    weight: 400,
    family: `'Inter', 'Helvetica Neue', Arial, sans-serif`,
    maxCharsPerLine: 64,
    pill: false,
  },
};

// ─── Word wrap ──────────────────────────────────────────────────────────────

/**
 * Dumb-but-reliable word-wrapping. SVG <text> doesn't auto-wrap, so we break
 * the string into <tspan> lines ourselves. This is a heuristic by character
 * count — good enough for feed-sized ad copy. If the string is longer than
 * the zone can hold, we truncate the final line with an ellipsis.
 */
function wrap(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current);
      current = w;
    } else {
      current = candidate;
    }
    if (lines.length >= maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length > maxLines) {
    lines.length = maxLines;
  }
  // Truncate overflow if the text is too long for the zone.
  const usedChars = lines.join(' ').length;
  if (usedChars < text.length && lines.length === maxLines) {
    const last = lines[lines.length - 1];
    lines[lines.length - 1] =
      last.length > 3 ? last.slice(0, Math.max(0, last.length - 3)) + '…' : '…';
  }
  return lines;
}

// ─── Palette helpers ────────────────────────────────────────────────────────

/**
 * Pick an accent color from the brand palette for the CTA pill. Prefers a
 * mid-saturation non-white, non-black entry. Falls back to a wellness-safe
 * forest green when no suitable color exists.
 */
function pickAccent(palette: string[] | undefined): string {
  const fallback = '#2F5D3A';
  if (!palette || palette.length === 0) return fallback;
  const candidate = palette.find((c) => {
    const lower = c.toLowerCase().trim();
    return (
      lower &&
      lower !== '#ffffff' &&
      lower !== 'white' &&
      lower !== '#000000' &&
      lower !== 'black'
    );
  });
  return candidate ?? fallback;
}

// ─── SVG builder ────────────────────────────────────────────────────────────

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

interface BuiltZone {
  element: TextZone['element'];
  rect: ZoneRect;
  text: string;
  position: Position;
}

/**
 * Describes one prepared element: the wrapped lines, the element style, the
 * pre-computed block / scrim / pill metrics. Used so we can group zones at
 * the same position and lay them out as a vertical stack without having to
 * re-do the font math twice.
 */
interface PreparedZone {
  zone: BuiltZone;
  style: ElementStyle;
  fontSize: number;
  lines: string[];
  lineHeight: number;
  blockHeight: number;   // text-only height (lines × lineHeight)
  scrimPadX: number;
  scrimPadY: number;
  pillPadX: number;
  pillPadY: number;
  pillW: number;
  pillH: number;
  /** Overall vertical footprint including scrim / pill padding. */
  footprint: number;
}

function prepareZone(canvas: { width: number; height: number }, z: BuiltZone): PreparedZone {
  const style = ELEMENT_STYLE[z.element];
  const fontSize = Math.round(canvas.height * style.sizeRatio);
  const maxLines =
    z.element === 'headline' ? 3 : z.element === 'body' ? 3 : z.element === 'subhead' ? 2 : 1;
  const lines = wrap(z.text, style.maxCharsPerLine, maxLines);
  const lineHeight = Math.round(fontSize * style.lineHeight);
  const blockHeight = lineHeight * lines.length;

  const scrimPadX = Math.round(fontSize * 0.5);
  const scrimPadY = Math.round(fontSize * 0.35);

  const pillPadX = Math.round(fontSize * 1.0);
  const pillPadY = Math.round(fontSize * 0.55);
  const widestChars = lines.reduce((acc, l) => Math.max(acc, l.length), 0);
  // 0.65 is a conservative avg-glyph-width ratio for Inter/Helvetica.
  // Under-estimating truncates the pill text on the right side; over-
  // estimating just makes the pill slightly wider than needed, which
  // looks intentional.
  const pillTextWidth = Math.round(widestChars * fontSize * 0.65);
  const pillW = pillTextWidth + pillPadX * 2;
  const pillH = blockHeight + pillPadY * 2;

  const footprint = style.pill ? pillH : blockHeight + scrimPadY * 2;

  return {
    zone: z,
    style,
    fontSize,
    lines,
    lineHeight,
    blockHeight,
    scrimPadX,
    scrimPadY,
    pillPadX,
    pillPadY,
    pillW,
    pillH,
    footprint,
  };
}

/** Element draw order within a stack — top to bottom when stacking down. */
const STACK_ORDER: Record<TextZone['element'], number> = {
  headline:   0,
  subhead:    1,
  body:       2,
  cta:        3,
  disclosure: 4,
};

function renderPrepared(
  parts: string[],
  canvas: { width: number; height: number },
  p: PreparedZone,
  blockTop: number,
  accent: string,
): void {
  const { zone: z, style, fontSize, lines, lineHeight, blockHeight } = p;

  const anchor =
    z.rect.align === 'center' ? 'middle' : z.rect.align === 'right' ? 'end' : 'start';
  const textX =
    z.rect.align === 'center'
      ? z.rect.x + Math.round(z.rect.w / 2)
      : z.rect.align === 'right'
        ? z.rect.x + z.rect.w
        : z.rect.x;

  if (style.pill) {
    // Position the pill so its outer edges sit relative to the rect anchor,
    // with a canvas-edge clamp so the pill never runs off the page.
    let pillX =
      z.rect.align === 'center'
        ? textX - Math.round(p.pillW / 2)
        : z.rect.align === 'right'
          ? textX - p.pillW
          : textX;

    const inset = Math.round(canvas.width * 0.015);
    const maxPillX = canvas.width - inset - p.pillW;
    const minPillX = inset;
    pillX = Math.max(minPillX, Math.min(pillX, maxPillX));

    // Place the text anchor INSIDE the pill with pillPadX on both sides.
    // For left-align the text starts at pillX + pillPadX; for right-align
    // it ends at pillX + pillW - pillPadX; for center it sits on the pill's
    // horizontal center. This gives the pill consistent breathing room
    // regardless of how the rect anchor was computed.
    const pillTextX =
      z.rect.align === 'center'
        ? pillX + Math.round(p.pillW / 2)
        : z.rect.align === 'right'
          ? pillX + p.pillW - p.pillPadX
          : pillX + p.pillPadX;

    const pillY = blockTop - p.pillPadY;
    const r = Math.round(p.pillH / 2);
    parts.push(
      `<rect x="${pillX}" y="${pillY}" width="${p.pillW}" height="${p.pillH}" rx="${r}" ry="${r}" fill="${accent}" />`,
    );
    lines.forEach((line, i) => {
      const y = blockTop + fontSize + i * lineHeight;
      parts.push(
        `<text x="${pillTextX}" y="${y}" text-anchor="${anchor}" font-family="${style.family}" font-size="${fontSize}" font-weight="${style.weight}" fill="#FFFFFF">${escapeXml(line)}</text>`,
      );
    });
  } else {
    const scrimX = Math.max(0, z.rect.x - p.scrimPadX);
    const scrimW = Math.min(canvas.width - scrimX, z.rect.w + p.scrimPadX * 2);
    const scrimY = Math.max(0, blockTop - p.scrimPadY);
    const scrimH = blockHeight + p.scrimPadY * 2;
    parts.push(
      `<rect x="${scrimX}" y="${scrimY}" width="${scrimW}" height="${scrimH}" rx="8" ry="8" fill="rgba(0,0,0,0.35)" />`,
    );
    lines.forEach((line, i) => {
      const y = blockTop + fontSize + i * lineHeight;
      parts.push(
        `<text x="${textX}" y="${y}" text-anchor="${anchor}" font-family="${style.family}" font-size="${fontSize}" font-weight="${style.weight}" fill="#FFFFFF">${escapeXml(line)}</text>`,
      );
    });
  }
}

function buildSvg(
  canvas: { width: number; height: number },
  zones: BuiltZone[],
  accent: string,
): string {
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">`,
  );

  // Group zones by abstract position. Two zones at the same position (e.g.
  // headline + subhead both "bottom-left") must stack, not overlap. CTAs
  // share the "bottom-right" niche so they do not usually collide, but the
  // logic is general.
  const groups = new Map<Position, BuiltZone[]>();
  for (const z of zones) {
    const list = groups.get(z.position) ?? [];
    list.push(z);
    groups.set(z.position, list);
  }

  for (const [, list] of groups) {
    // Sort so the stack order is intuitive: headline first, then subhead,
    // body, cta, disclosure. Same order regardless of how the spec listed them.
    list.sort((a, b) => STACK_ORDER[a.element] - STACK_ORDER[b.element]);

    const prepared = list.map((z) => prepareZone(canvas, z));
    const gap = Math.round(canvas.height * 0.012);
    const totalHeight =
      prepared.reduce((sum, p) => sum + p.footprint, 0) + gap * (prepared.length - 1);

    // Use the first zone's rect as the group's anchor (same position → same rect).
    const anchorRect = list[0].rect;
    let cursor: number;
    if (anchorRect.vAlign === 'top') {
      cursor = anchorRect.y;
    } else if (anchorRect.vAlign === 'middle') {
      cursor = anchorRect.y + Math.round((anchorRect.h - totalHeight) / 2);
    } else {
      // bottom: lift cursor so the group's bottom aligns with rect bottom.
      cursor = anchorRect.y + anchorRect.h - totalHeight;
    }

    for (const p of prepared) {
      // blockTop for text; scrim/pill offset from there inside renderPrepared.
      const blockTop = p.style.pill ? cursor + p.pillPadY : cursor + p.scrimPadY;
      renderPrepared(parts, canvas, p, blockTop, accent);
      cursor += p.footprint + gap;
    }
  }

  parts.push(`</svg>`);
  return parts.join('');
}

// ─── Zone resolution ────────────────────────────────────────────────────────

/**
 * Turn the visual stage's zone list into concrete (element, rect, text)
 * tuples. Empty texts are dropped. If a required zone (headline, cta) is
 * missing from the visual spec, we synthesize a sensible default placement
 * so at minimum the headline and CTA always land on the image.
 */
function resolveZones(
  textZones: TextZone[],
  copy: OverlayCopy,
  canvas: { width: number; height: number },
): BuiltZone[] {
  const texts: Record<TextZone['element'], string> = {
    headline:   copy.headline,
    subhead:    copy.subhead ?? '',
    body:       copy.body,
    cta:        copy.cta,
    disclosure: copy.disclosure ?? '',
  };

  const byElement = new Map<TextZone['element'], TextZone>();
  for (const z of textZones) byElement.set(z.element, z);

  const fallbackPosition: Record<TextZone['element'], Position> = {
    headline:   'bottom-left',
    subhead:    'bottom-left',
    body:       'bottom-left',
    cta:        'bottom-right',
    disclosure: 'bottom',
  };

  const result: BuiltZone[] = [];
  const elements: TextZone['element'][] = [
    'headline',
    'subhead',
    'body',
    'cta',
    'disclosure',
  ];

  for (const element of elements) {
    const text = texts[element];
    if (!text || !text.trim()) continue;

    // Body only overlays if the visual stage asked for it.
    if (element === 'body' && !byElement.has('body')) continue;
    // Subhead only overlays if visible in copy (already guaranteed by text check)
    // AND present in zones or alongside an overlaid headline.
    if (element === 'subhead' && !byElement.has('subhead')) continue;
    // Disclosure only if in zones — otherwise it lives in the caption.
    if (element === 'disclosure' && !byElement.has('disclosure')) continue;

    const position = byElement.get(element)?.position ?? fallbackPosition[element];
    result.push({
      element,
      text: text.trim(),
      rect: rectFor(position, canvas),
      position,
    });
  }
  return result;
}

// ─── Public entrypoint ─────────────────────────────────────────────────────

/**
 * Composite the ad copy onto the base image. Returns the overlayed PNG and
 * the count of zones actually rendered. Callers should treat this stage as
 * best-effort — wrap the call in try/catch and fall back to the raw image
 * if it throws.
 */
export async function composeOverlay(input: OverlayInput): Promise<OverlayOutput> {
  const baseSharp = sharp(input.imageBytes);
  const meta = await baseSharp.metadata();
  const canvas = {
    width:  meta.width  ?? ASPECT_CANVAS[input.aspectRatio].width,
    height: meta.height ?? ASPECT_CANVAS[input.aspectRatio].height,
  };

  const zones = resolveZones(input.textZones, input.copy, canvas);
  if (zones.length === 0) {
    // Nothing to overlay — re-encode as PNG for consistent output mime.
    const png = await baseSharp.png().toBuffer();
    return { imageBytes: png, mimeType: 'image/png', zonesRendered: 0 };
  }

  const accent = pickAccent(input.palette);
  const svg = buildSvg(canvas, zones, accent);

  const output = await baseSharp
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();

  return { imageBytes: output, mimeType: 'image/png', zonesRendered: zones.length };
}
