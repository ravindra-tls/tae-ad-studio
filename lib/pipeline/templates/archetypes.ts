/**
 * Archetype templates — layout formulas keyed by concept.hook_archetype.
 *
 * The visual stage previously asked Claude to freestyle an editorial-style
 * composition for every concept, which produced great stock photography and
 * weak ads. These templates flip the job: Claude EXECUTES an ad-layout
 * formula rather than designing one from scratch. The formula is different
 * per archetype so variety across concepts is preserved — what changes is
 * that each formula is specifically an ad, not a scene.
 *
 * Each template describes the archetype to the image model in ad-grammar
 * terms: where the subject sits, where the negative space for copy sits,
 * what posture the lighting takes, what genre of ad this is. Claude's
 * visual_spec output still matches the existing schema (scene / subject /
 * setting / style / text_zones / prompt_text) — these templates just
 * constrain the shape of that output so the assembled prompt_text reads
 * like "DTC Instagram ad, [layout]" rather than "editorial photograph".
 *
 * Adding a new archetype? Two steps:
 *   1) Add an entry to ARCHETYPE_TEMPLATES below.
 *   2) Mention the archetype in lib/pipeline/prompts/concept.ts so the
 *      strategist knows to pick it. (Not strictly required — unknown values
 *      fall back to DEFAULT_TEMPLATE — but keeping the two in sync prevents
 *      "why is this concept always landing on the default template" bugs.)
 */

import type { TextZone } from '../schemas/visual';

type Position = TextZone['position'];
type Element = TextZone['element'];

/** Baseline geometry for a single text element: where it sits on the canvas. */
export interface ZonePreference {
  element: Element;
  /** Preferred position on the canvas for this element in this archetype. */
  position: Position;
}

export interface ArchetypeTemplate {
  /** Human-readable label for logs / debugging. */
  name: string;

  /**
   * Short descriptor of what genre of ad this is. Surfaces in the prompt so
   * the image model frames its output as an ad, not a magazine editorial.
   */
  genre: string;

  /**
   * The composition formula. Written in prose so Claude can fold it into
   * the scene/subject/setting fields. Describes camera angle, subject
   * placement, and — critically — where the large negative space sits for
   * copy overlay. This is the single biggest lever on "does the output
   * look like an ad."
   */
  composition: string;

  /**
   * Mood + lighting posture. Each archetype has a signature emotional
   * register (before/after is clinical+hopeful, problem/agitation is
   * subdued, lifestyle is warm+aspirational, etc.). Giving Claude the
   * register stops every concept from landing on "soft morning light."
   */
  mood: string;

  /** Style cues (film stock, grain, palette posture) appropriate for this archetype. */
  style: string;

  /**
   * Default text-zone assignments. The visual stage will use these as a
   * starting point; a copy_block with no subhead just drops that zone.
   * Order here is the order we'd expect them to render (biggest to smallest).
   */
  zone_preferences: ZonePreference[];

  /**
   * Short ad-grammar note — one-liner that captures how this archetype
   * "works" as an ad. Helps Claude stay on-archetype across all the
   * derived fields (scene, mood, composition).
   */
  grammar_note: string;
}

// ─── The six blessed archetypes ─────────────────────────────────────────────

const BEFORE_AFTER: ArchetypeTemplate = {
  name: 'Before / After',
  genre: 'visual transformation ad',
  composition:
    'Split the canvas vertically (50/50 or 60/40 hero-right). Left half shows the "before" state; right half shows the "after." Subject (product user or product-in-use) sits in the right half. Lower third is reserved for headline + CTA copy overlay.',
  mood:
    'clinical-honest, not exaggerated. Quiet confidence. No miracle-cure drama.',
  style:
    'clean editorial photography, diffuse soft light, minimal retouching feel, shallow depth of field on the "after" side for focus.',
  zone_preferences: [
    { element: 'headline', position: 'bottom' },
    { element: 'cta', position: 'bottom-right' },
    { element: 'disclosure', position: 'bottom-left' },
  ],
  grammar_note:
    'The ad works because the eye tracks L→R across the split and lands on the outcome. Keep the contrast between halves legible at thumbnail size.',
};

const TESTIMONIAL_NATIVE: ArchetypeTemplate = {
  name: 'Testimonial (native)',
  genre: 'social-proof ad styled like a real user post',
  composition:
    'Subject is the testifier, not the product. Close-to-medium portrait framing, authentic not posed. Product appears incidentally (on a shelf, in hand, off-center). Large clear space in the lower-left or top for quote overlay. Feels like a candid moment, not a product shoot.',
  mood:
    'intimate, quiet, lived-in. Warm ambient light. Nothing glossy.',
  style:
    'documentary-style photography, natural skin tones, grain, unposed body language, domestic setting.',
  zone_preferences: [
    { element: 'headline', position: 'bottom-left' },
    { element: 'subhead', position: 'bottom-left' },
    { element: 'cta', position: 'bottom-right' },
  ],
  grammar_note:
    'The quote IS the hook. Image supports the voice of the person, not the product. If it looks like an ad, it has failed.',
};

