/**
 * Critique stage — system prompts.
 *
 * Two prompts live here:
 *   - CRITIQUE_SYSTEM_PROMPT: adversarial reviewer that assesses the bundle
 *     (brief + concept + copy + visual spec) and returns a structured
 *     critique with a verdict.
 *   - REFINE_COPY_SYSTEM_PROMPT: re-runs the copy stage with critique
 *     guidance, keeping everything else constant. Output schema matches the
 *     copy stage output exactly (so the refined copy is drop-in).
 *   - REFINE_VISUAL_SYSTEM_PROMPT: re-runs the visual stage with critique
 *     guidance, keeping everything else constant. Output matches visual stage.
 *
 * Versioned (CRITIQUE_PROMPT_VERSION). Bump on material prompt changes.
 */

export const CRITIQUE_PROMPT_VERSION = '1.0.0';

export const CRITIQUE_SYSTEM_PROMPT = `
You are a senior creative director reviewing an assembled ad bundle before it
ships. Your job is adversarial: find what's weak, specifically, so the team
can fix it. You do NOT re-write. You judge, and you say where.

You are given the complete bundle:
  - The brief (audience + offer + hypothesis + tone)
  - The selected concept (angle + hook archetype + visual_direction)
  - The copy (headline + alternates + subhead + body + CTA)
  - The visual spec (scene + subject + palette + text_zones + prompt_text)
  - The brand context + non_negotiables

Return ONLY valid JSON matching this schema — no markdown, no prose:

{
  "schema_version": "1",
  "verdict": "pass" | "refine" | "reject",
  "axes": {
    "brand":   { "rating": "strong" | "ok" | "weak", "note": "string" },
    "concept": { "rating": "strong" | "ok" | "weak", "note": "string" },
    "copy":    { "rating": "strong" | "ok" | "weak", "note": "string" },
    "visual":  { "rating": "strong" | "ok" | "weak", "note": "string" }
  },
  "refine_targets": [
    { "stage": "copy" | "visual", "instruction": "string — concrete change to make" }
  ],
  "summary": "string — one paragraph, what you see"
}

VERDICT RULES:

- "pass" — all four axes rate at least 'ok'; the bundle is shippable as-is.
  refine_targets MUST be empty.
- "refine" — at least one axis is 'weak' and the fix is mechanical (a copy
  rewrite or a visual tweak). Populate refine_targets with the MINIMUM
  stages needed — usually just one. V1 runs at most one refine pass.
- "reject" — the concept itself is fundamentally off for the brief
  (wrong audience, contradicts the offer, violates a hard non-negotiable).
  Not a copy/visual fix. refine_targets MUST be empty. This is rare —
  only use when the marketer should pick a different concept.

AXIS RUBRIC:

- brand   — Does every visible element (copy tone, palette, scene) fit the
  brand voice + visual + non_negotiables? "weak" when a hype word slips
  through or palette clashes; "strong" when voice feels native.
- concept — Does the copy + visual execute the concept, or drift? A
  'stat_led_authority' concept with no numbers in copy = weak. A
  'before_after' concept whose visual doesn't split = weak.
- copy    — Headline clarity + specificity + feed-readability; body
  earns attention; CTA is imperative. Weak = vague adjectives, overlong,
  no specificity.
- visual  — Does the spec produce an image that lands with the audience
  and leaves clean text zones? Weak = stock-y, clutter, text conflicts.

REFINE_TARGETS RULES:

- When verdict is 'refine', every weak axis must have at least one target
  (or be fixable by the targets you list). Don't leave weak axes unaddressed.
- Instructions must be concrete and mechanical. Good: "Shorten headline to
  ≤ 7 words; lead with the 600mg number." Bad: "Improve the headline."
- Prefer ONE target. Two is the ceiling.
- Never target 'brief' or 'concept' — those are upstream of refine scope.
`.trim();

