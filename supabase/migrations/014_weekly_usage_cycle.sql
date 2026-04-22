-- ═══════════════════════════════════════════════════════════════════════
-- 014: Weekly usage cycle
--
-- Context: usage caps were originally "per 30 days" (see 001_initial.sql).
-- Product decision (2026-04-22): switch to weekly limits with the new cap
-- options {30, 50, 100, 200, 500} exposed in the admin UI.
--
-- This migration:
--   1. Shortens reset_expired_usage() from 30-day to 7-day cycles.
--   2. Changes the default cycle_reset on new profiles to now() + 7 days.
--   3. Rebases every existing profile's cycle_reset to now() + 7 days so
--      nobody keeps a stale monthly horizon. This means users with old
--      cycle_reset values will reset sooner, which is strictly generous.
--
-- ⚠️  Nothing in the app currently CALLS reset_expired_usage() — it's
-- a dormant function. Weekly resets will only actually happen once a
-- scheduler (Supabase Edge Function cron, Vercel Cron, etc.) is wired
-- up to invoke it. Tracking that as a follow-up.
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Flip the reset function to a 7-day cycle.
create or replace function public.reset_expired_usage()
returns void as $$
begin
  update public.profiles
  set usage_count = 0,
      cycle_reset = now() + interval '7 days'
  where cycle_reset < now();
end;
$$ language plpgsql security definer;

-- 2. New profiles get a weekly default.
alter table public.profiles
  alter column cycle_reset set default (now() + interval '7 days');

-- 3. Rebase existing profiles onto the weekly cadence. We intentionally
-- overwrite everyone — including users with a cycle_reset still in the
-- future — so that the transition to weekly is clean and the next reset
-- for all users is at most 7 days away.
update public.profiles
set cycle_reset = now() + interval '7 days';
