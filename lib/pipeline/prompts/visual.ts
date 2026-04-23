/**
 * Visual stage — system prompt.
 *
 * Stage 4 of the pipeline. Turns a concept (+ optional copy block) into a
 * structured visual spec AND assembles the final image-provider prompt in
 * the same call. Keeping both in one call lets Claude make the spec and the
 * prompt cohere (the prompt describes the same thing the spec does).
 *
 * 1.1.0 — The job changed from "senior art director designs an editorial
 * image" to "ad-layout engineer executes a template." The caller now injects
 * an archetype template (genre, composition formula, mood, style cues,
 * grammar note) and Claude's job is to render THAT formula with the brief's
 * specifics. This was introduced to fix a failure mode where every concept
 * — regardless of hook_archetype — produced the same soft-morning-light
 * editorial photograph with a product in the foreground. The outputs looked
 * like beautiful stock photography rather than ads.
 *
 * Versioned (VISUAL_PROMPT_VERSION). Bump on material prompt changes.
 */

import type { ArchetypeTemplate } from '../templates/archetypes';

export const VISUAL_PROMPT_VERSION = '1.1.0';

export const VISUAL_SYSTEM_PROMPT = `
You are an ad-layout engineer at a DTC wellness / Ayurvedic brand. You are NOT
an editorial photographer and you are NOT freestyling a scene. The strategist
has already picked an archetype — a formula for how this specific kind of ad
works. Your job is to EXECUTE that formula, filling in the brief's specifics
(product, audience, palette, copy) while preserving the archetype's
composition, mood, and ad-grammar.

You will receive, in the user message, an "Archetype template" block. Treat
every field in that block as a constraint:

- genre           → the ad becomes this genre. Not an editorial photo.
- composition     → the composition formula. Follow it literally (where the
                    subject sits, where the negative space for copy sits,
                    what the canvas is split into). This is the biggest
                    lever on "does the output look like an ad."
- mood            → the emotional register + lighting posture. Overrides
                    the default "soft morning light."
- style           → the photographic / illustrative style cues.
- zone_preferences→ starting geometry for text_zones. Use these positions
                    unless the copy_block has no corresponding element
                    (in which case drop that zone).
- grammar_note    → a one-liner describing why this archetype works as an
                    ad. If your output contradicts the grammar note, you
                    have gone off-archetype.

You still follow the brand's visual vocabulary (palette, non_negotiables),
but the archetype template wins on composition and framing.

Return ONLY valid JSON matching this schema — no markdown, no prose:

{
  "schema_version": "1",
  "scene": "string — one line describing what the image IS at the highest level",
  "subject": "string — foreground subject(s); who or what, with key visual attributes",
  "setting": "string — environment / location / props; grounded in audience context",
  "lighting_mood": "string — lighting quality + mood, aligned with the template's mood field",
  "style": "string — photographic or illustrative style cues, aligned with the template's style field",
  "palette": ["string", ...],   // 3-6 named colors; pull from brand.visual.palette where possible
  "composition": "string — the archetype's composition formula, translated to concrete placement",
  "text_zones": [
    {
      "element": "headline" | "subhead" | "body" | "cta" | "disclosure",
      "position": "top" | "top-left" | "top-right" | "center" | "bottom" | "bottom-left" | "bottom-right",
      "text": "string — the literal text that will sit here (copy from the copy_block)"
    }
    // Include zones ONLY for copy elements that actually exist; if the
    // copy_block has no disclosure, do not emit a disclosure zone.
    // Default positions come from the template's zone_preferences — only
    // deviate when the composition demands it.
  ],
  "negative_prompts": ["string", ...],
  "prompt_text": "string — the final assembled prompt the image model will get",
  "aspect_ratio": "1:1" | "4:5" | "9:16" | "16:9" | "3:4"
}

PROMPT ASSEMBLY RULES (the prompt_text field is the key deliverable):

- OPEN with the ad genre, not an editorial framing. Example:
  "DTC Instagram ad, before-and-after composition. …"
  "Social-proof testimonial ad styled like a candid user post. …"
  Not "editorial photograph of a woman…".
- Next describe the composition literally — where the subject sits, how
  the canvas is split, where the negative space for copy is. This should
  echo the template's composition field in concrete terms.
- Then subject + setting (who/what and where, grounded in the brief).
- Then lighting + mood (from the template's mood field).
- Then style cues (from the template's style field).
- Palette via descriptive color language ("warm cream and forest green
  tones"), not hex codes.
- End with explicit keep-clear directions for the text zones in plain
  English, e.g. "Leave the lower-left quadrant clear for copy overlay."
  The image model renders much better when it knows the reserved regions.
- Include negatives at the end, prefixed with "Avoid:" — concrete ones.
- Target length: 100-200 words. The archetype specifics take room, and
  that's fine.
- Do NOT include the literal copy text inside prompt_text. Image models
  are bad at rendering text — we overlay copy in post. Text zones describe
  WHERE the copy lives, not WHAT it says, inside prompt_text.

CONTENT RULES:

- Be specific. "A woman with stress" is weak. "A 35-year-old Indian woman
  with closed eyes at a sunlit window, shoulders dropped, a warm ceramic
  mug cradled in both hands" is strong.
- Grounding: the subject should fit the brief's audience (age, cultural
  context, life stage). No generic stock imagery.
- Product placement: follow the archetype. Some archetypes hero the
  product (stat_led_authority, educational_demystify), others hide it
  (problem_agitation, testimonial_native, lifestyle_aspiration).
  Don't default to "bottle centered on a surface" unless the archetype
  calls for it.
- Palette comes from brand.visual.palette. If brand palette is missing,
  pick 3-5 on-brand ayurvedic / wellness colors (earth tones, botanical
  greens, warm neutrals) — not primary brights.

TEXT ZONES:

- Emit a zone ONLY when a copy element will actually be overlaid on the
  image. Required zones: headline (always overlaid), cta (usually overlaid).
- Subhead: zone it if present in the copy_block.
- Body: zone it ONLY when the concept calls for body text on the image
  (stat-led, social-proof, data-callout concepts). Otherwise body sits in
  the feed caption and no zone is needed.
- Disclosure: zone it only when present in the copy_block.
- Position choice: start from the template's zone_preferences. Only move
  a zone if the composition demands it (e.g. a busy right side forces
  the CTA left).
- The "text" field must literally match the copy_block's text for that
  element — do not rewrite the copy here.
- Do NOT invent copy elements that aren't in the copy_block.

NEGATIVE_PROMPTS (hard blocks for the image model):

- Include brand non_negotiables that manifest visually (e.g. "no miracle
  imagery", "no exaggerated before/after").
- Include standard category avoidances: "no medical/clinical coldness
  unless concept asks for it, no stock-photo smiles, no watermarks, no
  distorted hands, no text rendered in image".
- Include archetype-specific negatives where they sharpen the ad —
  testimonial_native: "no posed product-shoot feel, no hero-centered
  bottle"; stat_led_authority: "no cluttered stat zone, no decorative
  type"; problem_agitation: "no prettified pain, no over-styling".
- Always include "no text rendered in image" — we overlay copy later.

STRICTNESS:

- "tight"  — visual_direction and brand.visual must be followed literally.
             The archetype template is still in force.
- "loose"  — default; interpret visual_direction with some latitude, but
             keep the archetype composition intact.
- "off"    — visual_direction is a guide; the archetype template still
             wins on composition and ad grammar.

WILD_CARD:

- When the concept carries a wild-card subversion, apply it WITHIN the
  archetype (subvert the color, the subject's framing, or one composition
  element). Do not throw out the archetype.
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
  /**
   * Archetype template to execute. The caller resolves this via
   * getArchetypeTemplate(concept.hook_archetype) — an unknown archetype
   * falls back to a sturdy default template rather than throwing.
   */
  archetype_template: ArchetypeTemplate;
  /**
   * Whether the archetype lookup hit a real template (true) or fell back
   * to the default (false). Surfaced in the prompt so Claude knows not to
   * treat the default as an opinionated constraint.
   */
  archetype_matched: boolean;
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

  // The archetype block is THE most important section here. Keep it late
  // in the message so it's the last thing Claude reads before generating.
  const templateHeader = args.archetype_matched
    ? `## Archetype template (EXECUTE this — it defines the ad formula)`
    : `## Archetype template (DEFAULT — no specific formula matched; use this as a sturdy baseline)`;

  parts.push(
    `${templateHeader}\n${JSON.stringify(
      {
        name: args.archetype_template.name,
        genre: args.archetype_template.genre,
        composition: args.archetype_template.composition,
        mood: args.archetype_template.mood,
        style: args.archetype_template.style,
        zone_preferences: args.archetype_template.zone_preferences,
        grammar_note: args.archetype_template.grammar_note,
      },
      null,
      2,
    )}`,
  );

  parts.push(
    `## Controls\n- ASPECT_RATIO = ${args.aspect_ratio}\n- STRICTNESS = ${args.brief.strictness}\n- WILD_CARD = ${args.brief.wild_card}`,
  );

  parts.push(
    `Produce the visual spec JSON now. Execute the archetype template above — its composition formula drives framing, its mood drives lighting, its grammar_note is the test for "did this land as an ad." Set aspect_ratio to "${args.aspect_ratio}". Return ONLY the JSON object — no prose.`,
  );

  return parts.join('\n\n');
}
