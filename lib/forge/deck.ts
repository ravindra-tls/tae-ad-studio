/**
 * Grounding-deck derivation for Concept Forge.
 *
 * CF "brand" ≡ TAE product: the deck is distilled from
 *   products row + brand_config (id=1) + latest active positioning_research
 *   (matched by product_name text — the same join the old brief flow used),
 * cached per product in `product_decks`, and invalidated by `source_hash`.
 *
 * Tiered build:
 *   T1 research present  → one emit_grounding_deck distill over product+research+brand_config
 *   T2 no research       → distill over product row + context only, then per-persona enrichment
 *   T3 distill fails     → buildMinimalDeck() pure TS (stored with a `minimal:`-prefixed
 *                          hash so the next session retries the full distill)
 *
 * A deterministic compliance overlay is applied after every build — never
 * trust the model with compliance. Admin `overrides` are merged on top at
 * every load so manual edits survive re-distills.
 */
import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { callClaude, extractToolInput } from './anthropic';
import { MODELS } from './models';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import type {
  DeckDepth,
  DeckOverrides,
  DeckPersona,
  ForgeDeck,
} from './types';
import type { BrandConfig, Product } from '@/types';
import type { PositioningResearch } from '@/lib/research/types';

// ─── Distiller tool schema (verbatim from CF lib/grounding.js) ───────────────

export const DECK_TOOL: Tool = {
  name: 'emit_grounding_deck',
  description: 'Emit a compact, structured grounding deck distilled from a brand context document.',
  input_schema: {
    type: 'object',
    properties: {
      brand: { type: 'string' },
      product: { type: 'string' },
      oneLiner: { type: 'string' },
      market: { type: 'string' },
      price: { type: 'string' },
      anchorType: { type: 'string', enum: ['pain', 'desire'] },
      productTruths: { type: 'array', items: { type: 'string' } },
      mechanisms: { type: 'array', items: { type: 'string' } },
      proofPoints: { type: 'array', items: { type: 'string' } },
      personas: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            lifeContext: { type: 'string' },
            desire: { type: 'string' },
            // Inner emotional life — the unspoken truths a great marketer imagines.
            innerMonologue: { type: 'string', description: 'A first-person line she thinks but would never say aloud.' },
            unspokenFears: { type: 'array', items: { type: 'string' }, description: '2–3 raw fears about her body, aging, or identity.' },
            socialComparison: { type: 'string', description: 'Who she quietly envies or measures herself against.' },
            shameMoments: { type: 'array', items: { type: 'string' }, description: 'Concrete stinging scenes (e.g. "catching her arms in a dressing-room mirror").' },
            identityLost: { type: 'string', description: 'Who she used to be — the quiet grief.' },
            identityDesired: { type: 'string', description: 'Who she wants to feel like again.' },
          },
          required: ['id', 'name', 'lifeContext', 'desire'],
        },
      },
      pains: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            label: { type: 'string' },
            description: { type: 'string' },
            vocPhrases: { type: 'array', items: { type: 'string' } },
          },
          required: ['id', 'label', 'description'],
        },
      },
      brandVoice: {
        type: 'object',
        properties: {
          adjectives: { type: 'array', items: { type: 'string' } },
          approvedLanguage: { type: 'array', items: { type: 'string' } },
          bannedLanguage: { type: 'array', items: { type: 'string' } },
          notes: { type: 'string' },
        },
      },
      constraints: { type: 'array', items: { type: 'string' } },
      offer: { type: 'string' },
      visualStyle: {
        type: 'object',
        description: 'Visual identity for image generation.',
        properties: {
          typography: { type: 'string', description: 'on-image text style, e.g. "modern sans-serif" or "clean serif"' },
          palette: { type: 'array', items: { type: 'string' }, description: 'named brand colors (with hex where known)' },
          lightingDefault: { type: 'string' },
          colorGrading: { type: 'string', description: 'warm | neutral | cool' },
        },
      },
      referenceImages: { type: 'array', items: { type: 'string' }, description: 'paths/URLs to real product photos for image-to-image conditioning' },
    },
    required: ['brand', 'product', 'anchorType', 'productTruths', 'personas', 'pains', 'brandVoice'],
  },
};

