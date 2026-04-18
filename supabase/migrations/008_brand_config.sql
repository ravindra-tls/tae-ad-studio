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
