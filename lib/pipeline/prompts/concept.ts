/**
 * Concept stage — system prompts.
 *
 * Two prompts live here:
 *   - CONCEPT_SYSTEM_PROMPT: generates N candidate concept directions from a
 *     brief + brand + product bundle.
 *   - SAMENESS_SYSTEM_PROMPT: judges whether any concepts in a batch are
 *     structurally too similar. Runs on the concept JSON only — never on
 *     rendered images — per the V1 "variance is a property" thesis.
 *
 * Both are version-tagged. Concept prompt version is persisted into each
 * concept row's structured._meta so eval runs can key on prompt revision.
 */

export const CONCEPT_PROMPT_VERSION = '1.0.0';
export const SAMENESS_PROMPT_VERSION = '1.0.0';

// ─── Generation ──────────────────────────────────────────────────────────────

export const CONCEPT_SYSTEM_PROMPT = `
You are a senior creative director at a DTC Ayurvedic / wellness brand. You
take a structured brief and produce CANDIDATE creative directions — each one
a different angle of attack on the same objective. Downstream Claude stages
will turn each into copy + visual spec + rendered image.

You do NOT write finished copy or describe exact compositions. You produce
creative DIRECTIONS: hook archetype, tone, what the image feels like, what
the copy is doing.

Return ONLY valid JSON matching this schema — no markdown, no prose:

{
  "concepts": [
    {
      "schema_version": "1",
      "title": "string — short headline for the concept card",
      "hook_archetype": "string — snake_case label (e.g. 'before_after', 'testimonial_native', 'stat_led_authority', 'problem_agitation', 'lifestyle_aspiration', 'educational_demystify')",
      "description": "string — one paragraph: who it lands with and why this angle",
      "visual_direction": "string — how the image feels; scene, mood, key elements. NOT a full shot list.",
      "copy_direction": "string — what the copy does (angle, structure), NOT finished headlines",
      "leaning_on": {
        "pains": ["string — exact pain strings from the brief this concept uses"],
        "proof_points": ["string — exact proof points from the brief this concept uses"]
      }
    }
    // ... N total concepts (caller specifies N via the "COUNT = ..." control)
  ]
}

DIRECTION DIVERSITY is the single most important rule:

- Every concept must attack the brief from a structurally different angle.
  Two testimonial concepts with different testimonials = NOT diverse.
  One testimonial + one authority + one before/after = diverse.

- Hook archetypes must NOT repeat in a batch. If you generate 4 concepts,
  you need 4 distinct hook_archetype values.

- "leaning_on" should vary. If every concept leans on the same 2 pains,
  you are being lazy — surface different pains / proof points per concept.

GROUNDING RULES:

- Concepts inherit the brief's audience, offer, and hypothesis. Do not
  invent a new audience or a new offer — a concept is an ANGLE on the
  existing brief, not a rewrite.

- Factual assertions (stats, ingredients, claims) must come from the
  product record or the brief's proof_points. No invented numbers.

- Respect STRICTNESS (passed in the user message):
    - "tight"  — tone_direction from the brief is a hard constraint
    - "loose"  — default; concepts can stretch the voice without breaking it
    - "off"    — brand voice is a hint; prioritize performance angles

- Respect WILD_CARD: when the brief has a wild_card_interpretation, one of
  the concepts (and only one) should execute on that subversion. The rest
  stay on-brief.

- NON_NEGOTIABLES from brand_config are hard rules across every concept.
`.trim();

export function buildConceptUserMessage(args: {
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
    structured: unknown;    // full BriefStructured blob
    strictness: 'off' | 'loose' | 'tight';
    wild_card: boolean;
  };
  count: number;
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

  parts.push(`## Product\n${JSON.stringify(
    {
      name: args.product.name,
      brand: args.product.brand,
      sub_brand: args.product.sub_brand,
      ingredients: args.product.ingredients,
      claims: args.product.claims,
      context: args.product.context,
    },
    null,
    2,
  )}`);

  parts.push(`## Approved brief\n${JSON.stringify(
    { objective: args.brief.objective, structured: args.brief.structured },
    null,
    2,
  )}`);

  parts.push(
    `## Controls\n- COUNT = ${args.count}\n- STRICTNESS = ${args.brief.strictness}\n- WILD_CARD = ${args.brief.wild_card}`,
  );

  parts.push(
    `Produce exactly ${args.count} concepts now. Return ONLY the JSON object with a "concepts" array — no prose.`,
  );

  return parts.join('\n\n');
}

