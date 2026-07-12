/**
 * Concept Forge model tiers. Swap centrally here.
 *
 * generator — fast, cheap: high-volume candidate generation AND the judge
 *             (the judge deliberately runs on the generator model at temp 0;
 *             the rubric is explicit enough to apply consistently).
 * sonnet    — stronger: director (chat), refine, deck distillation.
 * opus      — strongest: champion polish, refine-champion, export fills,
 *             insight mining. NOTE: Opus rejects the temperature param —
 *             lib/forge/anthropic.ts strips it centrally.
 */
export const MODELS = {
  generator: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-6',
  opus: 'claude-opus-4-8',
} as const;

/** Temperatures by role. Others omit temperature entirely. */
export const TEMPS = {
  generator: 1,
  judge: 0,
} as const;
