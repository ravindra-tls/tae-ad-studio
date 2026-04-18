-- ═══════════════════════════════════════════════════════
-- V1 Phase 0+1 migrations bundle — paste into Supabase SQL editor
-- Contains: 006, 007, 008, 009, 010 (in dependency order)
-- Safe to run once. Most operations use IF NOT EXISTS / ON CONFLICT.
-- ═══════════════════════════════════════════════════════

-- ─── 006_generated_images_upstream_fks.sql ───
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


-- ─── 007_briefs_concepts.sql ───
-- ═══════════════════════════════════════════════════════
-- Migration 007: briefs + concepts + FK promotion on generated_images
-- 2026-04-18 — V1 Phase 1 foundation
-- ═══════════════════════════════════════════════════════
--
-- Introduces the two new first-class persisted entities in the multi-stage
-- pipeline: `briefs` (strategic input, first stage output) and `concepts`
-- (the 2-5 directions Claude generates from an approved brief).
--
-- Also promotes generated_images.brief_id and .concept_id from plain uuid
-- columns (added in migration 006) to real FK constraints, now that the
-- referenced tables exist.
-- ═══════════════════════════════════════════════════════


-- ─── briefs ──────────────────────────────────────────────────────────────────

create table public.briefs (
  id           uuid        primary key default gen_random_uuid(),
  session_id   uuid        not null references public.sessions(id) on delete cascade,
  product_id   uuid        not null references public.products(id) on delete cascade,
  objective    text,
  audience     jsonb,
  offer        jsonb,
  hypothesis   text,
  structured   jsonb,
  source       text        not null check (source in ('quiz', 'freeform', 'imported')),
  strictness   text        not null default 'loose' check (strictness in ('off', 'loose', 'tight')),
  wild_card    boolean     not null default false,
  approved_at  timestamptz,
  created_at   timestamptz not null default now()
);

alter table public.briefs enable row level security;

-- Users can read/insert/update briefs tied to their own sessions
create policy "Users can read own briefs"
  on public.briefs for select
  using (
    exists (select 1 from public.sessions where id = briefs.session_id and user_id = auth.uid())
  );

create policy "Users can create briefs in own sessions"
  on public.briefs for insert
  with check (
    exists (select 1 from public.sessions where id = briefs.session_id and user_id = auth.uid())
  );

create policy "Users can update briefs in own sessions"
  on public.briefs for update
  using (
    exists (select 1 from public.sessions where id = briefs.session_id and user_id = auth.uid())
  );

create policy "Admins can read all briefs"
  on public.briefs for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create index idx_briefs_session_id on public.briefs (session_id);
create index idx_briefs_product_id on public.briefs (product_id);
create index idx_briefs_created_at on public.briefs (created_at desc);

comment on table public.briefs is 'Strategic input to the pipeline. Produced by the brief stage, edited/approved by the user at checkpoint 1.';


-- ─── concepts ────────────────────────────────────────────────────────────────

create table public.concepts (
  id              uuid        primary key default gen_random_uuid(),
  brief_id        uuid        not null references public.briefs(id) on delete cascade,
  title           text        not null,
  hook_archetype  text,
  description     text,
  structured      jsonb,
  selected_at     timestamptz,
  created_at      timestamptz not null default now()
);

alter table public.concepts enable row level security;

-- Users can read/insert/update concepts via their brief → session chain
create policy "Users can read own concepts"
  on public.concepts for select
  using (
    exists (
      select 1
      from public.briefs b
      join public.sessions s on s.id = b.session_id
      where b.id = concepts.brief_id and s.user_id = auth.uid()
    )
  );

create policy "Users can create concepts on own briefs"
  on public.concepts for insert
  with check (
    exists (
      select 1
      from public.briefs b
      join public.sessions s on s.id = b.session_id
      where b.id = concepts.brief_id and s.user_id = auth.uid()
    )
  );

create policy "Users can update concepts on own briefs"
  on public.concepts for update
  using (
    exists (
      select 1
      from public.briefs b
      join public.sessions s on s.id = b.session_id
      where b.id = concepts.brief_id and s.user_id = auth.uid()
    )
  );

create policy "Admins can read all concepts"
  on public.concepts for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create index idx_concepts_brief_id   on public.concepts (brief_id);
create index idx_concepts_created_at on public.concepts (created_at desc);

comment on table public.concepts is 'Candidate creative directions generated from a brief. User picks 1-2 at checkpoint 2.';


