export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'user' | 'admin';
  usage_cap: number;
  usage_count: number;
  cycle_reset: string;
  created_at: string;
}

export interface FeatureFlag {
  name: string;
  description: string | null;
  enabled: boolean;
  allowed_user_ids: string[];
  rollout_percentage: number;
  updated_at: string;
  updated_by: string | null;
}

/**
 * Singleton brand configuration (id is always 1).
 *
 * `voice` and `visual` are open-ended JSONB — their shape is still evolving as
 * V1 beds in. Treat them as free-form key/value objects for now. The pipeline
 * passes them into Claude as prompt context.
 */
export interface BrandConfig {
  id: 1;
  name: string;
  voice: Record<string, unknown>;
  visual: Record<string, unknown>;
  non_negotiables: string[];
  default_strictness: 'off' | 'loose' | 'tight';
  updated_at: string;
  updated_by: string | null;
}

export interface ProductContext {
  // Colors (named + hex)
  primary_color?:    { name: string; hex: string };
  accent_color?:     { name: string; hex: string };
  contrast_color?:   { name: string; hex: string };
  tint_color?:       { name: string; hex: string };
  dark_color?:       { name: string; hex: string };
  background_color?: { name: string; hex: string };

  // Product identity
  tagline?:             string;   // 1-line hero tagline
  product_description?: string;   // packaging / visual description for image gen
  product_category?:    string;   // "Eye Contour Cream"
  price?:               string;   // "$XX" or "SGD 59"
  website?:             string;

  // Audience
  target_audience?: string;   // "Women 40-65+"
  market_flag?:     string;   // "🇸🇬" emoji

  // Ordered benefits (maps to [BENEFIT 1] through [BENEFIT 5])
  benefits?: string[];

  // Proof stats: maps to [STAT 1] … [STAT 5]
  stats?: Array<{ value: string; label: string; context?: string }>;

  // Social proof summary
  review_count?:  string;   // "64+"
  social_proof?:  string;   // "110 women tested"

  // Transformation narrative
  before_state?: string;
  after_state?:  string;
  timeframe?:    string;   // "8 weeks"

  // Scene/visual context
  surface?:  string;   // "marble countertop"
  setting?:  string;   // "bright bathroom / vanity"
  mood?:     string;   // "warm, aspirational, clinical-yet-luxurious"

  // CTAs & short copy
  cta?:           string;
  short_headline?: string;
  hero_headline?:  string;

  // Educational
  educational_hook?: string;

  // Testimonials for social proof ads
  testimonials?: Array<{
    name:        string;
    age?:        string | number;
    headline?:   string;
    quote:       string;
    pull_quote?: string;   // 4-8 word emotional phrase
    flag?:       string;
    verified?:   boolean;
  }>;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  sub_brand: string | null;
  description: string | null;
  ingredients: Ingredient[];
  claims: Claim[];
  color_palette: ColorEntry[];
  prompt_modifier: string | null;
  compliance_rules: string[];
  thumbnail_url: string | null;
  context: ProductContext | null;
  created_at: string;
}

export interface Ingredient {
  name: string;
  key: boolean;
  description?: string;
}

export interface Claim {
  text: string;
  source?: string;
  stat?: string;
}

export interface ColorEntry {
  name: string;
  hex: string;
  usage?: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  /**
   * Legacy / external URL. Kept for backwards compat with static
   * /public/product_images assets and any pre-migration rows.
   * New uploads populate storage_path instead and leave this null.
   */
  url: string | null;
  /** Path within `storage_bucket` when the file lives in Supabase Storage. */
  storage_path: string | null;
  /** Bucket id. Defaults to `product-references` for new uploads. */
  storage_bucket: string | null;
  label: string | null;
  is_reference: boolean;
  created_at: string;
}

/**
 * ProductImage with a resolved, model-fetchable URL. The resolver may return
 * a short-lived signed URL (for private-bucket images) or the legacy `url`
 * field passed through unchanged.
 */
export interface ResolvedProductImage extends ProductImage {
  resolved_url: string;
}

export interface PromptTemplate {
  id: string;
  number: number;
  name: string;
  category: string;
  template: string;
  default_aspect_ratio: string;
  version: number;
  created_at: string;
  /** AI-generated preview image using demo product (Sulwhasoo). Null until admin generates it. */
  preview_image_url: string | null;
}

