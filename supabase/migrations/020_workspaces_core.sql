-- ═══════════════════════════════════════════════════════════════════════════
-- 020_workspaces_core.sql
--
-- Workspace/RBAC foundation:
--   1. workspaces table + the default workspace (slug 'tae' — the canonical
--      slug every later backfill references)
--   2. profiles: role CHECK widened to include 'dev'; workspace_id pointer
--      (one workspace per user BY DESIGN — dev role has workspace_id NULL);
--      privilege-protection trigger (anon-key callers cannot change their own
--      role / workspace_id / usage_cap / usage_count)
--   3. workspace_invites (invite = pre-authorized email row; no email infra)
--      + handle_new_user() invite matching with a TEMPORARY domain-allowlist
--      fallback (removed when the invites UI ships)
--   4. Security-definer RLS helpers is_dev()/is_admin_of()/my_workspace()
--      (created here so later policy migrations can reference them; also
--      kills the profiles self-referencing-policy recursion foot-gun)
--   5. Hot-fixes pulled forward from the RLS phase because they are LIVE
--      anon-key holes: enable RLS on positioning_research; drop the
--      generated_images USING(true) update policy; unique request_id index
--   6. Weekly usage reset: schedule reset_expired_usage() via pg_cron when
--      available (it has been dormant since migration 014)
--
-- Idempotent: safe to re-run. Run in the Supabase SQL editor (house
-- precedent: dashboard-run, committed as a numbered migration).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. workspaces ──────────────────────────────────────────────────────────

create table if not exists public.workspaces (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  -- future hooks (per-workspace usage caps, per-workspace flags) live here
  -- so they never need another schema migration:
  settings   jsonb not null default '{}',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.workspaces is
  'Tenant boundary. Products/brand config/sessions/feedback are workspace-scoped; the dev-approved template catalog is universal. One workspace per user (profiles.workspace_id).';

create or replace function public.update_workspaces_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_workspaces_updated_at on public.workspaces;
create trigger trg_workspaces_updated_at
  before update on public.workspaces
  for each row execute function public.update_workspaces_updated_at();

-- The default workspace — slug 'tae' is CANONICAL; every later backfill
-- (021, 023) references it. Name follows the existing brand_config row.
insert into public.workspaces (name, slug)
values ('The Ayurveda Experience', 'tae')
on conflict (slug) do nothing;

-- ─── 2. profiles: dev role, workspace pointer, privilege protection ────────

-- Widen the role CHECK (constraint name discovered dynamically — the live
-- DB has drifted from migration files before; see 017-019 precedent).
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public' and rel.relname = 'profiles'
      and con.contype = 'c' and pg_get_constraintdef(con.oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
  alter table public.profiles
    add constraint profiles_role_check check (role in ('user','admin','dev'));
exception when duplicate_object then null;
end $$;

alter table public.profiles
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;
create index if not exists idx_profiles_workspace on public.profiles(workspace_id);

comment on column public.profiles.workspace_id is
  'Exactly-one-workspace membership pointer. Invariants (app-enforced): dev => NULL; admin => NOT NULL; user + NULL = pending (awaiting invite).';

-- Backfill: every existing profile joins the default workspace.
update public.profiles
   set workspace_id = (select id from public.workspaces where slug = 'tae')
 where workspace_id is null;

-- Privilege protection: the permissive "Users can update own profile" RLS
-- policy would otherwise let any anon-key caller set their own role /
-- workspace / caps. Service-role connections have auth.uid() NULL and pass —
-- app code (lib/auth/guards.ts) is the enforcer there.
create or replace function public.protect_profile_privileges()
returns trigger as $$
begin
  if auth.uid() is not null
     and (new.role         is distinct from old.role
       or new.workspace_id is distinct from old.workspace_id
       or new.usage_cap    is distinct from old.usage_cap
       or new.usage_count  is distinct from old.usage_count) then
    raise exception 'privileged profile fields can only be changed by an administrator';
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_protect_profile_privileges on public.profiles;
create trigger trg_protect_profile_privileges
  before update on public.profiles
  for each row execute function public.protect_profile_privileges();

-- ─── 3. workspace_invites + signup matching ────────────────────────────────

create table if not exists public.workspace_invites (
  id               uuid primary key default gen_random_uuid(),
  email            text not null,  -- stored lower(trim(email))
  workspace_id     uuid not null references public.workspaces(id) on delete cascade,
  role             text not null default 'user' check (role in ('user','admin')), -- 'dev' is NEVER invitable
  invited_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  accepted_at      timestamptz,
  accepted_user_id uuid references public.profiles(id) on delete set null,
  revoked_at       timestamptz
);

-- Exactly-one-workspace, enforced at the source: at most ONE live invite per
-- email across all workspaces.
create unique index if not exists uq_live_invite_per_email
  on public.workspace_invites (email)
  where accepted_at is null and revoked_at is null;
create index if not exists idx_invites_workspace on public.workspace_invites(workspace_id);

comment on table public.workspace_invites is
  'Invite = pre-authorized email row (no email is sent). Signup matches by lower(email) in handle_new_user(); inviting an already-pending profile attaches it immediately via the API.';

-- Signup trigger: invite match -> workspace + role; no invite -> TEMPORARY
-- fallback places allowlisted domains into the default workspace (parity with
-- the old client-side allowlist). The fallback is REMOVED when the invites UI
-- ships (Phase 4) — after that, un-invited signups are pending.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  inv record;
  ws  uuid;
  r   text := 'user';
begin
  select * into inv from public.workspace_invites
   where email = lower(new.email) and accepted_at is null and revoked_at is null
   limit 1;

  if inv.id is not null then
    ws := inv.workspace_id;
    r  := inv.role;
  elsif lower(new.email) like '%@transformative.in'
     or lower(new.email) like '%@theayurvedaexperience.com' then
    -- TEMPORARY allowlist fallback (remove in Phase 4 with the invites UI)
    select id into ws from public.workspaces where slug = 'tae';
  else
    ws := null; -- pending: awaits an invite
  end if;

  insert into public.profiles (id, email, full_name, role, workspace_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    r,
    ws
  );

  if inv.id is not null then
    update public.workspace_invites
       set accepted_at = now(), accepted_user_id = new.id
     where id = inv.id;
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- ─── 4. RLS helper functions (security definer — no recursive policies) ────

create or replace function public.is_dev()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'dev'
  );
$$ language sql security definer stable;

create or replace function public.is_admin_of(ws uuid)
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (role = 'dev' or (role = 'admin' and workspace_id = ws))
  );
