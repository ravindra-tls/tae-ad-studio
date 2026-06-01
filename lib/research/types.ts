/**
 * Research library types.
 *
 * PositioningResearch is the top-level document stored as JSONB in the
 * `positioning_research` table. ResearchPersona is the per-persona sub-type
 * used inside that document.
 *
 * These types are shared between:
 *   - lib/research/seed-data/   (static seed constants)
 *   - app/api/admin/research/   (generation + CRUD routes)
 *   - lib/pipeline/stages/brief (context injection into brief prompts)
 *   - app/admin/research/       (admin UI)
 */

export interface ResearchPersona {
  id?: string;
  archetype_name: string;
  age_range: string;
  location: string;
  tagline: string; // e.g. "3am Google warrior. She is terrified, exhausted..."
  verbatim_quotes: string[];
  core_characteristics: string[];
  deepest_fears: string[];
  deepest_desires: string[];
  emotional_triggers: Array<{ label: string; description: string }>;
}

export interface PositioningResearch {
  id?: string;
  product_name: string;
  brand: string;
  market: string; // "UK/EU", "US", "ME", etc.
  segment: string; // "Menopausal Women 45-65+"
  executive_summary: string;
  key_stats: string[];
  personas: ResearchPersona[];
  emotional_landscape: {
    emotional_cycle: Array<{ stage: string; description: string }>;
    universal_turn_offs: string[];
    universal_desires: string[];
  };
  language_guide: {
    words_she_uses: string[];
    sounds_familiar: string[];
    ad_hook_mapping: Array<{ hook: string; emotional_territory: string }>;
  };
  cultural_context: Record<string, string>; // country -> messaging approach
  supplement_landscape: {
    journey_stages: string[];
    why_previous_failed: string[];
    positioning_opportunity: string;
    trust_markers: string[];
  };
  messaging_framework: Record<string, string>; // persona_name -> messaging approach
  creative_principles: string[];
  source_methodology: string;
  generated_at: string;
  research_type: 'ai_generated' | 'manual' | 'hybrid';
}