const DISTILL_SYSTEM =
  'You distill a brand context document into a compact, structured grounding deck used to ground ad-concept generation. Extract only what is stated or clearly implied. Preserve exact approved/banned language and any compliance constraints. Give personas and pains short stable kebab-case ids. For each persona, ALSO infer their inner emotional life — the uncomfortable, unspoken truths a brilliant, empathetic marketer imagines when picturing ONE real person: their inner monologue, unspoken fears, who they quietly envy, the concrete moments that sting, who they used to be, and who they want to feel like again. Go to real, human places (envy, shame, fear of aging, grief, vanity). This raw layer is internal grounding for ideation only — downstream copy always surfaces it with empathy, never mocking. Never use the brand\'s banned language or make medical claims, even in these fields.';

// Tool the enrichment model fills — inner emotional life for ONE persona.
// (Per-persona so the tool JSON can never truncate at max_tokens.)
export const ENRICH_TOOL: Tool = {
  name: 'emit_persona_inner_life',
  description: 'Return the inner emotional life of one persona.',
  input_schema: {
    type: 'object',
    properties: {
      innerMonologue: { type: 'string' },
      unspokenFears: { type: 'array', items: { type: 'string' } },
      socialComparison: { type: 'string' },
      shameMoments: { type: 'array', items: { type: 'string' } },
      identityLost: { type: 'string' },
      identityDesired: { type: 'string' },
    },
    required: ['innerMonologue'],
  },
};

const ENRICH_SYSTEM =
  'You deepen ad-audience personas with their inner emotional life — the uncomfortable, unspoken truths a brilliant, empathetic marketer imagines when picturing ONE real person. Go to real, human places: envy of others, shame about the body or aging, fear of disappearing or being seen as old, grief for who they used to be, vanity they will not admit. This raw layer is internal grounding for ideation — downstream copy always surfaces it with empathy, never mocking or shaming. Never use the brand\'s banned language and never make a medical/disease claim, even inside these fields. Return exactly one enrichment object per persona id you are given, keeping ids unchanged.';

// ─── Prompt block (verbatim from CF lib/grounding.js deckToPromptBlock) ──────

/**
 * Compact text block of the deck for injection into generation/judge system
 * prompts. Callers mark this block cacheable (prompt caching); it must stay
 * byte-stable for a given deck.
 */