$$ language sql security definer stable;

create or replace function public.my_workspace()
returns uuid as $$
  select workspace_id from public.profiles where id = auth.uid();
$$ language sql security definer stable;

comment on function public.is_dev is
  'RLS helper. SECURITY DEFINER so policies never self-reference profiles (recursion foot-gun in the 001 policies).';

-- ─── 5. Hot-fixes for LIVE anon-key holes (pulled forward from RLS phase) ──

-- positioning_research had NO RLS: readable AND writable with the public
-- anon key. Enabling RLS with no policies = deny for anon/authenticated;
-- the service client (all app code) bypasses RLS and is unaffected.
alter table public.positioning_research enable row level security;

-- Any authenticated user could update ANY generated_images row (status,
-- image_url, ...) through this policy. All legitimate writers use the
-- service client.
drop policy if exists "System can update generated images" on public.generated_images;

-- Webhook lookup key: one request_id must match at most one row.
-- (If this errors on historical duplicates, resolve them first:
--  select request_id, count(*) from generated_images
--  where request_id is not null group by 1 having count(*) > 1;)
create unique index if not exists uq_generated_images_request_id
  on public.generated_images (request_id)
  where request_id is not null;

-- ─── 6. Weekly usage reset (dormant since 014) ─────────────────────────────

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'reset-expired-usage-weekly',
      '5 0 * * *',                                -- daily 00:05 UTC; function only resets rows past cycle_reset
      $cron$ select public.reset_expired_usage(); $cron$
    );
    raise notice 'pg_cron: scheduled reset-expired-usage-weekly';
  else
    raise notice 'pg_cron extension not installed — enable it in Dashboard > Database > Extensions, then run: select cron.schedule(''reset-expired-usage-weekly'', ''5 0 * * *'', ''select public.reset_expired_usage();'');';
  end if;
exception when others then
  raise notice 'pg_cron scheduling skipped: %', sqlerrm;
end $$;

-- ─── Verification ───────────────────────────────────────────────────────────
-- select slug, id from workspaces;                                   -- 1 row: tae
-- select count(*) from profiles where workspace_id is null;          -- 0
-- select conname from pg_constraint where conrelid = 'public.profiles'::regclass and contype='c';
-- select relrowsecurity from pg_class where relname='positioning_research';  -- t
