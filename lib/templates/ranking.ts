/**
 * Pure, client-importable template ranking helpers — shared by the forge
 * template picker (client) and any server-side shortlist logic. No supabase,
 * no server-only imports. Ported from Concept Forge (public/app.js
 * rankTemplatesForConcept + the scene-person heuristics in lib/templates.js).
 */

// ─── scene / template heuristics ─────────────────────────────────────────────

const SCENE_PERSON_RE = /\b(woman|man|person|people|she|her|he|his|face|hands?|arms?|shoulder|legs?|skin|model|selfie|wearing|applying)\b/i;

/** Does the concept's visual scene feature a human? */
export function sceneNeedsPerson(sceneText: string | null | undefined): boolean {
  return SCENE_PERSON_RE.test(String(sceneText || '').toLowerCase());
}

// ─── ranking ─────────────────────────────────────────────────────────────────

/** Picker-safe template shape (what GET /api/forge/templates returns). */
export interface RankableTemplate {
  number: number;
  name: string;
  category: string;
  aspect_ratio: string;
  preview_image_url: string | null;
  people_ok: boolean;
  features_person: boolean;
  has_headline_slot: boolean;
}

interface RankableCardLike {
  dna?: { mechanic?: string; hookTactic?: string; format?: string } | null;
  tagline?: string;
  emotionalInsight?: string;
  messagingAngle?: string;
  concept?: string;
  cta?: string;
  visualIdea?: string;
}

interface RankableRecordLike {
  template?: { category?: string } | null;
  _concept_forge?: { visualIdea?: string } | null;
}

/**
 * Rank templates by fit to a concept: compatibility first (a product-only layout
 * can never show the concept's person; no headline slot means the hero tagline
 * can't land), then same category (from the export record), then keyword/signal
 * overlap with the copy.
 */
export function rankTemplatesForConcept<T extends RankableTemplate>(
  card: RankableCardLike,
  rec: RankableRecordLike | null | undefined,
  tpls: T[],
): T[] {
  const d = (card && card.dna) || {};
  const cat = rec && rec.template && rec.template.category;
  const scene = (rec && rec._concept_forge && rec._concept_forge.visualIdea) || card.visualIdea;
  const needsPerson = sceneNeedsPerson(scene);
  const hay = [card.tagline, card.emotionalInsight, card.messagingAngle, card.concept, card.cta, d.mechanic, d.hookTactic, d.format]
    .filter(Boolean).join(' ').toLowerCase();
  const hasNum = /\d/.test(`${card.tagline || ''} ${card.messagingAngle || ''} ${card.concept || ''}`);
  const wantTestimonial = /testimonial|review|quote|verified|["“”]|—\s*\w|\bsaid\b|\bshe told\b/.test(hay);
  const wantBeforeAfter = /before|after|used to|now i|weeks|transform|no longer/.test(hay);
  const wantText = /text|message|note|screenshot|dm|comment|search/.test(hay);
  const scored = tpls.map((t) => {
    const name = (t.name || '').toLowerCase();
    let s = 0;
    if (needsPerson && t.people_ok === false) s -= 1000;   // scene's person can never appear
    if (needsPerson && t.features_person) s += 40;
    if (t.has_headline_slot) s += 25;                       // hero tagline has a place to land
    if (cat && t.category === cat) s += 100;
    name.split(/\W+/).filter((w) => w.length > 3).forEach((w) => { if (hay.includes(w)) s += 6; });
    if (hasNum && /stat|number|result|numeral|%/.test(name)) s += 22;
    if (wantTestimonial && /testimonial|review|quote|note|screenshot/.test(name)) s += 22;
    if (wantBeforeAfter && /before|after|comparison|transform/.test(name)) s += 22;
    if (wantText && /text|message|note|screenshot|chat|comment|search|handwritten/.test(name)) s += 14;
    return { t, s };
  });
  scored.sort((a, b) => b.s - a.s || a.t.number - b.t.number);
  return scored.map((x) => x.t);
}