-- ─── Promote generated_images upstream columns to real FKs ───────────────────
-- The columns were created in migration 006 as plain uuid (because the
-- referenced tables did not exist yet). Now we add the FK constraints.

alter table public.generated_images
  add constraint generated_images_brief_id_fkey
    foreign key (brief_id)   references public.briefs(id)   on delete set null,
  add constraint generated_images_concept_id_fkey
    foreign key (concept_id) references public.concepts(id) on delete set null;


-- ─── 008_brand_config.sql ───
-- ═══════════════════════════════════════════════════════
-- Migration 008: brand_config singleton
-- 2026-04-18 — V1 Phase 1 foundation
-- ═══════════════════════════════════════════════════════
--
-- Single-row table carrying brand-level configuration: voice, visual system,
-- non-negotiables, and default strictness. Single-tenant by design — this app
-- is an internal tool for one brand with many users working on shared
-- products, so there is exactly one brand config, enforced via a check on
-- the primary key.
--
-- Read by the pipeline on every generation; edited by admins via the new
-- /admin/brand page (task #10).
-- ═══════════════════════════════════════════════════════

create table public.brand_config (
  id                   integer     primary key default 1 check (id = 1),
  name                 text        not null default 'TAE',
  voice                jsonb       not null default '{}'::jsonb,
  visual               jsonb       not null default '{}'::jsonb,
  non_negotiables      jsonb       not null default '[]'::jsonb,
  default_strictness   text        not null default 'loose'
                                   check (default_strictness in ('off', 'loose', 'tight')),
  updated_at           timestamptz not null default now(),
  updated_by           uuid        references public.profiles(id) on delete set null
);

alter table public.brand_config enable row level security;

-- Any authenticated user can read (pipeline + UI need this)
create policy "Authenticated users can read brand config"
  on public.brand_config for select
  using (auth.role() = 'authenticated');

-- Only admins can write
create policy "Admins can update brand config"
  on public.brand_config for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can insert brand config"
  on public.brand_config for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Seed the singleton row so reads never return empty
insert into public.brand_config (id) values (1)
on conflict (id) do nothing;

comment on table public.brand_config is 'Singleton (id=1) brand configuration. Used by the pipeline and editable via /admin/brand.';


-- ─── 009_feature_flags.sql ───
-- ═══════════════════════════════════════════════════════
-- Migration 009: feature_flags
-- 2026-04-18 — V1 Phase 1 foundation
-- ═══════════════════════════════════════════════════════
--
-- Admin-controlled feature flag primitive. A flag is enabled for a user iff:
--   enabled = true AND (
--     allowed_user_ids contains user.id
--     OR
--     rollout_percentage >= hash(user.id || flag.name) % 100
--   )
--
-- Admins flip `enabled`, add user ids, and set rollout percentages via
-- /admin/feature-flags (task #9). Server helper isEnabled() and client hook
-- useFeatureFlag() both read from this table.
-- ═══════════════════════════════════════════════════════

create table public.feature_flags (
  name                text        primary key,
  description         text,
  enabled             boolean     not null default false,
  allowed_user_ids    uuid[]      not null default '{}'::uuid[],
  rollout_percentage  integer     not null default 0
                                  check (rollout_percentage between 0 and 100),
  updated_at          timestamptz not null default now(),
  updated_by          uuid        references public.profiles(id) on delete set null
);

alter table public.feature_flags enable row level security;

-- Any authenticated user can read (needed for client hook useFeatureFlag)
create policy "Authenticated users can read feature flags"
  on public.feature_flags for select
  using (auth.role() = 'authenticated');

-- Only admins can mutate
create policy "Admins can insert feature flags"
  on public.feature_flags for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update feature flags"
  on public.feature_flags for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can delete feature flags"
  on public.feature_flags for delete
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Seed the first V1 flag: brief-first UI gated to internal testers
insert into public.feature_flags (name, description, enabled, rollout_percentage)
values (
  'brief_first_ui',
  'Show the new brief-first session entry point alongside the template grid. When disabled, only templates are shown (today''s behavior).',
  false,
  0
)
on conflict (name) do nothing;

comment on table public.feature_flags is 'Admin-controlled feature flags. Server helper: isEnabled(flagName, userId). Client hook: useFeatureFlag(flagName).';


-- ─── 010_product_reference_storage.sql ───
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


