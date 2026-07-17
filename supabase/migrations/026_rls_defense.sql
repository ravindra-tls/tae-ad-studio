-- ═══════════════════════════════════════════════════════════════════════════
-- 026_rls_defense.sql   (requires 020-025; FINAL migration of the workspace
-- rollout)
--
-- Defense-in-depth RLS rewrite onto the 3-tier model (dev > workspace admin >
-- member) using the security-definer helpers from 020 (is_dev / is_admin_of /
-- my_workspace — no self-referencing policies, killing the profiles recursion
-- foot-gun). App code runs on the service client and bypasses ALL of this;
-- these policies only bound what the public anon/authenticated keys can do.
-- Idempotent (drop-if-exists + recreate).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── profiles ────────────────────────────────────────────────────────────────
drop policy if exists "Admins can view all profiles"   on public.profiles;
drop policy if exists "Admins can update all profiles" on public.profiles;
create policy "Admins can view workspace profiles" on public.profiles
  for select using (is_dev() or (workspace_id is not null and is_admin_of(workspace_id)));
-- own-row select/update policies from 001 remain; the privilege trigger (020)
-- blocks role/workspace/cap/count self-edits.

-- ─── workspaces ──────────────────────────────────────────────────────────────
drop policy if exists "Members read own workspace" on public.workspaces;
drop policy if exists "Devs manage workspaces"     on public.workspaces;
create policy "Members read own workspace" on public.workspaces
  for select using (is_dev() or id = my_workspace());
create policy "Devs manage workspaces" on public.workspaces
  for all using (is_dev());

-- ─── workspace_invites ──────────────────────────────────────────────────────
alter table public.workspace_invites enable row level security;
drop policy if exists "Workspace admins manage invites" on public.workspace_invites;
create policy "Workspace admins manage invites" on public.workspace_invites
  for all using (is_admin_of(workspace_id));

-- ─── products / product_images / product_decks ──────────────────────────────
drop policy if exists "Authenticated users can view products" on public.products;
drop policy if exists "Admins can manage products"            on public.products;
create policy "Members view workspace products" on public.products
  for select using (is_dev() or workspace_id = my_workspace());
create policy "Workspace admins manage products" on public.products
  for all using (workspace_id is not null and is_admin_of(workspace_id));

drop policy if exists "Authenticated users can view product images" on public.product_images;
drop policy if exists "Admins can manage product images"            on public.product_images;
create policy "Members view workspace product images" on public.product_images
  for select using (exists (
    select 1 from public.products p
    where p.id = product_id and (is_dev() or p.workspace_id = my_workspace())));
create policy "Workspace admins manage product images" on public.product_images
  for all using (exists (
    select 1 from public.products p
    where p.id = product_id and p.workspace_id is not null and is_admin_of(p.workspace_id)));

drop policy if exists "Authenticated users can read product decks" on public.product_decks;
drop policy if exists "Admins can manage product decks"            on public.product_decks;
create policy "Members read workspace product decks" on public.product_decks
  for select using (exists (
    select 1 from public.products p
    where p.id = product_id and (is_dev() or p.workspace_id = my_workspace())));
create policy "Workspace admins manage product decks" on public.product_decks
  for all using (exists (
    select 1 from public.products p
    where p.id = product_id and p.workspace_id is not null and is_admin_of(p.workspace_id)));

-- ─── prompt_templates (universal + workspace union) ─────────────────────────
drop policy if exists "Authenticated users can view templates" on public.prompt_templates;
drop policy if exists "Admins can manage templates"            on public.prompt_templates;
create policy "Members view visible templates" on public.prompt_templates
  for select using (
    is_dev()
    or (is_active and (workspace_id is null or workspace_id = my_workspace())));
create policy "Workspace admins manage own templates" on public.prompt_templates
  for all using (
    is_dev()
    or (workspace_id is not null and is_admin_of(workspace_id)));

-- ─── sessions ────────────────────────────────────────────────────────────────
drop policy if exists "Admins can view all sessions" on public.sessions;
create policy "Workspace admins view workspace sessions" on public.sessions
  for select using (is_dev() or (workspace_id is not null and is_admin_of(workspace_id)));
-- own select/insert/update policies from 001 remain.

-- ─── generated_images (gallery is workspace-visible) ────────────────────────
drop policy if exists "Admins can view all generated images" on public.generated_images;
drop policy if exists "Users can view own generated images"  on public.generated_images;
drop policy if exists "Members view workspace images"        on public.generated_images;
create policy "Members view workspace images" on public.generated_images
  for select using (is_dev() or workspace_id = my_workspace());
-- (insert policy from 001 remains own-session; the USING(true) update policy
--  was dropped in 020; service client does all writes.)

-- ─── brand_config ────────────────────────────────────────────────────────────
drop policy if exists "Authenticated users can read brand config" on public.brand_config;
drop policy if exists "Admins can insert brand config"            on public.brand_config;
drop policy if exists "Admins can update brand config"            on public.brand_config;
create policy "Members read workspace brand config" on public.brand_config
  for select using (is_dev() or workspace_id = my_workspace());
create policy "Workspace admins manage brand config" on public.brand_config
  for all using (workspace_id is not null and is_admin_of(workspace_id));

-- ─── feedback_submissions ────────────────────────────────────────────────────
drop policy if exists "Admins can manage feedback submissions" on public.feedback_submissions;
create policy "Reviewers manage feedback" on public.feedback_submissions
  for all using (
    is_dev()
    or (kind = 'template_proposal' and workspace_id is not null and is_admin_of(workspace_id)));
-- own insert/select policies from 004 remain.

-- ─── feature_flags: dev-only writes ─────────────────────────────────────────
drop policy if exists "Admins can insert feature flags" on public.feature_flags;
drop policy if exists "Admins can update feature flags" on public.feature_flags;
drop policy if exists "Admins can delete feature flags" on public.feature_flags;
create policy "Devs manage feature flags" on public.feature_flags
  for all using (is_dev());
-- authenticated read policy remains (client flag checks).

-- ─── image_reactions: missing delete-own (001 gap) ──────────────────────────
drop policy if exists "Users can delete own reactions" on public.image_reactions;
create policy "Users can delete own reactions" on public.image_reactions
  for delete using (auth.uid() = user_id);

-- positioning_research: RLS enabled in 020 with NO policies (service-only) —
-- deliberate. image_stars: own-rows policy from 022 — already 3-tier-correct.

-- ─── Verification ────────────────────────────────────────────────────────────
-- select schemaname, tablename, policyname from pg_policies
--  where schemaname='public' order by tablename, policyname;
