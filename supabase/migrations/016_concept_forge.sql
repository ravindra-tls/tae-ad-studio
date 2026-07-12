-- ═══════════════════════════════════════════════════════
-- Migration 016: Concept Forge
-- Replaces the "Start with a Brief" workflow with the Concept Forge
-- workspace (product select → forge board → finalize → export → generate).
-- Purely additive: legacy briefs/concepts/copy_blocks/visual_specs/critiques
-- tables and all their FKs are untouched — historical gallery rows depend
-- on them.
-- ═══════════════════════════════════════════════════════


-- ─── forge_states: one working-state row per forge session ──────────────
-- Holds the whole mutable workspace (board / pins / chat / champions /
-- insightsCache / genePool / userRefs ...) as a single jsonb document.
-- Mutated via optimistic compare-and-swap on `rev`
-- (UPDATE ... WHERE rev = expected) — see lib/forge/state.ts.

create table public.forge_states (
  session_id  uuid        primary key references public.sessions(id) on delete cascade,
  state       jsonb       not null default '{}'::jsonb,
  rev         integer     not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.forge_states enable row level security;

create policy "Users can read own forge state"
  on public.forge_states for select
  using (exists (select 1 from public.sessions where id = forge_states.session_id and user_id = auth.uid()));

create policy "Users can create forge state in own sessions"
  on public.forge_states for insert
  with check (exists (select 1 from public.sessions where id = forge_states.session_id and user_id = auth.uid()));

create policy "Users can update own forge state"
  on public.forge_states for update
  using (exists (select 1 from public.sessions where id = forge_states.session_id and user_id = auth.uid()));

create policy "Users can delete own forge state"
  on public.forge_states for delete
  using (exists (select 1 from public.sessions where id = forge_states.session_id and user_id = auth.uid()));

create policy "Admins can read all forge states"
  on public.forge_states for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

comment on table public.forge_states is
  'Concept Forge working state (board/pins/chat/champions/insightsCache/genePool/userRefs). Single jsonb document mutated via optimistic CAS on rev — see lib/forge/state.ts.';


-- ─── forge_concepts: finalized (champion) concepts — durable, FK-able ────

create table public.forge_concepts (
  id             uuid        primary key default gen_random_uuid(),
  session_id     uuid        not null references public.sessions(id) on delete cascade,
  card_id        uuid        not null,
  dna            jsonb,
  card           jsonb       not null,
  champion       jsonb       not null,
  export_record  jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (session_id, card_id)
);

alter table public.forge_concepts enable row level security;

create policy "Users can read own forge concepts"
  on public.forge_concepts for select
  using (exists (select 1 from public.sessions where id = forge_concepts.session_id and user_id = auth.uid()));

create policy "Users can create forge concepts in own sessions"
  on public.forge_concepts for insert
  with check (exists (select 1 from public.sessions where id = forge_concepts.session_id and user_id = auth.uid()));

create policy "Users can update own forge concepts"
  on public.forge_concepts for update
  using (exists (select 1 from public.sessions where id = forge_concepts.session_id and user_id = auth.uid()));

create policy "Users can delete own forge concepts"
  on public.forge_concepts for delete
  using (exists (select 1 from public.sessions where id = forge_concepts.session_id and user_id = auth.uid()));

create policy "Admins can read all forge concepts"
  on public.forge_concepts for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create index idx_forge_concepts_session on public.forge_concepts (session_id);

comment on table public.forge_concepts is
  'Finalized (champion) Concept Forge concepts. card = source card snapshot at finalize time, champion = polished copy, export_record = latest template-filled image prompt. Re-finalizing a card replaces its row (unique session_id+card_id).';


-- ─── generated_images: provenance link to the forge concept ─────────────
-- Same role brief_id/concept_id play for the legacy flow: records which
-- finalized concept produced each image.

alter table public.generated_images
  add column if not exists forge_concept_id uuid
    references public.forge_concepts(id) on delete set null;

create index if not exists idx_generated_images_forge_concept
  on public.generated_images (forge_concept_id) where forge_concept_id is not null;


-- ─── product_decks: distilled Concept Forge grounding deck per product ───
-- The deck (personas with inner-life fields, pains with VOC phrases, brand
-- voice, visual style ...) is the grounding artifact every forge prompt
-- consumes. Built from products + positioning_research + brand_config,
-- cached per product, invalidated by source_hash. `overrides` holds admin
-- edits (Audience & Personas panel) merged on top of every rebuild.
-- `prompt_block` is the pre-rendered deckToPromptBlock string, stored so
-- the Anthropic prompt-cache prefix stays byte-stable across requests.

create table public.product_decks (
  product_id    uuid        primary key references public.products(id) on delete cascade,
  deck          jsonb       not null,
  overrides     jsonb       not null default '{}'::jsonb,
  prompt_block  text,
  source_hash   text        not null,
  model_id      text,
  distilled_at  timestamptz not null default now()
);

alter table public.product_decks enable row level security;

create policy "Authenticated users can read product decks"
  on public.product_decks for select
  using (auth.role() = 'authenticated');

create policy "Admins can manage product decks"
  on public.product_decks for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

comment on table public.product_decks is
  'Distilled Concept Forge grounding deck per product (personas, pains, VOC, brand voice, visual style). overrides = durable admin edits merged over every re-distill. Writes go through the service client.';


-- ─── sessions.source: document the new value (column has no constraint) ──

comment on column public.sessions.source is
  'Origin workflow: ''template'' | ''brief'' | ''copy_ad'' | ''forge'' (Concept Forge).';


-- ─── feature flag: internal team, on at 100% ─────────────────────────────

insert into public.feature_flags (name, description, enabled, rollout_percentage)
values (
  'concept_forge_ui',
  'Concept Forge workspace replacing the Start-with-a-Brief workflow. Toggle off to fall back to the template flow.',
  true,
  100
)
on conflict (name) do nothing;
