/**
 * Concept Forge domain types.
 *
 * ForgeState is the single jsonb document stored per session in
 * `forge_states.state`, mutated via optimistic CAS on `rev`
 * (see lib/forge/state.ts). Everything in it must stay JSON-serializable.
 */

// ─── Cards ────────────────────────────────────────────────────────────────────

export interface CardDna {
  persona?: string;
  pain?: string;
  awarenessStage?: string;
  mechanic?: string;
  format?: string;
  hookTactic?: string;
  trigger?: string;
  voicePattern?: string;
}

export interface CardScores {
  productTruth: number;
  emotionalTruth: number;
  specificity: number;
  concreteness: number;
  scrollStop: number;
  brandVoice: number;
  overall: number;
  bannedLanguageViolation: boolean;
  note?: string;
}

export interface ForgeCard {
  id: string;
  dna: CardDna;
  emotionalInsight?: string;
  messagingAngle?: string;
  concept?: string;
  tagline?: string;
  visualIdea?: string;
  hookSpoken?: string;
  hookVisual?: string;
  hookTextOverlay?: string;
  primaryText?: string;
  cta?: string;
  rationale?: string;
  /** Board handle of the card this one refines/replaces (director turns only). */
  replaces?: string;
  scores?: CardScores | null;
  gatePass?: boolean;
  gateReason?: string;
}

// ─── Insights / pins ─────────────────────────────────────────────────────────

export interface ForgeInsight {
  id: string;
  tension: string;
  momentItStings?: string;
  emotion?: string;
  whyItsTrue?: string;
  adAngle?: string;
}

/** The assembly chain — user-pinned parts. An empty string clears a slot. */
export interface ForgePins {
  persona?: string;
  pain?: string;
  awarenessStage?: string;
  angle?: string;
  mechanic?: string;
  format?: string;
  hookTactic?: string;
  tagline?: string;
  visualIdea?: string;
  cta?: string;
  insights?: ForgeInsight[];
  constraints?: string[];
  enhancers?: string[];
  product?: '' | 'show' | 'hide';
  notes?: string;
  [key: string]: unknown;
}

/** Pins + per-deal knobs merged into one generation loadout. */
export interface ForgeLoadout extends ForgePins {
  count?: number;
  medium?: string;
}

// ─── Chat / champions / caches ───────────────────────────────────────────────

export interface ForgeChatMessage {
  role: 'user' | 'assistant';
  text: string;
  at: string;
  /** Card refs riding on assistant replies so replies stay linked to concepts. */
  cards?: Array<{ id: string; tagline?: string }>;
  [key: string]: unknown;
}

export interface ChampionOutput {
  headline: string;
  taglines: string[];
  concept: string;
  visualIdea: string;
  hookSpoken?: string;
  hookVisual?: string;
  hookTextOverlay?: string;
  primaryText?: string;
  beats?: string[];
  whyItWorks: string;
  complianceCheck: string;
}

export interface ChampionEntry {
  id: string;
  dna?: CardDna;
  champion: ChampionOutput;
  at: string;
}

export interface InsightsCacheEntry {
  at: string;
  insights: ForgeInsight[];
  /** Set while an Opus mining call is in flight (two-tab idempotency marker). */
  pending?: boolean;
}

export interface ForgeHistoryEntry {
  type: string;
  at: string;
  [key: string]: unknown;
}

/** A session-scoped uploaded reference image (durable public bucket URL + path). */
export interface UserRef {
  url: string;
  path: string;
}

// ─── The state document ──────────────────────────────────────────────────────

export interface ForgeState {
  /** Working set of concept cards, newest first. Cap 100 (oldest non-favorite evicted). */
  board: ForgeCard[];
  pins: ForgePins;
  /** Conversation with the creative partner. Cap 60. */
  chat: ForgeChatMessage[];
  champions: ChampionEntry[];
  /** Mined human-tension insights keyed by persona or persona::pain. */
  insightsCache: Record<string, InsightsCacheEntry>;
  /** Dimension-weight reinforcement from keeps/discards, keyed "dim:value". */
  genePool: Record<string, number>;
  suppressed: string[];
  favorites: ForgeCard[];
  /** Action log. Cap 200. */
  history: ForgeHistoryEntry[];
  score: number;
  streak: number;
  /** Session reference-image uploads. */
  userRefs: UserRef[];
}

// ─── Grounding deck ──────────────────────────────────────────────────────────

export interface DeckPersona {
  id: string;
  name: string;
  description?: string;
  lifeContext?: string;
  desire?: string;
  // Inner emotional life — the unspoken truths a great marketer imagines.
  innerMonologue?: string;
  unspokenFears?: string[];
  socialComparison?: string;
  shameMoments?: string[];
  identityLost?: string;
  identityDesired?: string;
}