export function deckToPromptBlock(deck: ForgeDeck): string {
  const lines: string[] = [];
  lines.push(`BRAND: ${deck.brand}`);
  lines.push(`PRODUCT: ${deck.product}`);
  if (deck.oneLiner) lines.push(`ONE-LINER: ${deck.oneLiner}`);
  if (deck.market) lines.push(`MARKET: ${deck.market}`);
  if (deck.price) lines.push(`PRICE/OFFER: ${deck.price}`);
  lines.push(`PRIMARY ANCHOR: ${deck.anchorType}`);
  lines.push('');
  lines.push('PRODUCT TRUTHS (anchor every concept in at least one — do not invent facts beyond these):');
  (deck.productTruths || []).forEach((t) => lines.push(`- ${t}`));
  if (deck.mechanisms && deck.mechanisms.length) {
    lines.push('UNIQUE MECHANISM:');
    deck.mechanisms.forEach((m) => lines.push(`- ${m}`));
  }
  if (deck.proofPoints && deck.proofPoints.length) {
    lines.push('PROOF POINTS:');
    deck.proofPoints.forEach((p) => lines.push(`- ${p}`));
  }
  lines.push('');
  lines.push('PERSONAS:');
  (deck.personas || []).forEach((p) => {
    lines.push(`- [${p.id}] ${p.name} — ${p.description || ''}`.trim());
    lines.push(`    life: ${p.lifeContext}; wants: ${p.desire}`);
    // Compact inner-life: enough emotional signal for generation + the judge's
    // emotionalTruth axis, without the full arrays (which bloat every call). The
    // complete depth still reaches the insight miner via its own persona block.
    const inner = [
      p.innerMonologue ? `"${p.innerMonologue}"` : '',
      (p.unspokenFears && p.unspokenFears[0]) ? `fears ${p.unspokenFears[0]}` : '',
      p.socialComparison ? `envies ${p.socialComparison}` : '',
      (p.shameMoments && p.shameMoments[0]) ? `stings when ${p.shameMoments[0]}` : '',
      (p.identityLost || p.identityDesired) ? `${p.identityLost || '—'} → ${p.identityDesired || '—'}` : '',
    ].filter(Boolean).join(' · ');
    if (inner) lines.push(`    inner: ${inner}`);
  });
  lines.push('');
  lines.push('PAINS/DESIRES:');
  (deck.pains || []).forEach((p) => {
    lines.push(`- [${p.id}] ${p.label} — ${p.description}`);
    if (p.vocPhrases && p.vocPhrases.length) lines.push(`    they say: "${p.vocPhrases.join('" / "')}"`);
  });
  lines.push('');
  const bv = deck.brandVoice || {};
  lines.push('BRAND VOICE:');
  if (bv.adjectives) lines.push(`- tone: ${bv.adjectives.join(', ')}`);
  if (bv.approvedLanguage) lines.push(`- APPROVED language (prefer these): ${bv.approvedLanguage.join(', ')}`);
  if (bv.bannedLanguage) lines.push(`- BANNED language (never use — hard fail): ${bv.bannedLanguage.join(', ')}`);
  if (bv.notes) lines.push(`- notes: ${bv.notes}`);
  if (deck.constraints && deck.constraints.length) {
    lines.push('CONSTRAINTS:');
    deck.constraints.forEach((c) => lines.push(`- ${c}`));
  }
  const vs = deck.visualStyle;
  if (vs && (vs.typography || (vs.palette && vs.palette.length))) {
    lines.push('VISUAL STYLE:');
    if (vs.typography) lines.push(`- typography: ${vs.typography}`);
    if (vs.palette && vs.palette.length) lines.push(`- palette: ${vs.palette.join(', ')}`);
    if (vs.lightingDefault) lines.push(`- lighting: ${vs.lightingDefault}`);
    if (vs.colorGrading) lines.push(`- color grading: ${vs.colorGrading}`);
  }
  return lines.join('\n');
}

// ─── Source hash ─────────────────────────────────────────────────────────────

/** JSON.stringify with recursively sorted object keys (stable across runs). */
export function canonicalJSON(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      out[k] = sortKeys((value as Record<string, unknown>)[k]);
    }
    return out;
  }
  return value;
}

function computeSourceHash(
  product: Product,
  research: PositioningResearch | null,
  brandConfig: BrandConfig | null,
): string {
  // products has no updated_at — hash the content that feeds the distill.
  const payload = {
    product: {
      name: product.name,
      brand: product.brand,
      sub_brand: product.sub_brand,
      description: product.description,
      ingredients: product.ingredients,
      claims: product.claims,
      color_palette: product.color_palette,
      prompt_modifier: product.prompt_modifier,
      compliance_rules: product.compliance_rules,
      context: product.context,
    },
    research,
    brandConfig: brandConfig
      ? {
          name: brandConfig.name,
          voice: brandConfig.voice,
          visual: brandConfig.visual,
          non_negotiables: brandConfig.non_negotiables,
        }
      : null,
  };
  return createHash('sha256').update(canonicalJSON(payload)).digest('hex');
}

// ─── Context document (the "brand context .md" analog) ──────────────────────

function section(title: string, body: string | null | undefined): string {
  return body && body.trim() ? `## ${title}\n${body.trim()}` : '';
}

