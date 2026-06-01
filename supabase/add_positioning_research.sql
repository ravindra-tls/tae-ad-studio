-- Migration: add positioning_research table
-- Run this in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS positioning_research (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name  TEXT        NOT NULL,
  brand         TEXT        NOT NULL,
  market        TEXT        NOT NULL,
  segment       TEXT        NOT NULL,
  research      JSONB       NOT NULL,
  research_type TEXT        DEFAULT 'ai_generated',
  is_active     BOOLEAN     DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_name, market, segment)
);

COMMENT ON TABLE positioning_research IS
  'Audience positioning research documents. Each row is a full research study '
  'for a product/market/segment combination, stored as JSONB matching the '
  'PositioningResearch TypeScript interface in lib/research/types.ts. '
  'Used to inject audience context into the brief pipeline stage.';

COMMENT ON COLUMN positioning_research.research IS
  'Full PositioningResearch document: personas, emotional_landscape, '
  'language_guide, cultural_context, supplement_landscape, messaging_framework.';

COMMENT ON COLUMN positioning_research.research_type IS
  'Origin of the research: ''ai_generated'' (Claude + web search), '
  '''manual'' (hand-authored), ''hybrid'' (sourced from real research, structured by AI).';

COMMENT ON COLUMN positioning_research.is_active IS
  'Only active rows are injected into the brief pipeline. Set to false to '
  'archive without deleting.';

CREATE INDEX IF NOT EXISTS idx_positioning_research_product
  ON positioning_research(product_name, market);

CREATE INDEX IF NOT EXISTS idx_positioning_research_active
  ON positioning_research(product_name, market, is_active)
  WHERE is_active = TRUE;

-- Auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION update_positioning_research_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_positioning_research_updated_at ON positioning_research;
CREATE TRIGGER trg_positioning_research_updated_at
  BEFORE UPDATE ON positioning_research
  FOR EACH ROW
  EXECUTE FUNCTION update_positioning_research_updated_at();
