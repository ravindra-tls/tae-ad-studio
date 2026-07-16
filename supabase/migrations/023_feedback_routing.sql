-- ═══════════════════════════════════════════════════════════════════════════
-- 023_feedback_routing.sql   (requires 021; feedback_submissions.workspace_id
-- already exists + is backfilled)
--
-- Feedback routing model:
--   kind='feedback'          → dev inbox (/dev/feedback, all workspaces)
--   kind='template_proposal' → workspace admin queue (own workspace only)
--
-- Adds review provenance (reviewed_by/at), the link from an approved proposal
-- to the template it became (resolved_template_id — column is added now,
-- populated by the Step-7 approve flow), the 'approved' status, and partial
-- indexes for cheap pending-count badges.
--
-- No RLS changes here (migration 026 owns policies). Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.feedback_submissions
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;
alter table public.feedback_submissions
  add column if not exists reviewed_at timestamptz;
alter table public.feedback_submissions
  add column if not exists resolved_template_id uuid references public.prompt_templates(id) on delete set null;

-- Widen the status CHECK to include 'approved' (stamped by the proposal
-- approve flow; PATCH keeps using the original four).
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public' and rel.relname = 'feedback_submissions'
      and con.contype = 'c' and pg_get_constraintdef(con.oid) ilike '%status%'
  loop
    execute format('alter table public.feedback_submissions drop constraint %I', c.conname);
  end loop;
  alter table public.feedback_submissions
    add constraint feedback_submissions_status_check
    check (status in ('pending','reviewed','approved','implemented','rejected'));
exception when duplicate_object then null;
end $$;

-- Cheap pending-count badges (index-only head counts).
create index if not exists idx_feedback_pending_proposals
  on public.feedback_submissions (workspace_id)
  where kind = 'template_proposal' and status = 'pending';
create index if not exists idx_feedback_pending_general
  on public.feedback_submissions (created_at)
  where kind = 'feedback' and status = 'pending';

comment on table public.feedback_submissions is
  'kind=feedback → dev inbox (global). kind=template_proposal → the submitter''s workspace admin queue; approval creates a workspace prompt_templates row linked via resolved_template_id.';

-- ─── context_contributions: retired ─────────────────────────────────────────
-- Intake was orphaned (no user-facing submit UI ever existed). The admin
-- review page/route are deleted in code; the table is kept for historical
-- data and marked deprecated. Drop in a future cleanup migration.
comment on table public.context_contributions is
  'DEPRECATED (2026-07): intake UI never existed; review surfaces removed. Superseded by feedback_submissions. Drop after archiving.';
