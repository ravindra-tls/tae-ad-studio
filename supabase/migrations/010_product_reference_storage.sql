-- ═══════════════════════════════════════════════════════
-- Migration 010: product reference images — private storage
-- 2026-04-18 — V1 Phase 1
-- ═══════════════════════════════════════════════════════
--
-- Motivation: reference images (pack shots, lifestyle, brand inspo that the
-- image model conditions on) are shifting from ad-hoc public URLs / static
-- /public/product_images assets into a private Supabase bucket. We hand
-- signed URLs to the pipeline at generation time so:
--   1. Pre-launch brand assets aren't publicly crawlable
--   2. Access is auditable (signed URLs expire)
--   3. Upload flow is unified with generated-images / product-images
--
-- Design:
--   * New private bucket `product-references`
--   * `product_images` gains `storage_path` (nullable) + `storage_bucket`
--     (defaults to the new bucket). Legacy rows keep only `url` populated
--     and continue to work through a passthrough in the resolver.
--   * Admin-only writes; any authenticated user reads (the pipeline runs
--     as authenticated on behalf of the user).
-- ═══════════════════════════════════════════════════════

-- 1. New private bucket for curated reference images.
insert into storage.buckets (id, name, public)
values ('product-references', 'product-references', false)
on conflict (id) do nothing;

-- 2. Storage policies for the new bucket.
create policy "Admins can insert product references"
  on storage.objects for insert
  with check (
    bucket_id = 'product-references'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update product references"
  on storage.objects for update
  using (
    bucket_id = 'product-references'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can delete product references"
  on storage.objects for delete
  using (
    bucket_id = 'product-references'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Authenticated can read product references"
  on storage.objects for select
  using (
    bucket_id = 'product-references'
    and auth.role() = 'authenticated'
  );

-- 3. Extend product_images with storage coordinates.
alter table public.product_images
  add column if not exists storage_path   text,
  add column if not exists storage_bucket text default 'product-references';

-- 4. Legacy `url` must allow null now that new uploads populate storage_path instead.
alter table public.product_images
  alter column url drop not null;

-- 5. Constraint: at least one source of truth for where the bytes live.
alter table public.product_images
  add constraint product_images_url_or_storage_required
  check (url is not null or storage_path is not null);

comment on column public.product_images.storage_path is
  'Path within storage_bucket. When set, resolve via signed URL. When null, fall back to url (legacy / external).';

comment on column public.product_images.storage_bucket is
  'Supabase Storage bucket holding this image. Defaults to product-references for new uploads.';
