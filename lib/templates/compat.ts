/**
 * Template compatibility helpers over the LIVE `prompt_templates` table —
 * single source of truth (the same rows the template flow uses; Concept
 * Forge's ad-templates.json snapshot is gone). Shared app-wide, not
 * forge-private. Server-only (service-role query + module cache).
 *
 * Logic ported from Concept Forge lib/templates.js:
 * compat flags (people_ok / features_person / has_headline_slot),
 * sceneNeedsPerson, suggestTemplate, conceptToCategory, extractTokens.
 */
import { createServiceClient } from '@/lib/supabase/server';
import { sceneNeedsPerson } from './ranking';

export { sceneNeedsPerson };

/** Full template record as the compat layer sees it (live row + aspect alias). */
export interface CompatTemplate {
  id: string;
  number: number;
  name: string;
  category: string;
  template: string;
  /** Alias of the live table's default_aspect_ratio. */
  aspect_ratio: string;
  preview_image_url: string | null;
  /** NULL = universal; NOT NULL = local to that workspace. */
  workspace_id: string | null;
  /** Soft archive — archived templates keep provenance but leave pickers. */
  is_active: boolean;
}

/** Picker-safe projection (no full prompt body) + compat flags. */
export interface TemplateListItem {
  number: number;
  name: string;
  category: string;
  aspect_ratio: string;
  preview_image_url: string | null;
  scope: 'universal' | 'workspace';
  people_ok: boolean;
  features_person: boolean;
  has_headline_slot: boolean;
}

export interface TemplateCompatFlags {
  peopleBan: boolean;
  featuresPerson: boolean;
  headlineSlot: boolean;
}

// ─── concept ↔ template compatibility ────────────────────────────────────────
// Some layouts structurally exclude parts of a concept: a "product and props only"
// template can never show the persona in the scene, and a template with no
// headline-ish token has nowhere for the chosen hero tagline to land verbatim.

const PEOPLE_BAN_RE = /no (people|humans|hands|faces|body parts)|product (and props )?only|product-only/i;
const TEMPLATE_PERSON_RE = /\b(woman|man|person|people|model|customer|creator|influencer|selfie|hand|hands|face|holding|wearing|applying)\b/i;
const HEADLINE_TOKEN_RE = /HEADLINE|HOOK|TITLE|PULL-?QUOTE|STATEMENT|CLAIM|BIG (BOLD )?TEXT|OVERLAY TEXT|MAIN LINE/i;

// Token pattern. Template bodies use square brackets EXCLUSIVELY for placeholders,
// so any bracketed span is a token. One level of nesting is allowed because some
// hint text embeds another token (e.g. "[HEADER like What Makes [PRODUCT] Special]"),
// and tokens may contain quotes, $/%/@/emoji, and hard-wrapped line breaks.
const TOKEN_RE = /\[(?:[^\[\]]|\[[^\[\]]*\])*\]/g;

/** Unique [PLACEHOLDER] tokens present in a template body. */
export function extractTokens(templateBody: string | null | undefined): string[] {
  const found = String(templateBody || '').match(TOKEN_RE) || [];
  return [...new Set(found.filter((t) => /[A-Za-z]/.test(t)))];
}

const compatCache = new WeakMap<CompatTemplate, TemplateCompatFlags>();

/** Structural flags for one template (computed once, cached per record). */
export function templateCompat(t: CompatTemplate | null | undefined): TemplateCompatFlags {
  if (!t) return { peopleBan: false, featuresPerson: false, headlineSlot: false };
  let flags = compatCache.get(t);
  if (!flags) {
    const body = String(t.template || '');
    flags = {
      peopleBan: PEOPLE_BAN_RE.test(body),
      featuresPerson: TEMPLATE_PERSON_RE.test(body),
      headlineSlot: extractTokens(body).some((x) => HEADLINE_TOKEN_RE.test(x)),
    };
    compatCache.set(t, flags);
  }
  return flags;
}

// ─── live-table load with ~60s module cache ──────────────────────────────────

interface TemplateStore {
  at: number;
  templates: CompatTemplate[];
  byNumber: Map<number, CompatTemplate>;
}

const CACHE_TTL_MS = 60_000;
let _store: TemplateStore | null = null;
let _loading: Promise<TemplateStore> | null = null;

async function fetchStore(): Promise<TemplateStore> {
  const service = await createServiceClient();
  const { data, error } = await service
    .from('prompt_templates')
    .select('id,number,name,category,template,default_aspect_ratio,preview_image_url,workspace_id,is_active')
    .order('number', { ascending: true });
  if (error) throw new Error(`Failed to load prompt_templates: ${error.message}`);
  const templates: CompatTemplate[] = (data ?? []).map((row) => ({
    id: row.id as string,
    number: row.number as number,
    name: row.name as string,
    category: row.category as string,
    template: row.template as string,
    aspect_ratio: (row.default_aspect_ratio as string) || '4:5',
    preview_image_url: (row.preview_image_url as string | null) ?? null,
    workspace_id: (row.workspace_id as string | null) ?? null,
    is_active: (row.is_active as boolean | null) ?? true,
  }));
  return { at: Date.now(), templates, byNumber: new Map(templates.map((t) => [t.number, t])) };
}

async function load(): Promise<TemplateStore> {
  if (_store && Date.now() - _store.at < CACHE_TTL_MS) return _store;
  if (!_loading) {
    _loading = fetchStore()
      .then((s) => { _store = s; return s; })
      .finally(() => { _loading = null; });
  }
  try {
    return await _loading;
  } catch (err) {
    if (_store) return _store; // serve stale on refresh failure
    throw err;
  }
}

