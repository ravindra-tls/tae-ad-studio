-- =============================================================================
-- Migration 011: copy_blocks
-- =============================================================================
-- Adds the `copy_blocks` table, which holds outputs of pipeline stage 3
-- (Copy). One row per concept that advances through checkpoint 2. A concept
-- can have multiple copy_blocks over time (re-runs / A/B exploration), so
-- we don't enforce uniqueness on concept_id — the latest row by created_at
-- is the "current" one unless a caller filters otherwise.
--
-- RLS follows the same pattern as concepts: the caller must own the concept
-- via brief → session → user_id. Writes go through the service client after
-- the route has proven ownership via RLS read.

create table public.copy_blocks (
  id              uuid        primary key default gen_random_uuid(),
  concept_id      uuid        not null references public.concepts(id) on delete cascade,
  brief_id        uuid        not null references public.briefs(id)   on delete cascade,
  -- Structured copy JSON (headline, subhead, body, cta, alternates, disclosures).
  -- Full shape is defined in lib/pipeline/schemas/copy.ts and version-tagged.
  structured      jsonb       not null,
  prompt_version  text,
  model           text,
  created_at      timestamptz not null default now()
);

alter table public.copy_blocks enable row level security;

-- Users can read copy_blocks for their own concepts.
create policy "Users can read own copy_blocks"
  on public.copy_blocks for select
  using (
    exists (
      select 1
      from public.concepts c
      join public.briefs b  on b.id = c.brief_id
      join public.sessions s on s.id = b.session_id
      where c.id = copy_blocks.concept_id and s.user_id = auth.uid()
    )
  );

-- Writes normally go through the service client, but allow authenticated
-- inserts for their own concepts (matching the concepts policy).
create policy "Users can create copy_blocks on own concepts"
  on public.copy_blocks for insert
  with check (
    exists (
      select 1
      from public.concepts c
      join public.briefs b  on b.id = c.brief_id
      join public.sessions s on s.id = b.session_id
      where c.id = copy_blocks.concept_id and s.user_id = auth.uid()
    )
  );

create policy "Admins can read all copy_blocks"
  on public.copy_blocks for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create index idx_copy_blocks_concept_id on public.copy_blocks (concept_id);
create index idx_copy_blocks_brief_id   on public.copy_blocks (brief_id);
create index idx_copy_blocks_created_at on public.copy_blocks (created_at desc);

comment on table public.copy_blocks is 'Pipeline stage 3 output — ad copy (headline, subhead, body, CTA, alternates) generated from a selected concept.';
