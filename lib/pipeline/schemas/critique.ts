/**
 * Critique stage — zod schemas.
 *
 * Stage 6 of the pipeline. Claude acts as an adversarial reviewer on the
 * assembled bundle (brief + concept + copy + visual spec) and returns:
 *   - a top-level verdict: pass | refine | reject
 *   - per-axis notes (brand, concept, copy, visual)
 *   - refine_targets: for verdict=refine, which stage to re-run and what
 *     specifically to change. The orchestrator reads this to drive one
 *     bounded refinement pass.
 *
 * Design note: verdict=reject is rare (fundamental concept is off). In V1
 * we do NOT auto-re-run the concept stage on reject — we surface it to the
 * marketer and let them pick another concept at checkpoint 2. Only 'refine'
 * triggers the automated refine loop.
 */

import { z } from 'zod';

export const CritiqueStageInput = z.object({
  /** Extra free-form guidance for the judge (optional). */
  judge_notes: z.string().max(2000).optional(),
});

export type CritiqueStageInput = z.infer<typeof CritiqueStageInput>;

/** Per-axis critique — short verdict string + actionable note. */
export const AxisCritique = z.object({
  /** One-word summary: strong | ok | weak. Drives UI coloring. */
  rating: z.enum(['strong', 'ok', 'weak']),
  /** One-sentence assessment. */
  note: z.string().min(1).max(400),
});
export type AxisCritique = z.infer<typeof AxisCritique>;

/**
 * When the judge says "refine", each RefineTarget names a stage to re-run
 * and the specific instruction the re-run should address. The orchestrator
 * picks the first target (V1 = one bounded refinement, one stage).
 */
export const RefineTarget = z.object({
  stage: z.enum(['copy', 'visual']),
  /** Concrete instruction. "Tighten headline to under 8 words" beats "improve headline". */
  instruction: z.string().min(1).max(600),
});
export type RefineTarget = z.infer<typeof RefineTarget>;

export const CritiqueStructured = z.object({
  schema_version: z.literal('1'),

  /**
   * Top-level verdict:
   *  - 'pass'   — ship it
   *  - 'refine' — re-run one stage with refine_targets guidance
   *  - 'reject' — concept is fundamentally off; surface to user
   */
  verdict: z.enum(['pass', 'refine', 'reject']),

  /** Per-axis critique. */
  axes: z.object({
    brand:   AxisCritique,
    concept: AxisCritique,
    copy:    AxisCritique,
    visual:  AxisCritique,
  }),

  /** Populated when verdict = 'refine'. Empty otherwise. */
  refine_targets: z.array(RefineTarget).default([]),

  /** One-paragraph overall summary — what the judge saw. */
  summary: z.string().min(1).max(800),
});

export type CritiqueStructured = z.infer<typeof CritiqueStructured>;