export function buildCritiqueUserMessage(args: {
  brand: {
    name: string;
    voice: unknown;
    visual: unknown;
    non_negotiables: string[];
  } | null;
  product: {
    name: string;
    brand: string;
    sub_brand: string | null;
    ingredients: unknown;
    claims: unknown;
    context: unknown;
  };
  brief: {
    objective: string | null;
    structured: unknown;
    strictness: 'off' | 'loose' | 'tight';
    wild_card: boolean;
  };
  concept: unknown;
  copy: unknown;
  visual: unknown;
  judge_notes?: string;
}): string {
  const parts: string[] = [];

  parts.push(`## Brand context\n${
    args.brand
      ? JSON.stringify(
          {
            name: args.brand.name,
            voice: args.brand.voice,
            visual: args.brand.visual,
            non_negotiables: args.brand.non_negotiables,
          },
          null,
          2,
        )
      : '(no brand_config row — fall back to product record)'
  }`);

  parts.push(`## Product\n${JSON.stringify(args.product, null, 2)}`);

  parts.push(`## Brief\n${JSON.stringify(
    { objective: args.brief.objective, structured: args.brief.structured },
    null,
    2,
  )}`);

  parts.push(`## Concept\n${JSON.stringify(args.concept, null, 2)}`);

  parts.push(`## Copy\n${JSON.stringify(args.copy, null, 2)}`);

  parts.push(`## Visual spec\n${JSON.stringify(args.visual, null, 2)}`);

  parts.push(
    `## Controls\n- STRICTNESS = ${args.brief.strictness}\n- WILD_CARD = ${args.brief.wild_card}`,
  );

  if (args.judge_notes) {
    parts.push(`## Extra judge notes\n${args.judge_notes}`);
  }

  parts.push('Produce the critique JSON now. Return ONLY the JSON object.');

  return parts.join('\n\n');
}

// ─── Refine prompts ─────────────────────────────────────────────────────────
//
// Refine prompts re-use the original copy / visual output schemas but carry
// critique guidance so the model knows WHAT to fix without drifting on
// upstream decisions (brief, concept).

export const REFINE_COPY_SYSTEM_PROMPT = `
You are the same DTC copywriter from earlier. A creative director reviewed
your last copy and flagged specific issues. Your job is to re-output the
copy with those issues addressed — same concept, same brief, same brand.
Do not rewrite from scratch; keep what works, fix what was flagged.

Return ONLY valid JSON matching the SAME copy schema you used before:

{
  "schema_version": "1",
  "headline": { "text": "string", "rationale": "string" },
  "headline_alternates": [{ "text": "string", "rationale": "string" }],
  "subhead": "string or null",
  "body": "string",
  "cta": "string",
  "disclosure": "string or null",
  "leaning_on": { "pains": ["string"], "proof_points": ["string"] }
}

Rules:

- Address the critic's instructions literally. If they say "tighten headline
  to under 8 words", the new headline must be under 8 words.
- Keep the concept's hook_archetype and angle. Don't drift to a different
  concept.
- Alternates should still be structurally different from the primary and
  from each other — address the critic's feedback across alternates too.
- All other copy rules from the original system prompt still apply
  (Indian English default, imperative CTA ≤ 4 words, no hype adjectives,
  etc.).
`.trim();

export function buildRefineCopyUserMessage(args: {
  brand: {
    name: string;
    voice: unknown;
    visual: unknown;
    non_negotiables: string[];
  } | null;
  product: {
    name: string;
    brand: string;
    sub_brand: string | null;
    ingredients: unknown;
    claims: unknown;
    context: unknown;
  };
  brief: {
    objective: string | null;
    structured: unknown;
    strictness: 'off' | 'loose' | 'tight';
    wild_card: boolean;
  };
  concept: unknown;
  previous_copy: unknown;
  instruction: string;
  alternates: number;
}): string {
  const parts: string[] = [];

  parts.push(`## Brand context\n${
    args.brand
      ? JSON.stringify(
          {
            name: args.brand.name,
            voice: args.brand.voice,
            visual: args.brand.visual,
            non_negotiables: args.brand.non_negotiables,
          },
          null,
          2,
        )
      : '(no brand_config row — fall back to product record)'
  }`);

  parts.push(`## Product\n${JSON.stringify(args.product, null, 2)}`);

  parts.push(`## Brief\n${JSON.stringify(
    { objective: args.brief.objective, structured: args.brief.structured },
    null,
    2,
  )}`);

  parts.push(`## Concept (don't drift from this)\n${JSON.stringify(args.concept, null, 2)}`);

  parts.push(`## Your previous copy (before refine)\n${JSON.stringify(args.previous_copy, null, 2)}`);

  parts.push(`## Critic's instruction (the fix to make)\n${args.instruction}`);

  parts.push(
    `## Controls\n- ALTERNATES = ${args.alternates}\n- STRICTNESS = ${args.brief.strictness}\n- WILD_CARD = ${args.brief.wild_card}`,
  );

  parts.push(
    `Produce the refined copy JSON now with ${args.alternates} alternates. Return ONLY the JSON object.`,
  );

  return parts.join('\n\n');
}

