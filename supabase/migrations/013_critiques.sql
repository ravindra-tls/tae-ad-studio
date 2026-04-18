-- =============================================================================
-- Migration 013: critiques
-- =============================================================================
-- Adds the `critiques` table, which holds outputs of pipeline stage 6
-- (Critique). A critique evaluates the assembled bundle (brief + concept
-- + copy + visual spec) against brand fit, concept execution, copy
-- effectiveness, and visual coherence, and returns a verdict that can
-- trigger one bounded refinement pass on copy or visual.
--
-- Keys:
--   - concept_id REQUIRED (every critique is anchored to a concept)
--   - copy_block_id + visual_spec_id: nullable so a critique can run on a
--     partial bundle during exploration, but in practice the orchestrator
--     runs critique after both are produced.
--
-- Not unique per concept — you can re-critique after a refine to see if
-- the refined output passes.

create table public.critiques (
  id              uuid        primary key default gen_random_uuid(),
  concept_id      uuid        not null references public.concepts(id)      on delete cascade,
  brief_id        uuid        not null references public.briefs(id)        on delete cascade,
  copy_block_id   uuid        references public.copy_blocks(id)   on delete set null,
  visual_spec_id  uuid        references public.visual_specs(id)  on delete set null,

  -- Top-level verdict from the critique judge. 'refine' is the actionable
  -- case that triggers one bounded refinement; 'reject' means the
  -- underlying concept is fundamentally off (rare) and we don't auto-refine.
  verdict         text        not null check (verdict in ('pass', 'refine', 'reject')),

  -- Structured feedback: per-axis notes (brand, concept, copy, visual),
  -- plus refine_targets = which stage(s) to re-run with which guidance.
  -- Full shape in lib/pipeline/schemas/critique.ts.
  structured      jsonb       not null,

  prompt_version  text,
  model           text,
  created_at      timestamptz not null default now()
);

alter table public.critiques enable row level security;

create policy "Users can read own critiques"
  on public.critiques for select
  using (
    exists (
      select 1
      from public.concepts c
      join public.briefs b  on b.id = c.brief_id
      join public.sessions s on s.id = b.session_id
      where c.id = critiques.concept_id and s.user_id = auth.uid()
    )
  );

create policy "Users can create critiques on own concepts"
  on public.critiques for insert
  with check (
    exists (
      select 1
      from public.concepts c
      join public.briefs b  on b.id = c.brief_id
      join public.sessions s on s.id = b.session_id
      where c.id = critiques.concept_id and s.user_id = auth.uid()
    )
  );

create policy "Admins can read all critiques"
  on public.critiques for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create index idx_critiques_concept_id      on public.critiques (concept_id);
create index idx_critiques_brief_id        on public.critiques (brief_id);
create index idx_critiques_visual_spec_id  on public.critiques (visual_spec_id);
create index idx_critiques_copy_block_id   on public.critiques (copy_block_id);
create index idx_critiques_verdict         on public.critiques (verdict);
create index idx_critiques_created_at      on public.critiques (created_at desc);

comment on table public.critiques is 'Pipeline stage 6 output — assessed bundle against brand/concept/copy/visual axes; verdict may trigger one bounded refine.';
