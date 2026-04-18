-- ═══════════════════════════════════════════════════════
-- Migration 007: briefs + concepts + FK promotion on generated_images
-- 2026-04-18 — V1 Phase 1 foundation
-- ═══════════════════════════════════════════════════════
--
-- Introduces the two new first-class persisted entities in the multi-stage
-- pipeline: `briefs` (strategic input, first stage output) and `concepts`
-- (the 2-5 directions Claude generates from an approved brief).
--
-- Also promotes generated_images.brief_id and .concept_id from plain uuid
-- columns (added in migration 006) to real FK constraints, now that the
-- referenced tables exist.
-- ═══════════════════════════════════════════════════════


-- ─── briefs ──────────────────────────────────────────────────────────────────

create table public.briefs (
  id           uuid        primary key default gen_random_uuid(),
  session_id   uuid        not null references public.sessions(id) on delete cascade,
  product_id   uuid        not null references public.products(id) on delete cascade,
  objective    text,
  audience     jsonb,
  offer        jsonb,
  hypothesis   text,
  structured   jsonb,
  source       text        not null check (source in ('quiz', 'freeform', 'imported')),
  strictness   text        not null default 'loose' check (strictness in ('off', 'loose', 'tight')),
  wild_card    boolean     not null default false,
  approved_at  timestamptz,
  created_at   timestamptz not null default now()
);

alter table public.briefs enable row level security;

-- Users can read/insert/update briefs tied to their own sessions
create policy "Users can read own briefs"
  on public.briefs for select
  using (
    exists (select 1 from public.sessions where id = briefs.session_id and user_id = auth.uid())
  );

create policy "Users can create briefs in own sessions"
  on public.briefs for insert
  with check (
    exists (select 1 from public.sessions where id = briefs.session_id and user_id = auth.uid())
  );

create policy "Users can update briefs in own sessions"
  on public.briefs for update
  using (
    exists (select 1 from public.sessions where id = briefs.session_id and user_id = auth.uid())
  );

create policy "Admins can read all briefs"
  on public.briefs for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create index idx_briefs_session_id on public.briefs (session_id);
create index idx_briefs_product_id on public.briefs (product_id);
create index idx_briefs_created_at on public.briefs (created_at desc);

comment on table public.briefs is 'Strategic input to the pipeline. Produced by the brief stage, edited/approved by the user at checkpoint 1.';


-- ─── concepts ────────────────────────────────────────────────────────────────

create table public.concepts (
  id              uuid        primary key default gen_random_uuid(),
  brief_id        uuid        not null references public.briefs(id) on delete cascade,
  title           text        not null,
  hook_archetype  text,
  description     text,
  structured      jsonb,
  selected_at     timestamptz,
  created_at      timestamptz not null default now()
);

alter table public.concepts enable row level security;

-- Users can read/insert/update concepts via their brief → session chain
create policy "Users can read own concepts"
  on public.concepts for select
  using (
    exists (
      select 1
      from public.briefs b
      join public.sessions s on s.id = b.session_id
      where b.id = concepts.brief_id and s.user_id = auth.uid()
    )
  );

create policy "Users can create concepts on own briefs"
  on public.concepts for insert
  with check (
    exists (
      select 1
      from public.briefs b
      join public.sessions s on s.id = b.session_id
      where b.id = concepts.brief_id and s.user_id = auth.uid()
    )
  );

create policy "Users can update concepts on own briefs"
  on public.concepts for update
  using (
    exists (
      select 1
      from public.briefs b
      join public.sessions s on s.id = b.session_id
      where b.id = concepts.brief_id and s.user_id = auth.uid()
    )
  );

create policy "Admins can read all concepts"
  on public.concepts for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create index idx_concepts_brief_id   on public.concepts (brief_id);
create index idx_concepts_created_at on public.concepts (created_at desc);

comment on table public.concepts is 'Candidate creative directions generated from a brief. User picks 1-2 at checkpoint 2.';


-- ─── Promote generated_images upstream columns to real FKs ───────────────────
-- The columns were created in migration 006 as plain uuid (because the
-- referenced tables did not exist yet). Now we add the FK constraints.

alter table public.generated_images
  add constraint generated_images_brief_id_fkey
    foreign key (brief_id)   references public.briefs(id)   on delete set null,
  add constraint generated_images_concept_id_fkey
    foreign key (concept_id) references public.concepts(id) on delete set null;