function buildContextDocument(
  product: Product,
  research: PositioningResearch | null,
  brandConfig: BrandConfig | null,
): string {
  const ctx = product.context ?? {};
  const parts: string[] = [];
  parts.push(`# Brand Context — ${product.brand} ${product.name}`);
  parts.push(section('Product', [
    `Name: ${product.name}`,
    `Brand: ${product.brand}`,
    product.sub_brand ? `Sub-brand: ${product.sub_brand}` : '',
    product.description ? `Description: ${product.description}` : '',
  ].filter(Boolean).join('\n')));

  if (Array.isArray(product.ingredients) && product.ingredients.length) {
    parts.push(section('Ingredients', product.ingredients
      .map((i) => `- ${i.name}${i.key ? ' (key)' : ''}${i.description ? `: ${i.description}` : ''}`)
      .join('\n')));
  }
  if (Array.isArray(product.claims) && product.claims.length) {
    parts.push(section('Claims & proof', product.claims
      .map((c) => `- ${c.text}${c.stat ? ` (${c.stat})` : ''}${c.source ? ` [source: ${c.source}]` : ''}`)
      .join('\n')));
  }
  if (ctx && Object.keys(ctx).length) {
    parts.push(section('Product context (structured)', JSON.stringify(ctx, null, 2)));
  }
  if (Array.isArray(product.compliance_rules) && product.compliance_rules.length) {
    parts.push(section('Compliance rules (hard — never violate)', product.compliance_rules.map((r) => `- ${r}`).join('\n')));
  }
  if (brandConfig) {
    parts.push(section('Brand configuration', [
      `Brand name: ${brandConfig.name}`,
      Object.keys(brandConfig.voice || {}).length ? `Voice: ${JSON.stringify(brandConfig.voice, null, 2)}` : '',
      Object.keys(brandConfig.visual || {}).length ? `Visual: ${JSON.stringify(brandConfig.visual, null, 2)}` : '',
      brandConfig.non_negotiables?.length ? `Non-negotiables:\n${brandConfig.non_negotiables.map((n) => `- ${n}`).join('\n')}` : '',
    ].filter(Boolean).join('\n')));
  }
  if (research) {
    parts.push(section('Audience research (AI positioning research — deep persona + language source)',
      JSON.stringify(research, null, 2)));
  }
  return parts.filter(Boolean).join('\n\n');
}

// ─── Minimal deck (T3 — pure TS, no LLM) ─────────────────────────────────────

export function buildMinimalDeck(product: Product, brandConfig: BrandConfig | null): ForgeDeck {
  const ctx = product.context ?? {};
  const truths: string[] = [];
  if (product.description) truths.push(product.description);
  (product.claims || []).forEach((c) => truths.push(c.text + (c.stat ? ` (${c.stat})` : '')));
  (ctx.benefits || []).forEach((b) => truths.push(b));
  if (!truths.length) truths.push(`${product.name} by ${product.brand}.`);

  const audience = ctx.target_audience || 'Core customer';
  const persona: DeckPersona = {
    id: 'core-customer',
    name: audience,
    description: `The primary buyer of ${product.name}.`,
    lifeContext: ctx.target_audience
      ? `A real person in the ${ctx.target_audience} audience, living with the problem this product addresses.`
      : `A real person living with the problem ${product.name} addresses.`,
    desire: ctx.after_state || ctx.tagline || `The outcome ${product.name} promises.`,
  };

  const pains = (ctx.benefits && ctx.benefits.length
    ? ctx.benefits.slice(0, 5).map((b, i) => ({
        id: `pain-${i + 1}`,
        label: b,
        description: `The absence of: ${b}.`,
      }))
    : [{
        id: 'core-pain',
        label: ctx.before_state || 'The core problem',
        description: ctx.before_state || `The problem ${product.name} solves.`,
      }]);

  const voice = (brandConfig?.voice ?? {}) as Record<string, unknown>;
  const adjectives = toStringArray(voice.adjectives ?? voice.tone);

  return {
    brand: product.brand,
    product: product.name,
    oneLiner: ctx.tagline || undefined,
    market: ctx.market_flag || undefined,
    price: ctx.price || undefined,
    anchorType: 'pain',
    productTruths: truths,
    mechanisms: [],
    proofPoints: (ctx.stats || []).map((s) => `${s.value} ${s.label}${s.context ? ` (${s.context})` : ''}`),
    personas: [persona],
    pains,
    brandVoice: {
      adjectives: adjectives.length ? adjectives : undefined,
      approvedLanguage: [],
      bannedLanguage: [],
      notes: undefined,
    },
    constraints: [],
    offer: ctx.cta || undefined,
    visualStyle: {},
    referenceImages: [],
  };
}