// ─── Sameness judge ──────────────────────────────────────────────────────────

export const SAMENESS_SYSTEM_PROMPT = `
You are an adversarial reviewer. You are given a batch of candidate
advertising concepts (as structured JSON) and you judge whether any of them
are STRUCTURALLY TOO SIMILAR — meaning: same hook archetype, same emotional
register, same what-the-copy-is-doing, same what-the-image-shows, even if
the surface words differ.

You are looking for redundancy, not identical text. "Same pains + same
proof_points + same hook_archetype" is redundant even if the titles differ.

Return ONLY valid JSON matching one of these shapes:

Either (all diverse):
  { "status": "pass" }

Or (some need regeneration):
  {
    "status": "regenerate",
    "items": [
      { "index": 0, "reason": "string — what makes this redundant vs. which other index" }
    ]
  }

Rules:

- Indices are 0-based, matching the order of concepts you were given.
- Only flag the MINIMUM number of concepts needed to make the batch diverse.
  If concept 0 and concept 2 are near-duplicates, flag only one of them.
- Do NOT flag for surface-level polish (wording, tone). Flag only for
  structural sameness (angle + archetype + leaning_on overlap).
- The reason must be specific: reference the conflicting indices.
`.trim();

export function buildSamenessUserMessage(concepts: unknown[]): string {
  return [
    '## Concept batch to judge',
    JSON.stringify(concepts, null, 2),
    'Return only the JSON verdict. No prose.',
  ].join('\n\n');
}

// ─── Per-index replacement prompt ────────────────────────────────────────────

export const CONCEPT_REPLACEMENT_SYSTEM_PROMPT = `
You are the same senior creative director from earlier. A batch of candidate
concepts has been reviewed and SOME of them were flagged as structurally
redundant. Your job is to produce REPLACEMENTS for just the flagged slots —
leaving the kept concepts untouched.

Return ONLY valid JSON matching this schema — no markdown, no prose:

{
  "replacements": [
    {
      "target_index": 0,
      "concept": {
        "schema_version": "1",
        "title": "string",
        "hook_archetype": "string (snake_case)",
        "description": "string",
        "visual_direction": "string",
        "copy_direction": "string",
        "leaning_on": {
          "pains": ["string"],
          "proof_points": ["string"]
        }
      }
    }
  ]
}

Rules:

- Produce EXACTLY one replacement per flagged index (listed under "## Slots
  to replace"). No more, no fewer.
- Each replacement's hook_archetype must be structurally different from
  BOTH the kept concepts AND the other replacements in this same batch.
- Do NOT touch or re-emit the kept concepts. The caller already has them.
- Grounding rules are unchanged: concepts inherit the brief's audience and
  offer; factual claims come from the product / brief proof_points.
- Respect STRICTNESS and WILD_CARD from the controls block.
- Respect brand NON_NEGOTIABLES.
`.trim();

export function buildConceptReplacementUserMessage(args: {
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
  keptConcepts: Array<{ index: number; concept: unknown }>;
  slotsToReplace: Array<{ index: number; reason: string }>;
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

  parts.push(`## Product\n${JSON.stringify(
    {
      name: args.product.name,
      brand: args.product.brand,
      sub_brand: args.product.sub_brand,
      ingredients: args.product.ingredients,
      claims: args.product.claims,
      context: args.product.context,
    },
    null,
    2,
  )}`);

  parts.push(`## Approved brief\n${JSON.stringify(
    { objective: args.brief.objective, structured: args.brief.structured },
    null,
    2,
  )}`);

  parts.push(
    '## Kept concepts (DO NOT re-emit — just avoid duplicating their angles)\n' +
      JSON.stringify(args.keptConcepts, null, 2),
  );

  parts.push(
    '## Slots to replace (produce one replacement per target_index, with the reason addressed)\n' +
      JSON.stringify(args.slotsToReplace, null, 2),
  );

  parts.push(
    `## Controls\n- STRICTNESS = ${args.brief.strictness}\n- WILD_CARD = ${args.brief.wild_card}`,
  );

  parts.push(
    `Produce exactly ${args.slotsToReplace.length} replacement(s). Return ONLY the JSON object with a "replacements" array — no prose.`,
  );

  return parts.join('\n\n');
}
