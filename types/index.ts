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
  url: string;
  label: string | null;
  is_reference: boolean;
  created_at: string;
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

export interface GeneratedImage {
  id: string;
  session_id: string;
  prompt_used: string;
  aspect_ratio: string;
  image_url: string | null;
  api_provider: string;
  model_id: string | null;
  request_id: string | null;
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