// ─── Deterministic compliance overlay (never trust the model) ────────────────

function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
  if (typeof v === 'string') return v.split(/[,;\n]\s*/).map((s) => s.trim()).filter(Boolean);
  return [];
}

function brandVoiceWordsToAvoid(brandConfig: BrandConfig | null): string[] {
  if (!brandConfig) return [];
  const voice = (brandConfig.voice ?? {}) as Record<string, unknown>;
  return [
    ...toStringArray(voice['words_to_avoid']),
    ...toStringArray(voice['wordsToAvoid']),
    ...toStringArray(voice['avoid']),
    ...toStringArray(voice['banned_words']),
    ...toStringArray(voice['bannedWords']),
  ];
}

export function applyComplianceOverlay(
  deck: ForgeDeck,
  product: Product,
  brandConfig: BrandConfig | null,
): ForgeDeck {
  const bv = deck.brandVoice || (deck.brandVoice = {});
  const banned = new Set((bv.bannedLanguage || []).map((s) => String(s)));
  (product.compliance_rules || []).forEach((r) => banned.add(r));
  brandVoiceWordsToAvoid(brandConfig).forEach((w) => banned.add(w));
  bv.bannedLanguage = [...banned];

  const constraints = new Set((deck.constraints || []).map((s) => String(s)));
  (product.compliance_rules || []).forEach((r) => constraints.add(r));
  (brandConfig?.non_negotiables || []).forEach((r) => constraints.add(r));
  // prompt_modifier is an operator-authored visual directive — constraints are
  // rendered into every prompt block, so it reaches every generation.
  if (product.prompt_modifier) constraints.add(`Visual directive: ${product.prompt_modifier}`);
  deck.constraints = [...constraints];

  if (Array.isArray(product.color_palette) && product.color_palette.length) {
    deck.visualStyle = deck.visualStyle || {};
    if (!deck.visualStyle.palette || !deck.visualStyle.palette.length) {
      deck.visualStyle.palette = product.color_palette.map((c) =>
        c.usage ? `${c.name} (${c.hex}) — ${c.usage}` : `${c.name} (${c.hex})`,
      );
    }
  }

  // References are resolved live at generation time — never persisted in the deck.
  deck.referenceImages = [];
  return deck;
}

// ─── Admin overrides merge ───────────────────────────────────────────────────

const OVERRIDE_SKIP_KEYS = new Set(['personas', 'pains', 'brandVoice', 'constraints']);

/**
 * Deep-merge admin overrides on top of a distilled deck.
 * Personas/pains match by id (merge fields; unmatched ids append).
 * brandVoice array fields are unioned; notes replaces. constraints are unioned.
 * Any other top-level key replaces the deck value when provided.
 */
