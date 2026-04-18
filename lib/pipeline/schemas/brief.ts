/**
 * Brief stage — zod schemas.
 *
 * Two schemas live here:
 *   - BriefStageInput: the inputs we hand the stage (objective text, strictness,
 *     wild_card flag, source type). Shaped by what the UI collects from the
 *     marketer at session start.
 *   - BriefStructured: the JSON shape we demand back from Claude. This lands
 *     in briefs.structured verbatim, and select fields are denormalized into
 *     briefs.audience / briefs.offer / briefs.hypothesis for easy querying.
 *
 * Schema is version-tagged so future shape evolution doesn't silently corrupt
 * older rows — downstream stages branch on schema_version when reading.
 */

import { z } from 'zod';

// ─── Input ───────────────────────────────────────────────────────────────────

export const BriefStageInput = z.object({
  /** Freeform marketer input: what are they trying to achieve this session. */
  objective: z.string().min(1).max(4000),

  /** How tightly to hold the brand voice. "loose" is the default. */
  strictness: z.enum(['off', 'loose', 'tight']).default('loose'),

  /** Off-brand / experimental mode toggle. */
  wild_card: z.boolean().default(false),

  /** How the objective was collected. Only 'freeform' is wired in V1. */
  source: z.enum(['quiz', 'freeform', 'imported']).default('freeform'),
});

export type BriefStageInput = z.infer<typeof BriefStageInput>;

// ─── Output (structured JSON Claude must return) ─────────────────────────────

export const BriefAudience = z.object({
  primary: z.string().describe('One-line description of the primary audience'),
  pains: z.array(z.string()).default([]),
  jobs_to_be_done: z.array(z.string()).default([]),
  context: z.string().optional().describe('Cultural, geographic, life-stage detail'),
});

export const BriefOffer = z.object({
  core_promise: z.string().describe('One-line value promise'),
  mechanism: z.string().describe('Why it works — the reason to believe'),
  proof_points: z.array(z.string()).default([]),
  cta: z.string().describe('Suggested call to action phrase'),
});

export const BriefStructured = z.object({
  schema_version: z.literal('1'),
  audience: BriefAudience,
  offer: BriefOffer,
  hypothesis: z.string().describe('What the campaign is testing / the marketer believes'),
  tone_direction: z.string().describe('Short phrase capturing the intended emotional register'),
  wild_card_interpretation: z
    .string()
    .optional()
    .describe('Populated only when wild_card=true: how to subvert brand conventions'),
});

export type BriefStructured = z.infer<typeof BriefStructured>;
export type BriefAudience = z.infer<typeof BriefAudience>;
export type BriefOffer = z.infer<typeof BriefOffer>;
