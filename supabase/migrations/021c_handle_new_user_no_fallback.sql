-- ═══════════════════════════════════════════════════════════════════════════
-- 021c_handle_new_user_no_fallback.sql   (Phase 4 — run once the invites UI
-- is live, i.e. after the Phase-4 deploy)
--
-- 020 shipped handle_new_user() with a TEMPORARY domain-allowlist fallback so
-- team signups kept working before invites existed. Now that /admin/invites
-- ships, remove the fallback: a signup with no matching live invite becomes
-- PENDING (workspace_id NULL) and is gated to /pending until invited.
--
-- Existing users are untouched (already backfilled into 'tae'). Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.handle_new_user()
returns trigger as $$
declare
  inv record;
begin
  select * into inv from public.workspace_invites
   where email = lower(new.email) and accepted_at is null and revoked_at is null
   limit 1;

  insert into public.profiles (id, email, full_name, role, workspace_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(inv.role, 'user'),
    inv.workspace_id          -- NULL when no invite → pending
  );

  if inv.id is not null then
    update public.workspace_invites
       set accepted_at = now(), accepted_user_id = new.id
     where id = inv.id;
  end if;

  return new;
end;
$$ language plpgsql security definer;