export function applyOverrides(deck: ForgeDeck, overrides: DeckOverrides | null | undefined): ForgeDeck {
  const out: ForgeDeck = structuredClone(deck);
  if (!overrides || typeof overrides !== 'object') return out;

  if (Array.isArray(overrides.personas)) {
    for (const patch of overrides.personas) {
      if (!patch || !patch.id) continue;
      const i = out.personas.findIndex((p) => p.id === patch.id);
      if (i === -1) out.personas.push(patch as DeckPersona);
      else out.personas[i] = { ...out.personas[i], ...prune(patch) };
    }
  }
  if (Array.isArray(overrides.pains)) {
    for (const patch of overrides.pains) {
      if (!patch || !patch.id) continue;
      const i = out.pains.findIndex((p) => p.id === patch.id);
      if (i === -1) out.pains.push(patch as ForgeDeck['pains'][number]);
      else out.pains[i] = { ...out.pains[i], ...prune(patch) };
    }
  }
  if (overrides.brandVoice && typeof overrides.brandVoice === 'object') {
    const bv = out.brandVoice || (out.brandVoice = {});
    const o = overrides.brandVoice;
    for (const key of ['adjectives', 'approvedLanguage', 'bannedLanguage'] as const) {
      if (Array.isArray(o[key])) bv[key] = [...new Set([...(bv[key] || []), ...o[key]!])];
    }
    if (typeof o.notes === 'string') bv.notes = o.notes;
  }
  if (Array.isArray(overrides.constraints)) {
    out.constraints = [...new Set([...(out.constraints || []), ...overrides.constraints])];
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (OVERRIDE_SKIP_KEYS.has(k) || v === undefined || v === null) continue;
    (out as unknown as Record<string, unknown>)[k] = v;
  }
  // Overrides can never re-introduce persisted reference images.
  out.referenceImages = [];
  return out;
}

function prune<T extends object>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

// ─── Persona enrichment (anti-truncation: one small call per persona) ───────

interface EnrichOutput {
  innerMonologue?: string;
  unspokenFears?: string[];
  socialComparison?: string;
  shameMoments?: string[];
  identityLost?: string;
  identityDesired?: string;
}

async function enrichOnePersona(deck: ForgeDeck, persona: DeckPersona): Promise<EnrichOutput> {
  const banned = (deck.brandVoice && deck.brandVoice.bannedLanguage) || [];
  const painLines = (deck.pains || []).map((p) => `- ${p.label}: ${p.description || ''}`).join('\n');
  const userMsg = [
    `BRAND: ${deck.brand} — ${deck.product || ''}`,
    banned.length ? `BANNED LANGUAGE (never use, even in these fields): ${banned.join(', ')}` : '',
    deck.brandVoice && deck.brandVoice.notes ? `BRAND NOTES: ${deck.brandVoice.notes}` : '',
    '',
    'PERSONA — imagine HER, one real person:',
    `[${persona.id}] ${persona.name}: ${persona.description || ''}`,
    `life: ${persona.lifeContext || ''}`,
    `wants: ${persona.desire || ''}`,
    painLines ? `\nTHE PAINS SHE LIVES WITH:\n${painLines}` : '',
    '',
    'Return her innerMonologue, unspokenFears (2–3), socialComparison, shameMoments (2–3 concrete scenes), identityLost, identityDesired.',
  ].filter(Boolean).join('\n');

  const response = await callClaude({
    model: MODELS.sonnet,
    maxTokens: 4000,
    system: ENRICH_SYSTEM,
    messages: [{ role: 'user', content: userMsg }],
    tools: [ENRICH_TOOL],
    toolChoice: { type: 'tool', name: 'emit_persona_inner_life' },
  });
  return extractToolInput<EnrichOutput>(response, 'emit_persona_inner_life');
}

/**
 * Deepen personas that lack inner-life fields (parallel per-persona Sonnet
 * calls — CF's anti-truncation pattern). Merges only into empty fields.
 * Best-effort: per-persona failures are tolerated; never blocks a build.
 */
