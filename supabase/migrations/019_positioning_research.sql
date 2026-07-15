-- ═══════════════════════════════════════════════════════════════════════
-- 019: positioning_research table
--
-- Promoted into the numbered migration sequence from the ad-hoc
-- supabase/add_positioning_research.sql, which was applied directly in the
-- Supabase SQL Editor but never captured as a migration. Migration 016
-- references this table in a comment ("Built from products +
-- positioning_research + brand_config") assuming it exists — this backfills
-- the table itself. Idempotent.
--
-- Note: mirrors live exactly — no RLS is enabled on this table (access is
-- via server-side admin routes using the service role). Add RLS in a
-- follow-up migration if this is ever exposed to the anon/authenticated key.
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.positioning_research (
  id            uuid        primary key default gen_random_uuid(),
  product_name  text        not null,
  brand         text        not null,
  market        text        not null,
  segment       text        not null,
  research      jsonb       not null,
  research_type text        default 'ai_generated',
  is_active     boolean     default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique (product_name, market, segment)
);

comment on table public.positioning_research is
  'Audience positioning research documents. Each row is a full research study '
  'for a product/market/segment combination, stored as JSONB matching the '
  'PositioningResearch TypeScript interface in lib/research/types.ts. '
  'Used to inject audience context into the brief pipeline stage.';

comment on column public.positioning_research.research is
  'Full PositioningResearch document: personas, emotional_landscape, '
  'language_guide, cultural_context, supplement_landscape, messaging_framework.';

comment on column public.positioning_research.research_type is
  'Origin of the research: ''ai_generated'' (Claude + web search), '
  '''manual'' (hand-authored), ''hybrid'' (sourced from real research, structured by AI).';

comment on column public.positioning_research.is_active is
  'Only active rows are injected into the brief pipeline. Set to false to '
  'archive without deleting.';

create index if not exists idx_positioning_research_product
  on public.positioning_research (product_name, market);

create index if not exists idx_positioning_research_active
  on public.positioning_research (product_name, market, is_active)
  where is_active = true;

-- Auto-update updated_at on row modification
create or replace function public.update_positioning_research_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_positioning_research_updated_at on public.positioning_research;
create trigger trg_positioning_research_updated_at
  before update on public.positioning_research
  for each row
  execute function public.update_positioning_research_updated_at();
