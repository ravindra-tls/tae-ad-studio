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
