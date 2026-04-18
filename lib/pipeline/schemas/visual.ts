/**
 * Visual stage — zod schemas.
 *
 * Stage 4 of the pipeline. Turns a selected concept (optionally paired with
 * a copy block for text placement) into a structured visual spec + an
 * assembled prompt string that goes to the image provider.
 *
 * Shapes here:
 *   - VisualStageInput:  runner-facing input (aspect ratio + alternate count)
 *   - VisualStructured:  what Claude returns, persisted in visual_specs.structured
 */

import { z } from 'zod';

// ─── Aspect ratio (matches lib/image-providers/types GenerateParams) ────────

export const AspectRatio = z.enum(['1:1', '4:5', '9:16', '16:9', '3:4']);
export type AspectRatio = z.infer<typeof AspectRatio>;

// ─── Input ──────────────────────────────────────────────────────────────────

export const VisualStageInput = z.object({
  /** Image aspect ratio. 4:5 is the feed-friendly default (Instagram). */
  aspect_ratio: AspectRatio.default('4:5'),
});

export type VisualStageInput = z.infer<typeof VisualStageInput>;

// ─── Output ─────────────────────────────────────────────────────────────────

/**
 * A region on the image reserved for overlaid text. We give the image model
 * a specific keep-clear area so the headline + CTA don't collide with the
 * subject. Positions are abstract — "top", "bottom-right" — not pixel coords;
 * the rendering model interprets them.
 */
export const TextZone = z.object({
  /**
   * Which copy element sits here. 'body' is included for layouts where the
   * body copy is overlaid on the image (common in stat-led and
   * social-proof concepts); otherwise body lives in the feed caption and
   * no zone is needed for it.
   */
  element: z.enum(['headline', 'subhead', 'body', 'cta', 'disclosure']),
  /** Abstract position for the clear area. */
  position: z.enum([
    'top',
    'top-left',
    'top-right',
    'center',
    'bottom',
    'bottom-left',
    'bottom-right',
  ]),
  /** The literal text (mirrored from the copy block) for traceability. */
  text: z.string().min(1),
});

export type TextZone = z.infer<typeof TextZone>;

export const VisualStructured = z.object({
  schema_version: z.literal('1'),

  /** One-line framing — what the image IS at the highest level. */
  scene: z.string().min(1).max(400),

  /** Who / what is the foreground subject. */
  subject: z.string().min(1).max(400),

  /** Environment / location / props. */
  setting: z.string().min(1).max(400),

  /** Lighting + mood (e.g. "soft morning daylight, quiet, introspective"). */
  lighting_mood: z.string().min(1).max(300),

  /** Photographic or illustrative style cues (e.g. "editorial photography, natural textures"). */
  style: z.string().min(1).max(300),

  /** Palette as named colors (pulled from brand.visual where applicable). */
  palette: z.array(z.string()).min(1).max(8),

  /** Composition notes (rule of thirds, negative space, etc.). */
  composition: z.string().min(1).max(400),

  /** Where overlaid text sits (keep-clear zones). */
  text_zones: z.array(TextZone).min(0).max(4).default([]),

  /** Hard "don'ts" derived from brand non_negotiables + wellness category. */
  negative_prompts: z.array(z.string()).default([]),

  /**
   * The fully-assembled prompt string handed to the image provider. The
   * stage lifts this into visual_specs.prompt_text so the render stage can
   * use it directly without walking the structured tree.
   */
  prompt_text: z.string().min(20),

  /** Mirror of the aspect_ratio input for traceability. */
  aspect_ratio: AspectRatio,
});

export type VisualStructured = z.infer<typeof VisualStructured>;