export interface Session {
  id: string;
  user_id: string;
  product_id: string;
  name: string;
  status: 'active' | 'archived';
  created_at: string;
  product?: Product;
}

/**
 * Pipeline stage 1 output. Produced by /api/pipeline/brief and edited/approved
 * by the user at checkpoint 1. The `structured` column is the source of truth
 * (schema-versioned); `audience` / `offer` / `hypothesis` are denormalized for
 * cheap filtering and display.
 */
export interface Brief {
  id: string;
  session_id: string;
  product_id: string;
  objective: string | null;
  audience: Record<string, unknown> | null;
  offer: Record<string, unknown> | null;
  hypothesis: string | null;
  structured: Record<string, unknown> | null;
  source: 'quiz' | 'freeform' | 'imported';
  strictness: 'off' | 'loose' | 'tight';
  wild_card: boolean;
  approved_at: string | null;
  created_at: string;
}

/**
 * Pipeline stage 2 output. 3-5 rows per brief, generated together and
 * de-duplicated via the sameness detector. User picks 1-2 at checkpoint 2.
 */
export interface Concept {
  id: string;
  brief_id: string;
  title: string;
  hook_archetype: string | null;
  description: string | null;
  structured: Record<string, unknown> | null;
  selected_at: string | null;
  created_at: string;
}

/**
 * Pipeline stage 3 output. One row per "this concept, in this run" — we
 * don't enforce uniqueness on concept_id, since a marketer may re-run copy.
 * The latest row by created_at is the "current" copy for a concept unless
 * filtered otherwise.
 */
export interface CopyBlock {
  id: string;
  concept_id: string;
  brief_id: string;
  structured: Record<string, unknown>;
  prompt_version: string | null;
  model: string | null;
  created_at: string;
}

/**
 * Pipeline stage 4 output — visual spec + the assembled image-provider
 * prompt. copy_block_id is nullable (a spec can be generated from concept
 * alone during exploration).
 */
export interface VisualSpec {
  id: string;
  concept_id: string;
  brief_id: string;
  copy_block_id: string | null;
  prompt_text: string;
  aspect_ratio: string;
  structured: Record<string, unknown>;
  prompt_version: string | null;
  model: string | null;
  created_at: string;
}

/**
 * Pipeline stage 6 output — adversarial critique of the assembled bundle.
 * Verdict drives workflow: 'pass' ships, 'refine' triggers one bounded
 * refinement pass on copy or visual, 'reject' surfaces to the marketer
 * (no auto-refine in V1 — the concept itself is off).
 */
export interface Critique {
  id: string;
  concept_id: string;
  brief_id: string;
  copy_block_id: string | null;
  visual_spec_id: string | null;
  verdict: 'pass' | 'refine' | 'reject';
  structured: Record<string, unknown>;
  prompt_version: string | null;
  model: string | null;
  created_at: string;
}

export interface GeneratedImage {
  id: string;
  session_id: string;
  prompt_used: string;
  aspect_ratio: string;
  image_url: string | null;
  api_provider: string;
  model_id: string | null;
  request_id: string | null;
  template_id: string | null;
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'nsfw';
  error_message: string | null;
  created_at: string;
}

export interface ContextContribution {
  id: string;
  product_id: string;
  user_id: string;
  content: string;
  content_type: 'ingredient' | 'claim' | 'image' | 'general';
  status: 'pending' | 'approved' | 'rejected';
  reviewer_note: string | null;
  created_at: string;
}

// Extended image type for the Gallery page — includes joined session/profile/product data
export interface GalleryImage extends GeneratedImage {
  creator_user_id:   string | null;
  creator_name:      string;
  creator_initials:  string;
  product_id:        string | null;
  product_name:      string | null;
  product_sub_brand: string | null;
}

export interface FeedbackSubmission {
  id: string;
  user_id: string;
  kind: 'feedback' | 'template_proposal';
  title: string;
  message: string;
  template_name: string | null;
  template_category: string | null;
  prompt_example: string | null;
  status: 'pending' | 'reviewed' | 'implemented' | 'rejected';
  reviewer_note: string | null;
  created_at: string;
}
