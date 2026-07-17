-- ═══════════════════════════════════════════════════════════════════════════
-- 022_image_stars.sql
--
-- Stars move from localStorage (two incompatible keys, device-local) to the
-- database. Orthogonal to image_reactions (swipe like/dislike) — a star is a
-- personal bookmark, a reaction is a quality signal; keeping them separate
-- preserves admin like-ratio stats and the swipe already-rated preload.
--
-- Composite PK + cascades mean the gallery's ?starred=1 mode can never
-- return dangling ids (unlike the old localStorage ?ids= mode).
-- Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.image_stars (
  image_id   uuid not null references public.generated_images(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (image_id, user_id)
);

create index if not exists idx_image_stars_user
  on public.image_stars (user_id, created_at desc);

comment on table public.image_stars is
  'Personal bookmarks ("stars"). Migrated from localStorage keys tae-starred-<userId> / tae-dashboard-starred via POST /api/images/stars/import.';

-- RLS: own rows only (service client bypasses; defense in depth).
alter table public.image_stars enable row level security;
drop policy if exists "Users manage own stars" on public.image_stars;
create policy "Users manage own stars"
  on public.image_stars for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
