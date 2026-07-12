/**
 * Creative-strategy knowledge access: taxonomies, archetype families, and
 * per-format composition recipes. Ported from Concept Forge lib/knowledge.js
 * with static JSON imports (bundled — no __dirname fs reads).
 */
import taxonomiesJson from './knowledge/taxonomies.json';
import familiesJson from './knowledge/archetype-families.json';
import formatCompositionJson from './knowledge/format-composition.json';
import type {
  Taxonomies,
  VisualFormat,
  CreativeMechanic,
  AwarenessStage,
  ConstraintCard,
  ForgeDeck,
} from './types';

export const taxonomies = taxonomiesJson as unknown as Taxonomies;

export interface ArchetypeFamily {
  genre?: string;
  composition?: string;
  mood?: string;
  style?: string;
  camera?: Record<string, string>;
  textZone?: string;
  productPlacement?: string;
  grammarNote?: string;
  negatives?: string[];
}

export interface FormatCompositionEntry extends ArchetypeFamily {
  family?: string;
  stageFlex?: boolean;
}

export const families = familiesJson as unknown as Record<string, ArchetypeFamily>;
const formatComposition = formatCompositionJson as unknown as Record<string, FormatCompositionEntry | string>;

export interface CompositionRecipe {
  family: string;
  genre?: string;
  composition?: string;
  mood?: string;
  style?: string;
  camera: Record<string, string>;
  textZone?: string;
  productPlacement?: string;
  grammarNote?: string;
  negatives: string[];
}

// Which awareness stages each funnel token covers.
const FUNNEL_TO_STAGES: Record<string, string[]> = {
  TOF: ['unaware', 'problem-aware'],
  MOF: ['solution-aware', 'product-aware'],
  BOF: ['most-aware'],
  Full: ['unaware', 'problem-aware', 'solution-aware', 'product-aware', 'most-aware'],
};

export function stagesForFunnel(funnel: string): string[] {
  const tokens = String(funnel).split('-'); // e.g. "TOF-MOF" -> ["TOF","MOF"]
  const set = new Set<string>();
  for (const t of tokens) (FUNNEL_TO_STAGES[t] || []).forEach((s) => set.add(s));
  if (set.size === 0) FUNNEL_TO_STAGES.Full.forEach((s) => set.add(s));
  return [...set];
}

// Concept Forge is a STATIC-IMAGE-ONLY tool. Only formats that can be executed as a still.
export function staticFormats(): VisualFormat[] {
  return taxonomies.formats.filter((f) => f.medium === 'Static' || f.medium === 'Video/Static');
}

/** Formats that naturally fit a given awareness stage (optionally filtered by medium). */
export function formatsForStage(stageId: string, medium?: string): VisualFormat[] {
  return taxonomies.formats.filter((f) => {
    const stageOk = stagesForFunnel(f.funnel).includes(stageId);
    const mediumOk = !medium || medium === 'Any' || f.medium === medium || f.medium === 'Video/Static';
    return stageOk && mediumOk;
  });
}

/** Mechanics whose stageFit includes the stage (falls back to all if none match). */
export function mechanicsForStage(stageId: string): CreativeMechanic[] {
  const fit = taxonomies.mechanics.filter((m) => m.stageFit.includes(stageId));
  return fit.length ? fit : taxonomies.mechanics;
}

export function stageById(id: string): AwarenessStage | null {
  return taxonomies.awarenessStages.find((s) => s.id === id) || null;
}

export function constraintById(id: string): ConstraintCard | null {
  return taxonomies.constraintCards.find((c) => c.id === id) || null;
}

// Map a visual format to the closest ad-creative-generator category (for export).
export function formatToAdCategory(formatName: string): string {
  const staticProducty = ['Statistic', 'Feature Benefit Callout', 'Billboard', 'Press', 'Case Study'];
  const ugcy = ['Selfie', 'Native Text Overlay', 'Text Message', 'Notes App', 'Review', 'Testimonial', 'Comment Response', 'Letter', 'Post It'];
  const infographicy = ['Listicle', 'How-To', 'Grid Swap', 'Statistic', 'Case Study'];
  if (formatName === 'Statistic' || formatName === 'Feature Benefit Callout') return 'infographics';
  if (staticProducty.includes(formatName)) return 'product-hero';
  if (ugcy.includes(formatName)) return 'ugc-style';
  if (infographicy.includes(formatName)) return 'infographics';
  return 'lifestyle';
}

// Does the brand forbid before/after imagery? (compliance guard for BEFORE_AFTER family)
export function deckBansBeforeAfter(deck: ForgeDeck | null | undefined): boolean {
  if (!deck) return false;
  const hay = [
    ...(deck.constraints || []),
    (deck.brandVoice && deck.brandVoice.notes) || '',
    ...((deck.brandVoice && deck.brandVoice.bannedLanguage) || []),
  ].join(' \n ').toLowerCase();
  return /before\s*[-/&]?\s*after|before and after|doctored|digitally altered/.test(hay);
}

function categoryToFamily(cat: string): string {
  return ({ 'product-hero': 'PRODUCT_HERO', 'ugc-style': 'TESTIMONIAL_NATIVE', infographics: 'EDUCATIONAL_DEMYSTIFY', lifestyle: 'LIFESTYLE_ASPIRATION' } as Record<string, string>)[cat] || 'PRODUCT_HERO';
}

function compositionEntry(format: string): FormatCompositionEntry | null {
  const entry = formatComposition[format];
  return entry && typeof entry === 'object' ? entry : null;
}

/**
 * Resolve the composition recipe for a concept: per-format override ⊕ family default,
 * adjusted by awareness stage for stage-flexible formats, and guarded so a brand that
 * bans before/after never gets the BEFORE_AFTER family.
 */
export function formatToComposition(
  format: string,
  awarenessStage?: string,
  mechanic?: string,
  deck?: ForgeDeck | null,
): CompositionRecipe {
  void mechanic; // kept for signature parity with Concept Forge
  const entry = compositionEntry(format);
  let familyId = (entry && entry.family) || categoryToFamily(formatToAdCategory(format));

  // Stage-flexible formats (Split Screen, Time Lapse, Us vs. Them) lean transformation early-funnel.
  if (entry && entry.stageFlex && (awarenessStage === 'problem-aware' || awarenessStage === 'solution-aware')) {
    familyId = 'BEFORE_AFTER';
  }
  // Compliance guard: downgrade before/after to a neutral contrast when the brand forbids it.
  if (familyId === 'BEFORE_AFTER' && deckBansBeforeAfter(deck)) familyId = 'CONTRAST';

  const fam = families[familyId] || families.PRODUCT_HERO;
  const pick = <K extends keyof ArchetypeFamily>(k: K): ArchetypeFamily[K] =>
    entry && entry[k] != null ? (entry[k] as ArchetypeFamily[K]) : fam[k];
  return {
    family: familyId,
    genre: pick('genre'),
    composition: pick('composition'),
    mood: pick('mood'),
    style: pick('style'),
    camera: { ...(fam.camera || {}), ...((entry && entry.camera) || {}) },
    textZone: pick('textZone'),
    productPlacement: pick('productPlacement'),
    grammarNote: pick('grammarNote'),
    negatives: [...new Set([...(fam.negatives || []), ...((entry && entry.negatives) || [])])],
  };
}
