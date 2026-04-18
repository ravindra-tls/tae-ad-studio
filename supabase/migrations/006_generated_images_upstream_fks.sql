-- ═══════════════════════════════════════════════════════
-- Migration 006: generated_images upstream links
-- 2026-04-18 — V1 Phase 0 housekeeping
-- ═══════════════════════════════════════════════════════
--
-- Adds three nullable foreign-key-ish columns so every generated image can be
-- traced back to its upstream brief, concept, and/or template.
--
--   * template_id — FK constraint is added NOW (prompt_templates already exists).
--   * brief_id    — plain uuid column. FK constraint added in the Phase 1
--                   migration that creates the `briefs` table.
--   * concept_id  — plain uuid column. FK constraint added in the Phase 1
--                   migration that creates the `concepts` table.
--
-- All three columns are nullable because today's rows don't have upstreams and
-- we don't want to backfill invented values. Historical rows simply carry NULL.
-- ═══════════════════════════════════════════════════════

alter table public.generated_images
  add column if not exists template_id uuid references public.prompt_templates(id) on delete set null,
  add column if not exists brief_id    uuid,
  add column if not exists concept_id  uuid;

-- Indexes on the new columns — cheap, and every future "per-X performance"
-- query will filter on one of these.
create index if not exists idx_generated_images_template_id on public.generated_images(template_id);
create index if not exists idx_generated_images_brief_id    on public.generated_images(brief_id);
create index if not exists idx_generated_images_concept_id  on public.generated_images(concept_id);

comment on column public.generated_images.template_id is 'Template used to produce this image (nullable — brief-first generations carry NULL here).';
comment on column public.generated_images.brief_id    is 'Brief this image was generated from. FK added in Phase 1 alongside briefs table.';
comment on column public.generated_images.concept_id  is 'Concept this image was generated from. FK added in Phase 1 alongside concepts table.';
