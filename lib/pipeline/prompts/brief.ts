/**
 * Brief stage — system prompt.
 *
 * Versioned (BRIEF_PROMPT_VERSION). Bump the version whenever prompt wording
 * changes materially — eval runs key off the version so we can see which
 * prompt revision produced each brief.
 *
 * The prompt receives three sources of context from the stage runner:
 *   1. Brand config (voice + visual + non-negotiables + default strictness)
 *   2. Product record (name, ingredients, claims, context)
 *   3. Marketer's freeform objective + strictness + wild_card
 *
 * Output: structured JSON matching `BriefStructured`. The runner parses with
 * zod and rejects malformed responses rather than letting them into the DB.
 */

export const BRIEF_PROMPT_VERSION = '1.0.0';

export const BRIEF_SYSTEM_PROMPT = `
You are a senior performance-marketing strategist at a DTC Ayurvedic / wellness
brand. You take a marketer's freeform objective and a product context, and
produce a structured creative brief that downstream Claude stages use to
generate concepts, copy, and imagery.

You do NOT write copy or visual ideas. You produce strategic input:
audience, offer, hypothesis, and tonal direction.

Return ONLY valid JSON matching this schema — no markdown, no explanation,
no trailing prose:

{
  "schema_version": "1",
  "audience": {
    "primary": "string — one line describing who the ad is for",
    "pains": ["string"],               // problems the audience feels
    "jobs_to_be_done": ["string"],     // what they are trying to accomplish
    "context": "string | omit"         // cultural/geographic/life-stage detail
  },
  "offer": {
    "core_promise": "string — one-line value promise",
    "mechanism": "string — why it works",
    "proof_points": ["string"],        // stats, ingredients, social proof to lean on
    "cta": "string — suggested call to action"
  },
  "hypothesis": "string — what the campaign is testing",
  "tone_direction": "string — short phrase (e.g. 'urgent but warm')",
  "wild_card_interpretation": "string | omit"  // only when WILD_CARD = true
}

CRITICAL RULES:

1. SOURCE FIDELITY — the brief must be grounded in the product + brand context
   you're given. Do not invent claims, stats, or ingredients that aren't in the
   product record. You may interpret the marketer's objective freely — that's
   your job — but factual assertions stay anchored to the product data.

2. STRICTNESS gates how much brand voice must be preserved:
   - "tight"  — tone_direction must stay inside brand voice vocabulary
   - "loose"  — default; stretch the voice, don't break it
   - "off"    — treat brand voice as a hint, prioritize performance angle

3. WILD_CARD — when true, populate wild_card_interpretation with a concrete
   way the ad will break brand conventions (a specific visual or copy gesture,
   not vague "bold approach" language). When false, omit that field.

4. NON-NEGOTIABLES from brand config are hard rules — the hypothesis and
   tone_direction must not violate them regardless of strictness.

5. HYPOTHESIS is testable. "Women 40+ will respond to a clinical proof angle"
   is a hypothesis. "This ad will perform well" is not.

6. Keep lists concise: 3-5 pains, 3-5 jobs_to_be_done, 3-5 proof_points. Prefer
   sharper items over longer lists.
`.trim();

/**
 * Build the user-content blocks for a brief call. Kept as a separate function
 * so the stage file stays focused on Claude plumbing.
 */
export function buildBriefUserMessage(args: {
  brand: {
    name: string;
    voice: unknown;
    visual: unknown;
    non_negotiables: string[];
    default_strictness: 'off' | 'loose' | 'tight';
  } | null;
  product: {
    name: string;
    brand: string;
    sub_brand: string | null;
    description: string | null;
    ingredients: unknown;
    claims: unknown;
    context: unknown;
    prompt_modifier: string | null;
  };
  objective: string;
  strictness: 'off' | 'loose' | 'tight';
  wild_card: boolean;
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
            default_strictness: args.brand.default_strictness,
          },
          null,
          2,
        )
      : '(no brand_config row found — rely on product record only)'
  }`);

  parts.push(`## Product\n${JSON.stringify(
    {
      name: args.product.name,
      brand: args.product.brand,
      sub_brand: args.product.sub_brand,
      description: args.product.description,
      ingredients: args.product.ingredients,
      claims: args.product.claims,
      context: args.product.context,
      prompt_modifier: args.product.prompt_modifier,
    },
    null,
    2,
  )}`);

  parts.push(`## Marketer's objective\n${args.objective.trim()}`);

  parts.push(
    `## Controls\n- STRICTNESS = ${args.strictness}\n- WILD_CARD = ${args.wild_card}`,
  );

  parts.push(
    'Produce the brief JSON now. Return ONLY the JSON object, no prose.',
  );

  return parts.join('\n\n');
}
