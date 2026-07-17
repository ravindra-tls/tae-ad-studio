-- ═══════════════════════════════════════════════════════════════════════════
-- 025_search.sql   (requires 021; run AFTER 022)
--
-- Universal search over media + templates, and the denormalization that makes
-- workspace scoping a direct predicate:
--   1. generated_images gains user_id / product_id / workspace_id (backfilled
--      from the sessions join; stamped by the insert routes from now on).
--      This also kills the fragile two-step gallery product filter and the
--      2000-row JS dedupe.
--   2. pg_trgm GIN indexes — substring matching suits Ayurvedic proper nouns
--      ("Balaayah", "Yauvari") that dictionary-based tsvector stems badly.
-- Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Denormalized ownership on generated_images ──────────────────────────

alter table public.generated_images
  add column if not exists user_id uuid references public.profiles(id) on delete set null;
alter table public.generated_images
  add column if not exists product_id uuid references public.products(id) on delete set null;
alter table public.generated_images
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;

update public.generated_images gi
   set user_id      = coalesce(gi.user_id,      s.user_id),
       product_id   = coalesce(gi.product_id,   s.product_id),
       workspace_id = coalesce(gi.workspace_id, s.workspace_id)
  from public.sessions s
 where gi.session_id = s.id
   and (gi.user_id is null or gi.product_id is null or gi.workspace_id is null);

create index if not exists idx_generated_images_workspace
  on public.generated_images (workspace_id, status, created_at desc);
create index if not exists idx_generated_images_user
  on public.generated_images (user_id);
create index if not exists idx_generated_images_product
  on public.generated_images (product_id);

comment on column public.generated_images.workspace_id is
  'Denormalized from sessions at insert time — gallery/search scope predicate. Backfilled by 025.';

-- ─── 2. Trigram search indexes ───────────────────────────────────────────────

create extension if not exists pg_trgm;

create index if not exists idx_generated_images_prompt_trgm
  on public.generated_images using gin (prompt_used gin_trgm_ops);
create index if not exists idx_prompt_templates_name_trgm
  on public.prompt_templates using gin (name gin_trgm_ops);
create index if not exists idx_products_name_trgm
  on public.products using gin (name gin_trgm_ops);

-- ─── Assertions ──────────────────────────────────────────────────────────────
do $$
declare n bigint;
begin
  select count(*) into n from public.generated_images gi
    join public.sessions s on s.id = gi.session_id
   where gi.workspace_id is null and s.workspace_id is not null;
  if n > 0 then raise exception 'BACKFILL FAILED: % generated_images missing workspace_id', n; end if;
  raise notice 'Search backfill assertions passed.';
end $$;
