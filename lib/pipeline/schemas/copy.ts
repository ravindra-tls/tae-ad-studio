/**
 * Copy stage — zod schemas.
 *
 * Stage 3 of the pipeline. Given a selected concept (from checkpoint 2),
 * Claude produces the actual ad copy — headline, subhead, supporting body,
 * CTA, plus a few headline alternates for downstream A/B choice.
 *
 * Shapes here:
 *   - CopyStageInput:    runner-facing input shape (IDs + full records)
 *   - CopyStructured:    what Claude returns, persisted in copy_blocks.structured
 */

import { z } from 'zod';

// ─── Input ───────────────────────────────────────────────────────────────────

export const CopyStageInput = z.object({
  /**
   * Number of headline alternates to request ON TOP OF the primary headline.
   * 2-3 is the sweet spot: enough to A/B, not enough to balloon cost.
   */
  alternates: z.number().int().min(0).max(5).default(3),
});

export type CopyStageInput = z.infer<typeof CopyStageInput>;

// ─── Output (what Claude must return) ────────────────────────────────────────

/**
 * A single headline candidate. We keep the primary + alternates structurally
 * identical so the UI can let marketers promote an alternate to primary
 * without reshaping the data.
 */
export const CopyHeadline = z.object({
  /**
   * The headline itself. Short, on-image text. Strictly ≤ 10 words so it
   * reads at thumbnail size in feed.
   */
  text: z.string().min(1).max(120),

  /**
   * Why this headline — what angle it leans on / which pain or proof point.
   * Handy for eval + for the UI to explain the selection.
   */
  rationale: z.string().min(1).max(400),
});

export type CopyHeadline = z.infer<typeof CopyHeadline>;

export const CopyStructured = z.object({
  schema_version: z.literal('1'),

  /** Primary headline — the one the visual/render stages use by default. */
  headline: CopyHeadline,

  /** 0..N alternate headlines for A/B. Caller controls count. */
  headline_alternates: z.array(CopyHeadline).default([]),

  /**
   * Optional one-line subhead that sits under the headline. Not every ad
   * needs one — some concepts want a single big hook. Null when omitted.
   */
  subhead: z.string().max(200).nullable().default(null),

  /**
   * Supporting body copy. 1-2 sentences max. Lives in the caption area or,
   * for static social creatives, below the image when the ad is rendered.
   */
  body: z.string().min(1).max(500),

  /** On-image / on-button CTA phrase. Short and imperative. */
  cta: z.string().min(1).max(60),

  /**
   * Optional disclosure / legal line — only populate when a claim demands it
   * (e.g. "Results vary", "Not for use during pregnancy"). Null otherwise.
   */
  disclosure: z.string().max(300).nullable().default(null),

  /**
   * Exact pains + proof_points from the brief this copy leans on. Mirror of
   * concept.leaning_on — lets eval traceability join copy → concept → brief.
   */
  leaning_on: z
    .object({
      pains:        z.array(z.string()).default([]),
      proof_points: z.array(z.string()).default([]),
    })
    .default({ pains: [], proof_points: [] }),
});

export type CopyStructured = z.infer<typeof CopyStructured>;
