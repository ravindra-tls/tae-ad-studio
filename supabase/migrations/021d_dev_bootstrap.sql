-- ═══════════════════════════════════════════════════════════════════════════
-- 021d_dev_bootstrap.sql   (run ONCE, by hand, editing the email below)
--
-- Mints the first super-admin (dev). Devs stand OUTSIDE workspaces, so this
-- also clears workspace_id. There is deliberately no UI to create a dev — a
-- dev can only be minted here or by an existing dev.
--
-- The protect_profile_privileges trigger blocks role changes via the anon key,
-- but the SQL editor runs as the service role (auth.uid() IS NULL) so this
-- statement passes.
--
-- ► EDIT the email, then run in the Supabase SQL editor.
-- ═══════════════════════════════════════════════════════════════════════════

update public.profiles
   set role = 'dev', workspace_id = null
 where email = 'ravindra.singh@transformative.in';   -- ◄ change me

-- Verify:
-- select email, role, workspace_id from public.profiles where role = 'dev';