export const REFINE_VISUAL_SYSTEM_PROMPT = `
You are the same art director from earlier. A creative director reviewed
your last visual spec and flagged specific issues. Re-output the spec with
those issues addressed — same concept, same brief, same brand, same copy.

Return ONLY valid JSON matching the SAME visual schema you used before:

{
  "schema_version": "1",
  "scene": "string",
  "subject": "string",
  "setting": "string",
  "lighting_mood": "string",
  "style": "string",
  "palette": ["string"],
  "composition": "string",
  "text_zones": [{ "element": "...", "position": "...", "text": "..." }],
  "negative_prompts": ["string"],
  "prompt_text": "string",
  "aspect_ratio": "1:1" | "4:5" | "9:16" | "16:9" | "3:4"
}

Rules:

- Address the critic's instruction literally. If they say "swap split
  composition for single hero", the new composition must be single hero.
- Keep the aspect_ratio from the previous spec (echo it back).
- text_zones must still mirror the copy_block's literal text and include
  a zone for every existing copy element.
- All other visual rules still apply (negatives include "no text rendered
  in image", prompt_text follows what-before-how structure, 80-180 words).
`.trim();

export function buildRefineVisualUserMessage(args: {
  brand: {
    name: string;
    voice: unknown;
    visual: unknown;
    non_negotiables: string[];
  } | null;
  product: {
    name: string;
    brand: string;
    sub_brand: string | null;
    ingredients: unknown;
    claims: unknown;
    context: unknown;
  };
  brief: {
    objective: string | null;
    structured: unknown;
    strictness: 'off' | 'loose' | 'tight';
    wild_card: boolean;
  };
  concept: unknown;
  copy: unknown;
  previous_visual: unknown;
  instruction: string;
  aspect_ratio: '1:1' | '4:5' | '9:16' | '16:9' | '3:4';
}): string {
  const parts: string[] = [];

  parts.push(`## Brand context\n${
    args.brand
      ? JSON.stringify(
          {
            name: args.brand.name,
            voice: args.brand.voice,
            visual: args.brand.visual,
            non_negotiables: args.brand.non_negotiables,
          },
          null,
          2,
        )
      : '(no brand_config row — fall back to product record)'
  }`);

  parts.push(`## Product\n${JSON.stringify(args.product, null, 2)}`);

  parts.push(`## Brief\n${JSON.stringify(
    { objective: args.brief.objective, structured: args.brief.structured },
    null,
    2,
  )}`);

  parts.push(`## Concept (don't drift)\n${JSON.stringify(args.concept, null, 2)}`);

  parts.push(`## Copy (overlay these texts)\n${JSON.stringify(args.copy, null, 2)}`);

  parts.push(`## Your previous visual spec\n${JSON.stringify(args.previous_visual, null, 2)}`);

  parts.push(`## Critic's instruction\n${args.instruction}`);

  parts.push(
    `## Controls\n- ASPECT_RATIO = ${args.aspect_ratio}\n- STRICTNESS = ${args.brief.strictness}\n- WILD_CARD = ${args.brief.wild_card}`,
  );

  parts.push(
    `Produce the refined visual spec JSON now. Set aspect_ratio to "${args.aspect_ratio}". Return ONLY the JSON object.`,
  );

  return parts.join('\n\n');
}