export async function enrichPersonas(deck: ForgeDeck): Promise<ForgeDeck> {
  if (!deck || !Array.isArray(deck.personas) || !deck.personas.length) return deck;
  const targets = deck.personas.filter((p) => p && !p.innerMonologue);
  if (!targets.length) return deck;
  try {
    const results = await Promise.all(targets.map((p) =>
      enrichOnePersona(deck, p).then((e) => ({ id: p.id, e: e as EnrichOutput | null })).catch(() => ({ id: p.id, e: null }))));
    const byId = new Map(results.filter((r) => r.e).map((r) => [r.id, r.e as EnrichOutput]));
    deck.personas = deck.personas.map((p) => {
      const e = byId.get(p.id);
      if (!e) return p;
      const merged: DeckPersona = { ...p };
      for (const k of ['innerMonologue', 'socialComparison', 'identityLost', 'identityDesired'] as const) {
        if (!merged[k] && e[k]) merged[k] = e[k];
      }
      for (const k of ['unspokenFears', 'shameMoments'] as const) {
        if ((!merged[k] || !merged[k]!.length) && Array.isArray(e[k]) && e[k]!.length) merged[k] = e[k];
      }
      return merged;
    });
  } catch (err) {
    console.error('[forge/deck] persona enrichment skipped:', err instanceof Error ? err.message : err);
  }
  return deck;
}

// ─── Distillation ────────────────────────────────────────────────────────────

function deckLooksValid(deck: ForgeDeck | null | undefined): deck is ForgeDeck {
  return !!(
    deck &&
    Array.isArray(deck.personas) && deck.personas.length >= 1 &&
    deck.brandVoice && typeof deck.brandVoice === 'object'
  );
}

async function distillDeck(doc: string, reducedScope: boolean): Promise<ForgeDeck> {
  const system = reducedScope
    ? DISTILL_SYSTEM +
      ' IMPORTANT: keep the deck SHORT — at most 3 personas and 5 pains, one line each — but you MUST return at least one persona and a brandVoice object.'
    : DISTILL_SYSTEM;
  const response = await callClaude({
    model: MODELS.sonnet,
    maxTokens: 8000,
    system,
    messages: [{ role: 'user', content: `Brand context document:\n\n${doc}` }],
    tools: [DECK_TOOL],
    toolChoice: { type: 'tool', name: 'emit_grounding_deck' },
  });
  return extractToolInput<ForgeDeck>(response, 'emit_grounding_deck');
}

// ─── getOrBuildDeck / getDeckForSession ──────────────────────────────────────

export interface DeckResult {
  /** Distilled deck with admin overrides merged on top (what prompts consume). */
  deck: ForgeDeck;
  /** Pre-rendered deckToPromptBlock(deck) — byte-stable prompt-cache prefix. */
  promptBlock: string;
  depth: DeckDepth;
  sourceHash: string;
  distilledAt: string | null;
  overrides: DeckOverrides;
}

interface ProductDeckRow {
  product_id: string;
  deck: ForgeDeck;
  overrides: DeckOverrides | null;
  prompt_block: string | null;
  source_hash: string;
  model_id: string | null;
  distilled_at: string | null;
}

function depthOfHash(sourceHash: string, hadResearch: boolean): DeckDepth {
  if (sourceHash.startsWith('minimal:')) return 'minimal';
  return hadResearch ? 'research' : 'context';
}

