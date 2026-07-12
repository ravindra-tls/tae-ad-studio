/**
 * Concept Forge — client-side contract types.
 *
 * These mirror the /api/forge/* contract (built in parallel by the backend).
 * The client owns its own definitions on purpose: no imports from lib/forge
 * server modules ever reach client bundles.
 */

// ── Cards ────────────────────────────────────────────────────────────────────

export interface CardDna {
  awarenessStage: string;
  mechanic: string;
  format: string;
  hookTactic?: string;
  persona: string;
  pain: string;
  trigger?: string;
}

export interface CardScores {
  overall: number;
  productTruth?: number;
  emotionalTruth?: number;
  specificity?: number;
  concreteness?: number;
  scrollStop?: number;
  brandVoice?: number;
  note?: string;
}

export interface ConceptCard {
  id: string;
  tagline: string;
  emotionalInsight?: string;
  messagingAngle: string;
  visualIdea?: string;
  cta?: string;
  concept: string;
  primaryText?: string;
  dna: CardDna;
  scores: CardScores;
}

// ── Champions (finalized concepts) ──────────────────────────────────────────

export interface Champion {
  headline: string;
  taglines: string[];
  concept: string;
  primaryText: string;
  whyItWorks: string;
  complianceCheck: string;
  visualIdea?: string;
  cta?: string;
}

export interface ChampionEntry {
  id: string; // card id
  at?: string;
  dna?: CardDna;
  champion: Champion;
}

// ── Pins / insights / chat ───────────────────────────────────────────────────

export interface MinedInsight {
  id: string;
  emotion?: string;
  tension: string;
  momentItStings?: string;
  whyItsTrue?: string;
}

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
  product?: string;
  notes?: string;
  constraints?: string[];
  enhancers?: string[];
  insights?: MinedInsight[];
}

/** Pin keys that hold a single string value. */
export type PinKey =
  | 'persona' | 'pain' | 'awarenessStage'
  | 'angle' | 'mechanic' | 'format' | 'hookTactic'
  | 'tagline' | 'visualIdea' | 'cta' | 'product' | 'notes';

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  cards?: ConceptCard[];
}

export interface InsightsCacheEntry {
  insights?: MinedInsight[];
  pending?: boolean;
}

export interface UserRef {
  url: string;
  path: string;
}

// ── Session (the forge state doc) ────────────────────────────────────────────

export interface ForgeSession {
  id: string;
  rev: number;
  board: ConceptCard[];
  pins: ForgePins;
  chat: ChatMessage[];
  champions: ChampionEntry[];
  insightsCache: Record<string, InsightsCacheEntry>;
  genePool: Record<string, unknown>;
  suppressed: unknown[];
  favorites: string[];
  history: unknown[];
  score: number;
  streak: number;
  userRefs: UserRef[];
}

// ── Deck (trimmed) + taxonomies ──────────────────────────────────────────────

export interface DeckPersona {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface DeckPain {
  id: string;
  label: string;
  vocPhrases?: string[];
  [key: string]: unknown;
}

export interface TrimmedDeck {
  brand: string;
  product?: string;
  oneLiner?: string;
  anchorType?: string;
  personas: DeckPersona[];
  pains: DeckPain[];
  approvedLanguage?: string[];
}

export interface TaxStage { id: string; name: string; }
export interface TaxMechanic { name: string; [key: string]: unknown; }
export interface TaxFormat { name: string; medium?: string; [key: string]: unknown; }
export interface ConstraintCard { id: string; label: string; instruction?: string; }
export interface ConversionEnhancer { id: string; label: string; [key: string]: unknown; }

export interface Taxonomies {
  stages: TaxStage[];
  mechanics: TaxMechanic[];
  hookTactics: string[];
  formats: TaxFormat[];
  constraintCards: ConstraintCard[];
  ctaOptions: string[];
  conversionEnhancers: ConversionEnhancer[];
}

// ── Templates + export record ────────────────────────────────────────────────

export interface ForgeTemplate {
  number: number;
  name: string;
  category: string;
  aspect_ratio: string;
  preview_image_url: string | null;
  people_ok: boolean;
  features_person: boolean;
  has_headline_slot: boolean;
}

/**
 * Minimal card shape the detail view works with — a full board card when the
 * concept is still on the board, else a champion-derived stand-in (CF's
 * championCardLike).
 */
export interface DetailCardLike {
  id: string;
  dna?: CardDna;
  tagline?: string;
  emotionalInsight?: string;
  messagingAngle?: string;
  visualIdea?: string;
  cta?: string;
  concept?: string;
  primaryText?: string;
  scores?: CardScores;
}

export interface ExportTemplateInfo {
  number: number | null;
  name?: string;
  category?: string;
  aspect_ratio?: string;
  preview_image_url?: string | null;
  auto_suggested?: boolean;
}

export interface TextZone {
  element: string;
  position: string;
  text: string;
}

export interface ExportRecord {
  prompt: string;
  negative_prompt?: string;
  settings: { aspect_ratio?: string; model?: string; [key: string]: unknown };
  template?: ExportTemplateInfo;
  text_zones?: TextZone[];
  warnings?: string[];
  reference_images?: string[];
  enhancers?: string[];
  concept_notes?: string;
  format?: string;
  _concept_forge?: { visualIdea?: string; [key: string]: unknown };
}

// ── Misc ─────────────────────────────────────────────────────────────────────

export interface DealStats {
  generated: number;
  passed: number;
  [key: string]: unknown;
}

export interface CommentItem {
  quote: string;
  comment: string;
}

export type ImageQuality = 'low' | 'medium' | 'high';

export interface Loadout {
  count: number;
  medium: string;
}

// ── API responses ────────────────────────────────────────────────────────────

export interface SessionResponse {
  session: ForgeSession;
  /** POST /api/forge/session returns these; GET may also include them. */
  deck?: TrimmedDeck;
  taxonomies?: Taxonomies;
}

export interface TaxonomiesResponse extends Taxonomies {}

export interface ChatResponse {
  reply: string;
  cards?: ConceptCard[];
  pins?: ForgePins;
  suggestions?: string[];
  session: ForgeSession;
}

export interface BreedResponse {
  cards: ConceptCard[];
  stats?: DealStats;
  session: ForgeSession;
}

export interface ReactResponse { session: ForgeSession; }
export interface PinsResponse { session: ForgeSession; }

export interface InsightsResponse {
  insights: MinedInsight[];
  cached?: boolean;
  session: ForgeSession;
}

export interface RefineResponse {
  card: ConceptCard;
  session: ForgeSession;
}

export interface ChampionResponse {
  champion: Champion;
  session: ForgeSession;
}

export interface ExportResponse {
  record: ExportRecord;
  error?: string;
  session?: ForgeSession;
}

export interface TemplatesResponse { templates: ForgeTemplate[]; }

export interface ReferencesResponse {
  userRefs: UserRef[];
  session: ForgeSession;
}

export interface GenerateImageResponse {
  imageId: string;
  imageUrl: string;
  status: string;
}

export type DealStreamMsg =
  | { type: 'card'; card: ConceptCard }
  | { type: 'done'; stats?: DealStats; session: ForgeSession }
  | { type: 'error'; error: string };

/** Product reference image resolved server-side and passed as a page prop. */
export interface ProductRefImage {
  url: string;
  label: string | null;
}