export interface DeckPain {
  id: string;
  label: string;
  description?: string;
  vocPhrases?: string[];
}

export interface DeckBrandVoice {
  adjectives?: string[];
  approvedLanguage?: string[];
  bannedLanguage?: string[];
  notes?: string;
}

export interface DeckVisualStyle {
  typography?: string;
  palette?: string[];
  lightingDefault?: string;
  colorGrading?: string;
}

export interface ForgeDeck {
  brand: string;
  product: string;
  oneLiner?: string;
  market?: string;
  price?: string;
  anchorType: 'pain' | 'desire';
  productTruths: string[];
  mechanisms?: string[];
  proofPoints?: string[];
  personas: DeckPersona[];
  pains: DeckPain[];
  brandVoice: DeckBrandVoice;
  constraints?: string[];
  offer?: string;
  visualStyle?: DeckVisualStyle;
  /** Always empty in TAE — reference images are resolved live at generation time. */
  referenceImages?: string[];
}

/** How much grounding the deck was distilled from. */
export type DeckDepth = 'research' | 'context' | 'minimal';

/**
 * Durable admin edits stored in `product_decks.overrides`, merged on top of
 * the distilled deck at every load so they survive re-distills.
 * Personas/pains are matched by id (merge; unmatched ids append).
 * brandVoice array fields are unioned; notes replaces when provided.
 */
export interface DeckOverrides {
  personas?: Array<Partial<DeckPersona> & { id: string }>;
  pains?: Array<Partial<DeckPain> & { id: string }>;
  brandVoice?: Partial<DeckBrandVoice>;
  constraints?: string[];
  [key: string]: unknown;
}

// ─── Taxonomies (knowledge/taxonomies.json shape) ────────────────────────────

export interface AwarenessStage {
  id: string;
  name: string;
  who: string;
  strategy: string;
}

export interface CreativeMechanic {
  name: string;
  move: string;
  stageFit: string[];
}

export interface PsychTrigger {
  name: string;
  use: string;
}

export interface VoicePattern {
  name: string;
  job: string;
}

export interface VisualFormat {
  name: string;
  medium: string;
  funnel: string;
}

export interface ConstraintCard {
  id: string;
  label: string;
  instruction: string;
}

export interface ConversionEnhancer {
  id: string;
  label: string;
  badge: string;
  match?: string[];
}

export interface Taxonomies {
  awarenessStages: AwarenessStage[];
  mechanics: CreativeMechanic[];
  triggers: PsychTrigger[];
  hookTactics: string[];
  voicePatterns: VoicePattern[];
  formats: VisualFormat[];
  constraintCards: ConstraintCard[];
  ctaOptions: string[];
  conversionEnhancers: ConversionEnhancer[];
}

// ─── Export record ───────────────────────────────────────────────────────────

export interface ExportTemplateMeta {
  number: number | null;
  name: string;
  category: string;
  aspect_ratio: string;
  preview_image_url: string | null;
  auto_suggested: boolean;
}

export interface ExportTextZone {
  element: string;
  position: string;
  text: string;
}

export interface ExportRecord {
  prompt: string;
  negative_prompt: string;
  category: string;
  archetype: string;
  format: string;
  settings: {
    model: string;
    aspect_ratio: string;
    resolution: string;
    template_number: number | null;
    template_name: string;
  };
  template: ExportTemplateMeta;
  text_zones: ExportTextZone[];
  warnings: string[];
  reference_images: string[];
  enhancers: string[];
  concept_notes: string;
  _concept_forge: {
    headline: string;
    taglines: string[];
    visualIdea?: string;
    cta?: string;
    dna: CardDna;
    messagingAngle?: string;
    scores: CardScores | null;
  };
}

// ─── Client-safe session projection ──────────────────────────────────────────

export interface ForgeSessionView {
  id: string;
  rev: number;
  productId: string;
  name: string;
  score: number;
  streak: number;
  favorites: ForgeCard[];
  genePool: Record<string, number>;
  suppressed: string[];
  champions: ChampionEntry[];
  history: ForgeHistoryEntry[];
  board: ForgeCard[];
  pins: ForgePins;
  chat: ForgeChatMessage[];
  insightsCache: Record<string, InsightsCacheEntry>;
  userRefs: UserRef[];
}

/** Trimmed deck subset returned to the client on session create/load. */
export interface ForgeDeckView {
  brand: string;
  product: string;
  oneLiner?: string;
  anchorType: 'pain' | 'desire';
  personas: DeckPersona[];
  pains: DeckPain[];
  referenceImages: string[];
  approvedLanguage: string[];
}
