-- ═══════════════════════════════════════════════════════════════════════
-- 018: copy-ad workflow fields on sessions
--
-- Promoted into the numbered migration sequence from the ad-hoc
-- supabase/add_copy_ad_fields.sql, which was applied directly in the
-- Supabase SQL Editor but never captured as a migration. Migration 016
-- already `comment on column`s sessions.source assuming it exists — this
-- backfills the column that comment depends on. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════

alter table public.sessions
  add column if not exists source              text default 'template',
  add column if not exists reference_image_url text default null,
  add column if not exists copy_ad_group_id    uuid default null;

comment on column public.sessions.source is
  'Origin workflow: ''template'' (default template picker), ''brief'' (brief-first pipeline), '
  '''copy_ad'' (copy-from-reference-ad feature).';

comment on column public.sessions.reference_image_url is
  'Public URL of the reference ad image used in the copy_ad workflow. '
  'Uploaded to generated-images storage bucket under copy-ad/[groupId]/reference.[ext].';

comment on column public.sessions.copy_ad_group_id is
  'Groups all sessions created in a single copy-ad batch together. '
  'All sessions in the same batch share the same reference ad and UUID.';

-- Index for the results page — fetches all sessions in a group at once
create index if not exists idx_sessions_copy_ad_group_id
  on public.sessions (copy_ad_group_id)
  where copy_ad_group_id is not null;
