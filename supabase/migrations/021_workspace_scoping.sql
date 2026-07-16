-- ═══════════════════════════════════════════════════════════════════════════
-- 021_workspace_scoping.sql   (requires 020_workspaces_core.sql)
--
-- Workspace ownership columns + backfills (slug 'tae' = default workspace):
--   1. products.workspace_id (+ archived_at soft delete)   — NO "set not null"
--      here: that runs as a follow-up AFTER the enforcement code deploys,
--      otherwise the still-deployed createProduct action 500s mid-window.
--   2. sessions.workspace_id (backfill via product) + is_test flag
--   3. brand_config: singleton CHECK(id=1) dropped -> one row per workspace
--   4. positioning_research.product_id FK (name-string join was fragile)
--   5. feedback_submissions.workspace_id (backfill from submitter)
--   6. Post-backfill assertions (fail loudly, not silently)
--
-- Deliberately NOT here: prompt_templates changes (migration 024 owns that
-- table), RLS policy rewrites (migration 026).
-- Idempotent: safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. products ────────────────────────────────────────────────────────────

alter table public.products
  add column if not exists workspace_id uuid references public.workspaces(id) on delete restrict;
alter table public.products
  add column if not exists archived_at timestamptz;

create index if not exists idx_products_workspace on public.products(workspace_id);

comment on column public.products.workspace_id is
  'Owning workspace. NOT NULL is enforced as a follow-up statement after the Phase-3 code deploy (see plan).';
comment on column public.products.archived_at is
  'Soft delete. Hard delete is dev-only: sessions.product_id cascades would destroy other sessions'' gallery images.';

update public.products
   set workspace_id = (select id from public.workspaces where slug = 'tae')
 where workspace_id is null;

-- ─── 2. sessions ────────────────────────────────────────────────────────────

alter table public.sessions
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;
alter table public.sessions
  add column if not exists is_test boolean not null default false;

create index if not exists idx_sessions_workspace on public.sessions(workspace_id);

comment on column public.sessions.is_test is
  'Admin template-test sessions. Excluded from gallery baseQuery, dashboard session lists, and search.';

update public.sessions s
   set workspace_id = p.workspace_id
  from public.products p
 where s.product_id = p.id
   and s.workspace_id is null;

-- ─── 3. brand_config: per-workspace ────────────────────────────────────────

do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public' and rel.relname = 'brand_config'
      and con.contype = 'c' and pg_get_constraintdef(con.oid) ilike '%id%=%1%'
  loop
    execute format('alter table public.brand_config drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.brand_config
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

update public.brand_config
   set workspace_id = (select id from public.workspaces where slug = 'tae')
 where id = 1 and workspace_id is null;

-- one config row per workspace
create unique index if not exists uq_brand_config_workspace
  on public.brand_config (workspace_id);

-- future rows need generated ids (id was `integer primary key default 1`)
create sequence if not exists brand_config_id_seq;
select setval('brand_config_id_seq', coalesce((select max(id) from public.brand_config), 1));
alter table public.brand_config alter column id set default nextval('brand_config_id_seq');

comment on table public.brand_config is
  'One row per workspace (was a CHECK(id=1) singleton). Workspace creation seeds a default row transactionally — getBrandConfigStrict(workspaceId) must never miss.';

-- ─── 4. positioning_research: product FK ───────────────────────────────────

alter table public.positioning_research
  add column if not exists product_id uuid references public.products(id) on delete cascade;

update public.positioning_research pr
   set product_id = p.id
  from public.products p
 where pr.product_id is null
   and lower(pr.product_name) = lower(p.name);

create index if not exists idx_positioning_research_product on public.positioning_research(product_id);

-- New identity once code switches to product_id lookups (the old
-- UNIQUE(product_name, market, segment) stays until then).
create unique index if not exists uq_positioning_research_product
  on public.positioning_research (product_id, market, segment)
  where product_id is not null;

-- ─── 5. feedback_submissions ────────────────────────────────────────────────

alter table public.feedback_submissions
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;

update public.feedback_submissions f
   set workspace_id = pr.workspace_id
  from public.profiles pr
 where f.user_id = pr.id
   and f.workspace_id is null;

create index if not exists idx_feedback_workspace on public.feedback_submissions(workspace_id);

-- ─── 6. Post-backfill assertions ────────────────────────────────────────────

do $$
declare n bigint;
begin
  select count(*) into n from public.products where workspace_id is null;
  if n > 0 then raise exception 'BACKFILL FAILED: % products have NULL workspace_id', n; end if;

  select count(*) into n from public.sessions s
   where s.workspace_id is null and s.product_id is not null;
  if n > 0 then raise exception 'BACKFILL FAILED: % sessions have NULL workspace_id', n; end if;

  select count(*) into n from public.brand_config where workspace_id is null;
  if n > 0 then raise exception 'BACKFILL FAILED: % brand_config rows have NULL workspace_id', n; end if;

  select count(*) into n from public.feedback_submissions f
    join public.profiles p on p.id = f.user_id
   where f.workspace_id is null and p.workspace_id is not null;
  if n > 0 then raise exception 'BACKFILL FAILED: % feedback rows have NULL workspace_id', n; end if;

  -- Research rows that failed the name match: NOT fatal, but the deck
  -- loadSources switch to product_id is GATED on this being zero.
  select count(*) into n from public.positioning_research where product_id is null;
  if n > 0 then raise warning 'positioning_research: % rows did not match a product by name — resolve before switching loadSources to product_id', n; end if;

  raise notice 'Backfill assertions passed.';
end $$;

-- ─── Follow-up (run ONLY after the Phase-3 enforcement code is deployed) ───
-- update public.products set workspace_id = (select id from public.workspaces where slug='tae') where workspace_id is null;
-- alter table public.products alter column workspace_id set not null;
