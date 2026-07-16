-- ═══════════════════════════════════════════════════════════════════════════
-- 024_template_scope.sql   (requires 020/021/023)
--
-- Template catalog = universal set + workspace-local extensions:
--   workspace_id NULL     → universal (visible to every workspace)
--   workspace_id NOT NULL → local to that workspace (admin-approved proposal)
-- A dev "promotes" a workspace template by setting workspace_id → NULL.
--
-- Also: is_active soft-archive (admin delete = archive; hard delete dev-only),
-- proposal provenance (source_proposal_id + unique partial index as the
-- double-approval backstop), and a sequence default on `number` that kills
-- the max(number)+1 race. Numbering stays globally unique.
--
-- No RLS changes here (026 owns policies). Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.prompt_templates
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.prompt_templates
  add column if not exists is_active boolean not null default true;
alter table public.prompt_templates
  add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.prompt_templates
  add column if not exists source_proposal_id uuid references public.feedback_submissions(id) on delete set null;
alter table public.prompt_templates
  add column if not exists promoted_at timestamptz;
alter table public.prompt_templates
  add column if not exists promoted_by uuid references public.profiles(id) on delete set null;

comment on column public.prompt_templates.workspace_id is
  'NULL = universal (all workspaces). NOT NULL = local to that workspace until a dev promotes it (sets NULL + stamps promoted_at/by).';
comment on column public.prompt_templates.is_active is
  'Soft archive. Admin "delete" archives; hard DELETE is dev-only (generated_images.template_id provenance survives either way via ON DELETE SET NULL).';

-- Existing 40 seeded templates stay universal (workspace_id NULL) — no backfill.

create index if not exists idx_prompt_templates_workspace on public.prompt_templates(workspace_id);

-- Double-approval backstop: one template per proposal, ever.
create unique index if not exists uq_prompt_templates_source_proposal
  on public.prompt_templates (source_proposal_id)
  where source_proposal_id is not null;

-- number: sequence default replaces the app-side max(number)+1 race.
create sequence if not exists prompt_template_number_seq;
select setval('prompt_template_number_seq',
              coalesce((select max(number) from public.prompt_templates), 0) + 1,
              false);
alter table public.prompt_templates alter column number set default nextval('prompt_template_number_seq');

-- ─── Verification ───────────────────────────────────────────────────────────
-- select count(*) from prompt_templates where workspace_id is not null;  -- 0 today
-- select nextval('prompt_template_number_seq');                          -- max+1 (consumes one)