/**
 * Drop the module cache — call after any prompt_templates write (approve,
 * promote, edit, archive) so pickers see the change without the 60s lag.
 * ONE global store, filtered per call; invalidation has one target.
 */
export function invalidateTemplateCache(): void {
  _store = null;
}

/** The catalog a workspace can use: universal set + that workspace's own, active only. */
function visibleTo(templates: CompatTemplate[], workspaceId?: string | null): CompatTemplate[] {
  return templates.filter(
    (t) => t.is_active && (t.workspace_id === null || (workspaceId != null && t.workspace_id === workspaceId)),
  );
}

/** Templates visible to a workspace, trimmed to picker-safe fields + compat flags. */
export async function listTemplates(workspaceId?: string | null): Promise<TemplateListItem[]> {
  const { templates } = await load();
  return visibleTo(templates, workspaceId).map((t) => {
    const c = templateCompat(t);
    return {
      number: t.number,
      name: t.name,
      category: t.category,
      aspect_ratio: t.aspect_ratio,
      preview_image_url: t.preview_image_url || null,
      scope: t.workspace_id === null ? 'universal' : 'workspace',
      people_ok: !c.peopleBan,
      features_person: c.featuresPerson,
      has_headline_slot: c.headlineSlot,
    };
  });
}

/** Full template record (includes the token prompt body) by number. */
export async function getTemplate(number: number | string): Promise<CompatTemplate | null> {
  const { byNumber } = await load();
  return byNumber.get(Number(number)) || null;
}

// ─── concept → template category ─────────────────────────────────────────────
// Template categories in the live table:
//   Hero/Product · Offer/Promotion · Social Proof · Educational · Comparison
//   UGC · Press/Authority · Lifestyle · Native/Editorial

const FORMAT_TO_CATEGORY: Record<string, string> = {
  // UGC / native
  Selfie: 'UGC', 'Native Text Overlay': 'Native/Editorial', 'Text Message': 'UGC',
  'Notes App': 'UGC', 'Comment Response': 'UGC', Letter: 'UGC', 'Post It': 'UGC',
  // Social proof
  Review: 'Social Proof', Testimonial: 'Social Proof', 'Case Study': 'Social Proof',
  // Educational / infographic
  Statistic: 'Educational', 'Feature Benefit Callout': 'Educational', Listicle: 'Educational',
  'How-To': 'Educational', 'Grid Swap': 'Educational',
  // Comparison
  'Us vs. Them': 'Comparison', 'Split Screen': 'Comparison', 'Time Lapse': 'Comparison',
  // Authority / press
  Press: 'Press/Authority', Billboard: 'Hero/Product',
};

const FAMILY_TO_CATEGORY: Record<string, string> = {
  PRODUCT_HERO: 'Hero/Product',
  TESTIMONIAL_NATIVE: 'Social Proof',
  EDUCATIONAL_DEMYSTIFY: 'Educational',
  LIFESTYLE_ASPIRATION: 'Lifestyle',
  BEFORE_AFTER: 'Comparison',
  CONTRAST: 'Comparison',
};

interface CardLike {
  dna?: { format?: string } | null;
  visualIdea?: string;
}

interface RecipeLike {
  family?: string;
}

/** Best-guess template category for a concept, from its format then its recipe family. */
export function conceptToCategory(card: CardLike | null | undefined, recipe?: RecipeLike | null): string {
  const format = (card && card.dna && card.dna.format) || '';
  if (FORMAT_TO_CATEGORY[format]) return FORMAT_TO_CATEGORY[format];
  const fam = recipe && recipe.family;
  if (fam && FAMILY_TO_CATEGORY[fam]) return FAMILY_TO_CATEGORY[fam];
  return 'Hero/Product';
}

export interface TemplateSuggestion {
  template: CompatTemplate | null;
  category: string;
  matched: boolean;
}

/**
 * Suggest a default template for a concept. Prefers a canonical (seeded, low-number)
 * template within the matched category so the default is stable and vetted; the UI
 * lets the user override with any template.
 *
 * Compatibility-aware: if the concept's scene features a person, templates that ban
 * people are excluded and person-featuring layouts win; templates with a headline-ish
 * token rank above ones with nowhere for the hero tagline to land.
 */
export async function suggestTemplate(
  card: CardLike,
  recipe?: RecipeLike | null,
  workspaceId?: string | null,
): Promise<TemplateSuggestion> {
  const category = conceptToCategory(card, recipe);
  const { templates: fullStore } = await load();
  const all = visibleTo(fullStore, workspaceId);
  const needsPerson = sceneNeedsPerson(card && card.visualIdea);

  const compatible = needsPerson ? all.filter((t) => !templateCompat(t).peopleBan) : all;
  const pool = compatible.length ? compatible : all;
  const inCat = pool.filter((t) => t.category === category);
  const source = inCat.length ? inCat : pool;

  // Person fit (when the scene has one) > headline slot > canonical low number
  // (seeded templates 1–41 are the hand-authored, vetted set).
  const chosen = source.slice().sort((a, b) => {
    const ca = templateCompat(a); const cb = templateCompat(b);
    if (needsPerson && ca.featuresPerson !== cb.featuresPerson) return ca.featuresPerson ? -1 : 1;
    if (ca.headlineSlot !== cb.headlineSlot) return ca.headlineSlot ? -1 : 1;
    return a.number - b.number;
  })[0];
  return { template: chosen ?? null, category, matched: inCat.length > 0 };
}
