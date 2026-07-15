-- ═══════════════════════════════════════════════════════════════════════
-- 017: prompt_templates.preview_image_url
--
-- Promoted into the numbered migration sequence from the ad-hoc
-- supabase/add_preview_image_url_to_templates.sql, which was applied
-- directly in the Supabase SQL Editor but never captured as a migration.
-- Reconciles migration history with the live schema. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════

alter table public.prompt_templates
  add column if not exists preview_image_url text default null;

comment on column public.prompt_templates.preview_image_url is
  'AI-generated preview image URL using the Sulwhasoo demo product. '
  'Generated via POST /api/admin/templates/[id]/preview. '
  'Displayed to users in the template selection grid so they can visually '
  'understand the ad layout without reading the prompt text.';
