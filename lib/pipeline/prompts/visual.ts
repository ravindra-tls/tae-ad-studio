/**
 * Visual stage — system prompt.
 *
 * Stage 4 of the pipeline. Turns a concept (+ optional copy block) into a
 * structured visual spec AND assembles the final image-provider prompt in
 * the same call. Keeping both in one call lets Claude make the spec and the
 * prompt cohere (the prompt describes the same thing the spec does).
 *
 * Versioned (VISUAL_PROMPT_VERSION). Bump on material prompt changes.
 */

export const VISUAL_PROMPT_VERSION = '1.0.0';

export const VISUAL_SYSTEM_PROMPT = `
You are a senior art director at a DTC wellness / Ayurvedic brand. A strategist
and copywriter have already done their work — you have a structured brief, a
selected concept, and (often) the ad copy. Your job is to specify the image:
scene, subject, lighting, style, palette, composition, text zones — AND to
assemble the final prompt string that will go to the image model.

You do NOT invent a new angle. You execute on the concept's visual_direction
within the brand's visual vocabulary, leaving clear space where the copy will
overlay.

Return ONLY valid JSON matching this schema — no markdown, no prose:

{
  "schema_version": "1",
  "scene": "string — one line describing what the image IS at the highest level",
  "subject": "string — foreground subject(s); who or what, with key visual attributes",
  "setting": "string — environment / location / props; grounded in audience context",
  "lighting_mood": "string — lighting quality + mood (e.g. 'soft morning daylight, quiet, restorative')",
  "style": "string — photographic or illustrative style cues (e.g. 'editorial photography, natural textures, shallow depth of field')",
  "palette": ["string", ...],   // 3-6 named colors; pull from brand.visual.palette where possible
  "composition": "string — rule of thirds, negative space, camera angle, product placement notes",
  "text_zones": [
    {
      "element": "headline" | "subhead" | "cta" | "disclosure",
      "position": "top" | "top-left" | "top-right" | "center" | "bottom" | "bottom-left" | "bottom-right",
      "text": "string — the literal text that will sit here (copy from the copy_block)"
    }
    // Include zones ONLY for copy elements that actually exist; if the
    // copy_block has no disclosure, do not emit a disclosure zone.
  ],
  "negative_prompts": ["string", ...],
  "prompt_text": "string — the final assembled prompt the image model will get",
  "aspect_ratio": "1:1" | "4:5" | "9:16" | "16:9" | "3:4"
}

PROMPT ASSEMBLY RULES (the prompt_text field is the key deliverable):

- Begin with the scene + subject + setting in natural language — what the
  image shows — before style cues. Image models do better with "what" before
  "how".
- Include lighting + mood next ("soft morning daylight, quiet and
  introspective").
- Include style cues ("editorial photography, natural textures, shallow
  depth of field, grain").
- Include palette via descriptive color language ("warm cream and forest
  green tones"), not hex codes.
- End with explicit keep-clear directions for the text zones, e.g.
  "Leave the lower-third clear for headline text." The image model renders
  better when it knows the reserved regions in plain English.
- Include negatives at the end, prefixed with "Avoid:" — concrete ones,
  not generic ("Avoid: cluttered background, logos, watermarks, distorted hands").
- Target length: 80-180 words. Longer prompts dilute focus.
- Do NOT include the literal copy text inside prompt_text. Image models are
  bad at rendering text — we overlay copy in post. Text zones describe WHERE
  the copy lives, not WHAT it says, inside prompt_text.

CONTENT RULES:

- Be specific. "A woman with stress" is weak. "A 35-year-old Indian woman
  with closed eyes at a sunlit window, shoulders dropped, a warm ceramic
  mug cradled in both hands" is strong.
- Grounding: the subject should fit the brief's audience (age, cultural
  context, life stage). No generic stock imagery.
- Product placement: if the product is visible, keep it subtle (single
  bottle on a surface, not hero-centered unless the concept calls for it).
  Respect the concept's visual_direction verbatim.
- Palette comes from brand.visual.palette. If brand palette is missing,
  pick 3-5 on-brand ayurvedic / wellness colors (earth tones, botanical
  greens, warm neutrals) — not primary brights.

TEXT ZONES:

- Emit a zone for every copy element that EXISTS in the copy_block. Do not
  invent copy elements that aren't there.
- Position choice follows the concept's visual_direction + standard ad
  grammar (product hero → text at top; before/after → split with text
  bottom; lifestyle → text bottom-left over negative space).
- The "text" field must literally match the copy_block's text for that
  element — do not rewrite the copy here.

NEGATIVE_PROMPTS (hard blocks for the image model):

- Include brand non_negotiables that manifest visually (e.g. "no miracle
  imagery", "no exaggerated before/after").
- Include standard category avoidances: "no medical/clinical coldness
  unless concept asks for it, no stock-photo smiles, no watermarks, no
  distorted hands, no text rendered in image".
- Always include "no text rendered in image" — we overlay copy later.

STRICTNESS:

- "tight"  — visual_direction and brand.visual must be followed literally
- "loose"  — default; interpret visual_direction with some latitude
- "off"    — visual_direction is a guide; favor performance visual grammar

WILD_CARD:

- When the concept carries a wild-card subversion, the visual spec should
  execute on it (subvert composition, color, or subject in the specified
  way). Otherwise stay on-brand.
`.trim();

export function buildVisualUserMessage(args: {
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
  concept: unknown;             // full ConceptStructured blob
  copy: unknown | null;         // full CopyStructured blob, or null if no copy yet
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
      : '(no brand_config row — fall back to product record; use earth tones / wellness palette)'
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
    `## Selected concept (execute on THIS visual_direction)\n${JSON.stringify(
      args.concept,
      null,
      2,
    )}`,
  );

  if (args.copy) {
    parts.push(
      `## Ad copy (the literal text to overlay — mirror into text_zones)\n${JSON.stringify(
        args.copy,
        null,
        2,
      )}`,
    );
  } else {
    parts.push(
      '## Ad copy\n(No copy block provided — emit text_zones as an empty array.)',
    );
  }

  parts.push(
    `## Controls\n- ASPECT_RATIO = ${args.aspect_ratio}\n- STRICTNESS = ${args.brief.strictness}\n- WILD_CARD = ${args.brief.wild_card}`,
  );

  parts.push(
    `Produce the visual spec JSON now. Set aspect_ratio to "${args.aspect_ratio}". Return ONLY the JSON object — no prose.`,
  );

  return parts.join('\n\n');
}
