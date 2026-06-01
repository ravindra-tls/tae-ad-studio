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

export const BRIEF_PROMPT_VERSION = '1.1.0';

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

7. FUNNEL STAGE — when FUNNEL_STAGE is specified, it governs the entire brief:
   - "tofu": Cold audience who has never heard of this brand. Hypothesis must test an awareness or emotion angle. offer.cta MUST be "read the story", "learn more", or similar — never "shop now". tone_direction: empathy-first, broad hook, curiosity-driven.
   - "mofu": Category-aware but uncommitted prospect. Hypothesis tests a trust or proof angle. Proof points, comparison, and credibility are the primary lever. offer.cta: "read the story", "see how it works", "watch the video". tone_direction: warm-credible, evidence-led.
   - "bofu": Warm retargeting audience with purchase intent. Hypothesis tests an urgency or offer angle. offer.cta MUST be "shop now", "claim your offer", or "get yours today". tone_direction: urgent, personal, direct.

8. NARRATIVE BRIEF — when a SELECTED_PERSONA section is present, add a "narrative_brief" field to your JSON output. This is a 2-4 sentence prose brief in the voice of a creative director briefing a designer. It must name the persona archetype, describe her emotional reality in one sentence, state the creative direction clearly, and end with the CTA direction. Write it in plain English. Do not use marketing jargon. If no SELECTED_PERSONA is given, omit this field entirely.
`.trim();

/**
 * Build the user-content blocks for a brief call. Kept as a separate function
 * so the stage file stays focused on Claude plumbing.
 */
export function buildBriefUserMessage(args: {
  research_context?: import('@/lib/research/types').PositioningResearch | null;
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
  funnel_stage?: 'tofu' | 'mofu' | 'bofu';
  persona_name?: string;
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

  // ── Audience research context (optional) ──────────────────────────────────
  // When a PositioningResearch document exists for this product, inject the
  // most relevant parts to ground the brief in real audience intelligence.
  if (args.research_context) {
    const r = args.research_context;
    const researchParts: string[] = [];

    researchParts.push(
      `### Executive summary\n${r.executive_summary}`,
    );

    if (r.personas.length > 0) {
      const personaSummaries = r.personas
        .map(
          (p) =>
            `**${p.archetype_name}** (${p.age_range}, ${p.location})\n` +
            `Tagline: ${p.tagline}\n` +
            `Deepest fears: ${p.deepest_fears.slice(0, 3).join('; ')}\n` +
            `Deepest desires: ${p.deepest_desires.slice(0, 3).join('; ')}\n` +
            `Emotional triggers: ${p.emotional_triggers.map((t) => `${t.label} — ${t.description}`).join(' | ')}`,
        )
        .join('\n\n');
      researchParts.push(`### Personas\n${personaSummaries}`);
    }

    if (r.emotional_landscape.universal_turn_offs.length > 0) {
      researchParts.push(
        `### Universal turn-offs (never do)\n${r.emotional_landscape.universal_turn_offs.join('\n')}`,
      );
    }

    if (r.language_guide.words_she_uses.length > 0) {
      researchParts.push(
        `### Her language (use these words)\n${r.language_guide.words_she_uses.join(', ')}`,
      );
    }

    if (Object.keys(r.messaging_framework).length > 0) {
      const frameworkLines = Object.entries(r.messaging_framework)
        .map(([persona, approach]) => `- **${persona}:** ${approach}`)
        .join('\n');
      researchParts.push(`### Messaging framework by persona\n${frameworkLines}`);
    }

    parts.push(
      `## Audience research context\n` +
        `This research is drawn from real audience data for ${r.product_name} in the ${r.market} market ` +
        `(segment: ${r.segment}). Use it to ground your brief in authentic audience intelligence — ` +
        `but your brief must still be shaped by the marketer's objective above.\n\n` +
        researchParts.join('\n\n'),
    );
  }
  // ─────────────────────────────────────────────────────────────────────────

  parts.push(
    `## Controls\n- STRICTNESS = ${args.strictness}\n- WILD_CARD = ${args.wild_card}`,
  );

  if (args.funnel_stage) {
    parts.push(
      `## Funnel Stage\nFUNNEL_STAGE = ${args.funnel_stage.toUpperCase()}\nApply CRITICAL RULE 7 strictly.`
    );
  }

  if (args.persona_name && args.research_context) {
    const selectedPersona = args.research_context.personas.find(
      (p) => p.archetype_name === args.persona_name
    );
    if (selectedPersona) {
      parts.push(
        `## Selected Persona\nSELECTED_PERSONA = ${selectedPersona.archetype_name}\n` +
        `Age: ${selectedPersona.age_range} | Location: ${selectedPersona.location}\n` +
        `Tagline: "${selectedPersona.tagline}"\n` +
        `Deepest fears: ${selectedPersona.deepest_fears.join('; ')}\n` +
        `Deepest desires: ${selectedPersona.deepest_desires.join('; ')}\n` +
        (selectedPersona.verbatim_quotes.length > 0
          ? `Her actual words:\n${selectedPersona.verbatim_quotes.slice(0, 3).map((q: string) => `• "${q}"`).join('\n')}\n`
          : '') +
        `\nWrite the entire brief — including narrative_brief — specifically for THIS PERSON. Do not genericize. She is real. Write to her emotional reality.`
      );
    }
  }

  parts.push(
    'Produce the brief JSON now. Return ONLY the JSON object, no prose.',
  );

  return parts.join('\n\n');
}
