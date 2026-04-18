/**
 * Concept stage — zod schemas.
 *
 * Concept is stage 2 of the pipeline. Given an approved brief, Claude
 * proposes 3–5 candidate creative directions. The stage runs a sameness
 * pass on the concept JSON (never on rendered images) and regenerates any
 * duplicates before returning.
 *
 * Shapes:
 *   - ConceptStageInput:    runner-facing inputs (brief + product + brand)
 *   - ConceptStructured:    one concept's JSON shape (persisted in concepts.structured)
 *   - ConceptBatchOutput:   Claude's top-level response (array of concepts)
 *   - SamenessVerdict:      sameness-judge output (pass or indices to regenerate)
 */

import { z } from 'zod';

// ─── Input ───────────────────────────────────────────────────────────────────

export const ConceptStageInput = z.object({
  /** How many concepts to generate. Plan calls for 3–5. */
  count: z.number().int().min(3).max(5).default(4),
});

export type ConceptStageInput = z.infer<typeof ConceptStageInput>;

// ─── Single concept (persisted shape) ────────────────────────────────────────

export const ConceptStructured = z.object({
  schema_version: z.literal('1'),

  /** Short headline for the concept card. */
  title: z.string().min(1).max(120),

  /**
   * Free-form hook archetype label. Left open in V1 so patterns can emerge
   * before we lock an enum. Examples: "before_after", "testimonial_native",
   * "stat_led_authority", "problem_agitation", "lifestyle_aspiration".
   */
  hook_archetype: z.string().min(1).max(60),

  /** One-paragraph rationale — why this direction, who it lands with. */
  description: z.string().min(1).max(800),

  /** How the image should feel. Not a full visual spec yet (that's stage 4). */
  visual_direction: z.string().min(1).max(600),

  /** Sketch of what the copy does (angle, not full headlines yet). */
  copy_direction: z.string().min(1).max(600),

  /** Pull points from the brief this concept leans on — for traceability. */
  leaning_on: z
    .object({
      pains:         z.array(z.string()).default([]),
      proof_points:  z.array(z.string()).default([]),
    })
    .default({ pains: [], proof_points: [] }),
});

export type ConceptStructured = z.infer<typeof ConceptStructured>;

// ─── Batch (Claude's top-level response on first call) ───────────────────────

export const ConceptBatchOutput = z.object({
  concepts: z.array(ConceptStructured).min(3).max(5),
});

export type ConceptBatchOutput = z.infer<typeof ConceptBatchOutput>;

// ─── Sameness judge verdict ──────────────────────────────────────────────────
//
// We ask Claude: "are any of these structurally too similar to each other?"
// Response is either `pass` (ship all) or a list of 0-based indices that
// should be regenerated, with a reason per index for the regen prompt.

export const SamenessRegenerateItem = z.object({
  index: z.number().int().min(0),
  reason: z.string().min(1).max(400),
});

export const SamenessVerdict = z.discriminatedUnion('status', [
  z.object({ status: z.literal('pass') }),
  z.object({
    status: z.literal('regenerate'),
    items:  z.array(SamenessRegenerateItem).min(1),
  }),
]);

export type SamenessVerdict = z.infer<typeof SamenessVerdict>;

// ─── Per-index replacement (Claude response on regen) ────────────────────────
//
// When sameness flags specific concepts, we ask Claude to produce REPLACEMENT
// concepts for just those indices — keeping the good ones intact. Claude
// returns an array where each entry carries its target_index + the new
// concept JSON. The stage splices these back into the batch at the specified
// positions.

export const ConceptReplacementItem = z.object({
  target_index: z.number().int().min(0).max(4),
  concept: ConceptStructured,
});

export const ConceptReplacementBatch = z.object({
  replacements: z.array(ConceptReplacementItem).min(1).max(5),
});

export type ConceptReplacementBatch = z.infer<typeof ConceptReplacementBatch>;