async function loadSources(service: SupabaseClient, productId: string): Promise<{
  product: Product;
  research: PositioningResearch | null;
  brandConfig: BrandConfig | null;
}> {
  const { data: product, error: prodErr } = await service
    .from('products').select('*').eq('id', productId).single();
  if (prodErr || !product) throw new Error(`Product ${productId} not found: ${prodErr?.message ?? 'missing'}`);

  const [{ data: brandConfig }, { data: researchRow }] = await Promise.all([
    service.from('brand_config').select('*').eq('id', 1).maybeSingle(),
    service
      .from('positioning_research')
      .select('research')
      .eq('product_name', (product as Product).name)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    product: product as Product,
    research: (researchRow?.research as PositioningResearch) ?? null,
    brandConfig: (brandConfig as BrandConfig) ?? null,
  };
}

/**
 * Load (or build) the grounding deck for a product.
 * Cache hit = matching source_hash in product_decks. `force` rebuilds always.
 * Concurrent first-builds are benign last-write-wins upserts.
 */
export async function getOrBuildDeck(
  service: SupabaseClient,
  productId: string,
  opts: { force?: boolean } = {},
): Promise<DeckResult> {
  const { product, research, brandConfig } = await loadSources(service, productId);
  const hash = computeSourceHash(product, research, brandConfig);

  const { data: existingRaw } = await service
    .from('product_decks').select('*').eq('product_id', productId).maybeSingle();
  const existing = (existingRaw as ProductDeckRow | null) ?? null;
  const overrides: DeckOverrides = (existing?.overrides as DeckOverrides) ?? {};

  if (existing && !opts.force && existing.source_hash === hash) {
    const merged = applyOverrides(existing.deck, overrides);
    return {
      deck: merged,
      promptBlock: existing.prompt_block ?? deckToPromptBlock(merged),
      depth: depthOfHash(existing.source_hash, !!research),
      sourceHash: existing.source_hash,
      distilledAt: existing.distilled_at,
      overrides,
    };
  }

  // ── Tiered build ──
  let deck: ForgeDeck | null = null;
  let depth: DeckDepth = research ? 'research' : 'context';
  const doc = buildContextDocument(product, research, brandConfig);

  try {
    deck = await distillDeck(doc, false);
    if (!deckLooksValid(deck)) {
      // Retry once with reduced scope before falling back to the minimal deck.
      deck = await distillDeck(doc, true);
    }
  } catch (err) {
    console.error('[forge/deck] distill failed:', err instanceof Error ? err.message : err);
    try {
      deck = await distillDeck(doc, true);
    } catch (err2) {
      console.error('[forge/deck] reduced-scope distill failed:', err2 instanceof Error ? err2.message : err2);
      deck = null;
    }
  }

  let storedHash = hash;
  if (!deckLooksValid(deck)) {
    deck = buildMinimalDeck(product, brandConfig);
    depth = 'minimal';
    // Prefixed hash never matches a computed hash, so the next session retries
    // the full distill automatically.
    storedHash = `minimal:${hash}`;
  } else {
    // Deepen personas that came back without inner-life fields (T1 gaps + all of T2).
    await enrichPersonas(deck);
  }

  applyComplianceOverlay(deck, product, brandConfig);

  const merged = applyOverrides(deck, overrides);
  const promptBlock = deckToPromptBlock(merged);
  const distilledAt = new Date().toISOString();

  const { error: upsertErr } = await service.from('product_decks').upsert(
    {
      product_id: productId,
      deck,
      overrides,
      prompt_block: promptBlock,
      source_hash: storedHash,
      model_id: depth === 'minimal' ? null : MODELS.sonnet,
      distilled_at: distilledAt,
    },
    { onConflict: 'product_id' },
  );
  if (upsertErr) console.error('[forge/deck] product_decks upsert failed:', upsertErr.message);

  return { deck: merged, promptBlock, depth, sourceHash: storedHash, distilledAt, overrides };
}

/**
 * Fast in-session deck load: reads product_decks (building it only when the
 * row is missing) and merges overrides. Deliberately does NOT check hash
 * staleness — mid-session routes must never stall on a 30-60s re-distill;
 * staleness is reconciled at session create / admin rebuild.
 */
export async function getDeckForSession(
  service: SupabaseClient,
  productId: string,
): Promise<DeckResult> {
  const { data: rowRaw } = await service
    .from('product_decks').select('*').eq('product_id', productId).maybeSingle();
  const row = (rowRaw as ProductDeckRow | null) ?? null;
  if (!row) return getOrBuildDeck(service, productId);
  const overrides: DeckOverrides = (row.overrides as DeckOverrides) ?? {};
  const merged = applyOverrides(row.deck, overrides);
  return {
    deck: merged,
    promptBlock: row.prompt_block ?? deckToPromptBlock(merged),
    depth: depthOfHash(row.source_hash, true),
    sourceHash: row.source_hash,
    distilledAt: row.distilled_at,
    overrides,
  };
}
