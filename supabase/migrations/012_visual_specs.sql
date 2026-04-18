-- =============================================================================
-- Migration 012: visual_specs
-- =============================================================================
-- Adds the `visual_specs` table, which holds outputs of pipeline stage 4
-- (Visual). A row represents: "for this concept, (optionally paired with
-- this copy block), here is the structured image spec + the assembled
-- prompt that goes to the image provider".
--
-- We don't enforce uniqueness on concept_id — a marketer may try different
-- visual interpretations of the same concept/copy pair. The latest row by
-- created_at is the "current" spec unless filtered otherwise.

create table public.visual_specs (
  id              uuid        primary key default gen_random_uuid(),
  concept_id      uuid        not null references public.concepts(id)   on delete cascade,
  brief_id        uuid        not null references public.briefs(id)     on delete cascade,
  -- Optional — a spec can be generated from a concept alone (during
  -- exploration) or anchored to a specific copy block (headline/CTA influence
  -- the text zones). Null means "no copy yet / headline-agnostic spec".
  copy_block_id   uuid        references public.copy_blocks(id) on delete set null,

  -- Assembled prompt handed to the image provider. Kept separately from the
  -- structured blob so we can query/render it directly without parsing JSON.
  prompt_text     text        not null,
  aspect_ratio    text        not null,  -- matches lib/image-providers/types GenerateParams.aspectRatio

  -- Structured spec JSON (scene, subject, lighting, style, palette, text_zones,
  -- etc.). Full shape in lib/pipeline/schemas/visual.ts.
  structured      jsonb       not null,

  prompt_version  text,
  model           text,
  created_at      timestamptz not null default now()
);

alter table public.visual_specs enable row level security;

-- Users can read visual_specs via concept → brief → session.
create policy "Users can read own visual_specs"
  on public.visual_specs for select
  using (
    exists (
      select 1
      from public.concepts c
      join public.briefs b  on b.id = c.brief_id
      join public.sessions s on s.id = b.session_id
      where c.id = visual_specs.concept_id and s.user_id = auth.uid()
    )
  );

-- Writes normally go through the service client, but allow authenticated
-- inserts for their own concepts (matches the concepts/copy_blocks policies).
create policy "Users can create visual_specs on own concepts"
  on public.visual_specs for insert
  with check (
    exists (
      select 1
      from public.concepts c
      join public.briefs b  on b.id = c.brief_id
      join public.sessions s on s.id = b.session_id
      where c.id = visual_specs.concept_id and s.user_id = auth.uid()
    )
  );

create policy "Admins can read all visual_specs"
  on public.visual_specs for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create index idx_visual_specs_concept_id    on public.visual_specs (concept_id);
create index idx_visual_specs_brief_id      on public.visual_specs (brief_id);
create index idx_visual_specs_copy_block_id on public.visual_specs (copy_block_id);
create index idx_visual_specs_created_at    on public.visual_specs (created_at desc);

comment on table public.visual_specs is 'Pipeline stage 4 output — structured visual spec (scene, mood, palette, text zones) plus the assembled image-provider prompt.';