const STAT_LED_AUTHORITY: ArchetypeTemplate = {
  name: 'Stat-led authority',
  genre: 'data-forward credibility ad',
  composition:
    'Strong negative space (40-50% of canvas) on the left or top for a large stat/number + supporting line. Product or ingredient sits in the opposite corner as the visual anchor. High contrast between the stat zone (clean, uncluttered) and the product zone (rich, textured).',
  mood:
    'confident, credible, quietly scientific. Not cold.',
  style:
    'editorial still-life photography, controlled studio-ish lighting, precise composition, premium finish.',
  zone_preferences: [
    { element: 'headline', position: 'top-left' },
    { element: 'subhead', position: 'top-left' },
    { element: 'body', position: 'bottom-left' },
    { element: 'cta', position: 'bottom-right' },
  ],
  grammar_note:
    'The stat does the heavy lifting — the image only has to not undercut it. Keep the stat zone clean enough to render a large number legibly at any size.',
};

const PROBLEM_AGITATION: ArchetypeTemplate = {
  name: 'Problem / agitation',
  genre: 'pain-first scroll-stopper ad',
  composition:
    'Subject embodies the problem — not the product. Close crop on a human gesture, expression, or environment that names the pain (tired eyes at a laptop, a cluttered bathroom shelf, skin texture detail). Product is absent or tiny. Large text zone across the top or bottom third for the hook headline.',
  mood:
    'subdued, honest, low-key. Muted palette. Not depressing — recognizable.',
  style:
    'documentary close-up, desaturated slightly, natural imperfect light, grain.',
  zone_preferences: [
    { element: 'headline', position: 'top' },
    { element: 'subhead', position: 'top' },
    { element: 'cta', position: 'bottom' },
  ],
  grammar_note:
    'The scroller must recognize themselves in the image within one second. Specificity > beauty here. Resist the urge to prettify the pain.',
};

const LIFESTYLE_ASPIRATION: ArchetypeTemplate = {
  name: 'Lifestyle / aspiration',
  genre: 'aspirational in-use ad',
  composition:
    'Subject is a real person mid-moment (not posed) — doing the thing the product enables, not holding the product. Product is secondary, often off-center or out of focus. Large negative space in lower-left or lower-third over which copy overlays. Environmental storytelling: setting communicates the desired life.',
  mood:
    'warm, aspirational, calm. Golden-hour-adjacent. Never frenetic.',
  style:
    'lifestyle editorial photography, soft natural light, slight film look, shallow depth of field, warm color grading.',
  zone_preferences: [
    { element: 'headline', position: 'bottom-left' },
    { element: 'subhead', position: 'bottom-left' },
    { element: 'cta', position: 'bottom-right' },
  ],
  grammar_note:
    'Sell the life, not the bottle. If the product were removed, the image should still communicate the promise.',
};

const EDUCATIONAL_DEMYSTIFY: ArchetypeTemplate = {
  name: 'Educational / demystify',
  genre: 'informational explainer ad',
  composition:
    'Diagrammatic or deconstructed composition. Ingredient(s), product component(s), or a simple conceptual visual (cross-section, arrow, comparison) arranged on a clean surface. Large headline zone top or left. Body-copy zone inside the image is common here (stat or callout line).',
  mood:
    'curious, clear, instructional without being dry. A little playful.',
  style:
    'clean studio photography OR tasteful minimal illustration, high clarity, controlled shadows, lots of negative space.',
  zone_preferences: [
    { element: 'headline', position: 'top' },
    { element: 'body', position: 'center' },
    { element: 'cta', position: 'bottom' },
  ],
  grammar_note:
    'The image must teach something at a glance. If the viewer cannot point to what they learned, the ad did not earn its place in the feed.',
};

// ─── Default fallback ───────────────────────────────────────────────────────

/**
 * Used when concept.hook_archetype is something not in our map. Written as
 * a sturdy, versatile lifestyle-ad template so the fallback isn't dead
 * weight — it'll produce a serviceable ad rather than a generic photograph.
 */
const DEFAULT_TEMPLATE: ArchetypeTemplate = {
  name: 'General ad (fallback)',
  genre: 'general DTC feed ad',
  composition:
    'Clear hero subject with deliberate negative space for copy overlay. Product present but not dominant. Bottom third or lower-left reserved for copy.',
  mood: 'warm, on-brand, confident.',
  style: 'editorial photography with natural light, shallow depth of field.',
  zone_preferences: [
    { element: 'headline', position: 'bottom-left' },
    { element: 'cta', position: 'bottom-right' },
  ],
  grammar_note:
    'Default template — archetype-specific formula not available. Favor composition over decoration.',
};

// ─── Map + lookup ───────────────────────────────────────────────────────────

export const ARCHETYPE_TEMPLATES: Record<string, ArchetypeTemplate> = {
  before_after:           BEFORE_AFTER,
  testimonial_native:     TESTIMONIAL_NATIVE,
  stat_led_authority:     STAT_LED_AUTHORITY,
  problem_agitation:      PROBLEM_AGITATION,
  lifestyle_aspiration:   LIFESTYLE_ASPIRATION,
  educational_demystify:  EDUCATIONAL_DEMYSTIFY,
};

/**
 * Case/whitespace-tolerant lookup. Returns the default template for any
 * archetype we haven't templated yet. We log once (at callsite) when the
 * default is used so drift becomes visible.
 */
export function getArchetypeTemplate(
  archetype: string | null | undefined,
): { template: ArchetypeTemplate; matched: boolean; key: string | null } {
  if (!archetype || typeof archetype !== 'string') {
    return { template: DEFAULT_TEMPLATE, matched: false, key: null };
  }
  const key = archetype.trim().toLowerCase().replace(/[\s-]+/g, '_');
  const hit = ARCHETYPE_TEMPLATES[key];
  if (hit) return { template: hit, matched: true, key };
  return { template: DEFAULT_TEMPLATE, matched: false, key };
}
