# V1 Plan — TAE Ad Studio

_Working doc. Revised 2026-04-18 after Ravindra's inline review._
_Anchor commit: `22b06f9`._

---

## 0. What the app does today

The current app is a **template-filling image generator**:

1. User picks a product (rich structured context already attached).
2. User picks one or more templates from a bank of 50+ fixed strings.
3. `lib/prompt-assembler.ts` mechanically replaces `[PLACEHOLDER]` tokens with values from `Product` + `ProductContext`. Prepends brand DNA (`prompt_modifier`, claims, compliance rules). Appends aspect-ratio text.
4. `POST /api/generate/submit` calls the image provider synchronously (xAI today; Vertex Gemini 3 Pro Image is the target). Image goes to Supabase storage.
5. User sees result, like/dislikes in the gallery's Tinder-style `SwipeView`.

There is **no LLM in the generation path**. The only Claude call today is `app/api/products/synthesize/route.ts` — product/context synthesis with strict source-fidelity rules.

### What's already good
- The synthesize route pattern (structured content blocks → JSON schema → `JSON.parse`) is the template for every new Claude stage.
- Provider abstraction (`lib/image-providers/*`) is clean — adding a provider is one file.
- Data model is richer than expected: `ProductContext` with benefits, stats, testimonials, scene, mood, CTAs, colors. Admin approval workflow. Image reactions. Feedback/template proposals.
- **`SwipeView` + `image_reactions`** is a real eval signal already in production — we use it in V1, don't rebuild it.
- Session → prompts → generate → results flow has the right shape for adding stages.

### What V1 exposes as weakness
- Structural sameness risk: every ad for a product comes from the same template bank + same context JSON.
- No reasoning in the pipeline: Claude never critiques, iterates, or chooses between directions.
- No performance signal (ClickHouse/Shopify) anywhere.
- `generated_images` has no link to the template, brief, or concept that produced it — can't learn across generations.

---

## 1. Bugs / inconsistencies to fix before feature work

Small, fast. One housekeeping PR.

1. **`@anthropic-ai/sdk` is imported in `app/api/products/synthesize/route.ts` but not in `package.json`.** Confirmed: Ravindra has it installed locally (dev machine only), which is why it works in local runs. Fix = `npm install @anthropic-ai/sdk --save` so server/CI builds are reproducible.
2. **Provider state (intentional, document it).** xAI is the **temporary bridge**, Vertex AI (Gemini 3 Pro Image) is the **target**. Today `lib/image-providers/index.ts` exports `xai` as default and `submit/route.ts` hardcodes `api_provider: 'xai'`. Keep this working, but add a comment block noting it's temporary, and route selection via env. No cutover in V1.
3. **Reference images go as base64 data URLs in the request body.** Not a DB-bloat issue — DB never sees them. It's a request-size issue at upload-heavy sessions. Move to Supabase Storage (signed URLs), with a lifecycle rule to auto-delete N days after session archive. Cheap; do this in Phase 1 alongside the pipeline refactor.
4. **`generated_images` has no `template_id` / `brief_id` / `concept_id`.** Ten-line migration, unlocks every downstream per-X performance report. Do this in Phase 0.

---

## 2. V1 thesis (locked after review)

1. **Performance is the scoreboard.** ROAS/ROCE is the eval. Brand is a tonal corridor, not a layout lock.
2. **Close the loop** with ClickHouse media-buying data + Shopify conversions joined on creative_id. This is the moat.
3. **Multi-stage pipeline**, hidden behind one "Generate" button by default, with two visible checkpoints: brief approval + concept selection.
4. **Adaptive quiz**, per-product (not per-brand). Rich the first time a product is discussed, minimal after. Claude decides how many questions to ask.
5. **Variance is a property, not a bug.** Sameness detector runs on **text prompts / concept JSON only** — never on rendered images (credit cost).
6. **Brand context is a soft hint, not a guardrail.** Variable importance per-generation. Marketers can turn it down when chasing performance.
7. **Single workspace, one brand, many users, shared products.** This is an internal tool. No multi-tenant complexity in V1.

---

## 3. Keep / Change / Remove

### Keep as-is
- Auth, `profiles`, usage cap.
- `products`, `product_images`, `context_contributions`, admin approval workflow.
- Session model.
- `generated_images` storage + status lifecycle (extend, don't replace).
- **`image_reactions` + `SwipeView`** — this is V1's human-grader signal.
- `feedback_submissions` including `template_proposal`.
- Admin panels (approvals, feedback, products, settings, stats, templates, users).
- Provider abstraction.
- Synthesize route pattern — copy it for every new Claude stage.

### Change
- **Prompt pipeline.** From "fill template → image" to "brief → concept → copy → visual spec → image → critique → refine" (see §5). Stages are persisted; user has 2 checkpoints.
- **Templates.** The static bank stays. But Claude can also propose per-product **learned templates** from performance data (once ClickHouse is wired). Both surfaces are shown equally.
- **Session entry UX.** Today: template grid only. New: **two equally visible entry points** side-by-side — "Start from a brief" (freeform textbox, kicks off the pipeline) and "Pick a template" (today's grid). User chooses per session.
- **Brand in the data model.** Today brand fields are mixed into `product.context` (colors, tagline, `prompt_modifier`). We lift these into a **single global brand config** (singleton row, admin-editable). Product `context` becomes strictly product truth (benefits, stats, testimonials, claims). Brand strictness is a per-generation slider (Off / Loose / Tight), default Loose.
- **Placeholder warnings.** Less needed once templates are LLM-generated. Keep as fallback for the static bank.

### Add
- Brief + concept + creative-tag + creative-performance tables (§4).
- Multi-stage pipeline orchestrator (§5).
- Performance ingestion from ClickHouse + Shopify (§6).
- Creative tagger (Claude job emitting structured features from any ad's text/metadata).
- Adaptive quiz engine (per-product state).
- **Predicted-performance scoring badge** on result cards — small UI element that shows a predicted ROAS band ("mid-high, based on 12 similar tagged ads"), computed by looking up creative_tags similarity in `creative_performance`. Gives marketers a spend-confidence signal before pushing to Meta. Only lights up once ClickHouse is ingested.
- **Internal eval harness** — two layers, shipped separately:
  - *Layer 1 — Rubric grading (pre-ClickHouse, doable day-1):* Claude grades each generated ad on a 6-dim rubric (source fidelity, hook clarity, copy-visual alignment, brand fit, compliance, format correctness). Aggregated into `eval_scores`. Runs on every prompt-version bump. Bar for shipping prompt edits.
  - *Layer 2 — Performance correlation (post-ClickHouse):* Uses ad_id from ClickHouse + actual creative (image + caption) pulled from (a) team's warehouse if creative URLs are stored, or (b) FB Ad Library API as fallback. Creative tagger labels both historical ads and generated ads with the same `creative_tags` schema → predict ROAS by k-NN on tag similarity. Retrospective eval regenerates top 20-30 per product and checks whether our predicted band matches actual.
  - *Also feeding evals:* SwipeView aggregate (nightly job, `grader='swipe_aggregate'`), diversity check (same brief × N runs), sanity cases (curated known-bad briefs).
- **Wild card toggle** in V1 — "Loose / Off-brand experimental" switch on the brief page. Small; see if it earns its keep.

### Remove or defer
- Nothing is deleted. The static template bank stays as one of two entry points. It's also a training signal for the dynamic template generator.
- Video, agency multi-tenant, cultural-moment radar, competitor preemption, narrative universe builder — all V2+.
- "Eval via external design partners" — dropped. `SwipeView` already gives us per-image human ratings; we wire those into `eval_scores` instead.

---

## 4. Data model additions

All additive. Nothing breaking. Multi-tenant assumptions stripped out given single-brand internal-tool context.

### Brand config (singleton)
One row, admin-editable via existing admin panel. No new table needed — add a `brand_config` JSON column to a settings row, or a tiny `brand_config` table with one row.

```sql
create table brand_config (
  id int primary key default 1 check (id = 1),  -- singleton
  name text not null,
  voice jsonb,               -- tonal range, do/don't words, example phrases
  visual jsonb,              -- palette, typography hints, imagery rules
  non_negotiables jsonb,     -- hard rules (logo lockup, legal)
  default_strictness text not null default 'loose' check (default_strictness in ('off','loose','tight')),
  updated_at timestamptz not null default now()
);
```

Products stay unchanged. The brand fields currently living in `product.context` (primary_color, accent_color, tagline, etc.) get migrated into `brand_config.visual` and removed from product context over time — non-blocking.

### Briefs + concepts

```sql
create table briefs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  product_id uuid not null references products(id),
  objective text,            -- e.g. cold acquisition, retargeting, offer push
  audience jsonb,
  offer jsonb,
  hypothesis text,
  structured jsonb,          -- full Claude-generated brief (schema-versioned)
  source text not null check (source in ('quiz','freeform','imported')),
  strictness text not null default 'loose' check (strictness in ('off','loose','tight')),
  wild_card boolean not null default false,
  approved_at timestamptz
);

create table concepts (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid not null references briefs(id) on delete cascade,
  title text not null,
  hook_archetype text,       -- curiosity, contrarian, social_proof, etc.
  description text,
  structured jsonb,
  selected_at timestamptz,
  created_at timestamptz not null default now()
);
```

### Link generated images to their upstream

```sql
alter table generated_images add column brief_id uuid references briefs(id);
alter table generated_images add column concept_id uuid references concepts(id);
alter table generated_images add column template_id uuid references prompt_templates(id);
```

**Ship these FKs in Phase 0 even before the pipeline lands** — they unlock per-X performance reporting the moment any of brief/concept/template exists.

### Creative tags (applies to our ads + imported historical)

```sql
create table creative_tags (
  id uuid primary key default gen_random_uuid(),
  image_id uuid references generated_images(id) on delete cascade,
  external_creative_id text, -- for historical/imported ads without a generated_image
  hook_archetype text,
  copy_framework text,       -- AIDA, PAS, before-after-bridge, etc.
  emotional_register text,
  format text,               -- UGC, hero, testimonial card, comparison
  palette_temp text,         -- warm/cool/neutral
  predicted_roas_band text,  -- low/mid/high
  confidence numeric,
  source text not null check (source in ('auto','human','both')),
  created_at timestamptz not null default now(),
  check (image_id is not null or external_creative_id is not null)
);
```

### Creative performance (ClickHouse + Shopify join landing zone)

```sql
create table creative_performance (
  id uuid primary key default gen_random_uuid(),
  image_id uuid references generated_images(id),
  external_creative_id text,
  product_id uuid references products(id),
  platform text,                   -- meta, google, tiktok
  campaign_id text,
  window_start timestamptz,
  window_end timestamptz,
  spend numeric,
  impressions bigint,
  clicks bigint,
  ctr numeric,
  thumbstop numeric,
  purchases integer,
  revenue numeric,
  roas numeric,
  raw jsonb,
  updated_at timestamptz not null default now()
);
```

### Evals

```sql
create table eval_runs (
  id uuid primary key default gen_random_uuid(),
  name text,
  purpose text,                    -- regression / retrospective / gold-set
  prompt_version text,             -- so we can A/B prompt changes
  created_at timestamptz not null default now()
);

create table eval_scores (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references eval_runs(id) on delete cascade,
  image_id uuid references generated_images(id),
  stage text,                      -- brief / concept / copy / visual / image
  rubric text,
  score numeric,
  rationale text,
  grader text,                     -- 'claude' | 'swipe_aggregate' | user_email
  created_at timestamptz not null default now()
);
```

`eval_scores.grader = 'swipe_aggregate'` is how we fold `image_reactions` into evals — a nightly job aggregates likes/dislikes per image into a score row.

---

## 5. Pipeline architecture

### Stages (hidden behind one Generate button; streaming progress)

```
input → [BRIEF] → [CONCEPT x N] → [COPY] → [VISUAL SPEC] → [RENDER] → [CRITIQUE] → [REFINE?]
         ^^^^^^                  ^^^^^^^
      checkpoint 1            checkpoint 2
     (approve brief)      (pick concept direction)
```

- Every stage is `(input, context) → structured JSON`, implemented as a separate Claude call using the synthesize route pattern.
- Outputs are persisted per stage. If user edits a brief, downstream re-runs.
- **Render** wraps existing `imageProvider.submitGeneration` — minimal change.
- **Critique** grades the rendered ad against a rubric and optionally triggers one Refine pass.
- **Sameness detector** runs on concept JSON (not images). If 2+ concepts cosine-close or Claude-judged similar, we regenerate the duplicates before rendering.

### File layout

```
lib/pipeline/
├── orchestrator.ts         # state machine, streams progress via SSE
├── stages/
│   ├── brief.ts
│   ├── concept.ts          # with sameness detection built in
│   ├── copy.ts
│   ├── visual.ts
│   ├── render.ts           # wraps imageProvider
│   └── critique.ts
├── schemas/                # zod schemas for each stage's I/O
└── prompts/                # system prompts per stage, version-tagged
```

### Session entry UX

Today's single `prompt-workspace.tsx` becomes a landing page with **two equal entry points** side-by-side:

1. **Start from a brief.** Freeform input + optional "start from a saved brief" dropdown + wild-card toggle + brand-strictness slider. Submit fires stage 1.
2. **Pick a template.** Today's grid. Unchanged.

Brief-first path then continues:

3. **Checkpoint 1 — brief approval.** Claude's structured brief is an editable card. User tweaks hypothesis/audience/offer. Approve → stage 2.
4. **Concept gallery.** 3-5 concept cards (title, hook archetype, one-line rationale, small sketch). User picks 1-2.
5. **Generate runs.** Copy, visual spec, render, critique happen without further input. Progress streamed. "Show my thinking" drawer for depth.
6. **Results page.** Each variant has image, copy, hook tag, predicted-performance badge (once ClickHouse is live), per-stage regenerate buttons. Gallery's SwipeView continues to collect reactions.

### Why this is implementable on top of current code

- `prompt-workspace.tsx` already has selection, editing, reference images, parallel submit. The new surface is additive — new page at `session/[id]/brief` alongside the existing grid. No rip-and-replace.
- `api/generate/submit/route.ts` contract stays. Orchestrator uses it as the "render" primitive.
- `synthesize/route.ts` is the blueprint for every new stage.

---

## 6. Performance loop (once ClickHouse access lands)

### Highest-leverage first build (before any new UI)

**Creative tagger** — a Claude-powered job that reads the prompt/copy/metadata of every ad in ClickHouse and writes structured tags (hook archetype, copy framework, format, emotional register, audience stage). Nightly or on-demand.

This unlocks, in one move:

1. **Per-product performance insights.** "Your top 5 ads for this product in the last 90 days are all curiosity hooks with testimonial reveals." First thing the brief page should surface.
2. **Training signal for concept generation.** When Claude generates concepts, bias toward hook archetypes with proven performance for this product/category.
3. **Predicted-performance badge.** Tag a generated ad → look up similar tagged historical ads → output a predicted ROAS band.

### Ingestion shape
- A Next.js route or background worker queries ClickHouse → writes `creative_performance`.
- `app/api/webhook/route.ts` currently updates `generated_images` by request_id — it's an async image-gen callback, **not Shopify**. A separate route will handle Shopify purchase events when we need them.
- Join happens nightly via a scheduled job.

### Retrospective eval (the V1 north-star eval)

When ClickHouse is available:

1. Pull **top 20-30 ads per product** by actual ROAS, with `ad_id` + creative asset URLs + caption. Prefer getting creative URLs in the warehouse directly; fall back to FB Ad Library API by `ad_id` if the warehouse doesn't carry assets.
2. Run the creative tagger on the historical creative — same `creative_tags` schema as our generated ads.
3. Regenerate each historical ad from a brief-equivalent input using the new pipeline.
4. Predict ROAS band for each regenerated ad via k-NN on `creative_tags` against the historical set.
5. Have Claude rank each set (historical + regenerated siblings) blind for a separate ranking signal.
6. Cross-reference predictions + rankings with actual performance.

This measures the product's core value (prediction quality) directly. Prerequisite: team includes `ad_id` + creative URLs in the ClickHouse export (or Meta Ad Library API access is provisioned as fallback).

---

## 7. Sequenced workstreams

One engineer + Claude.

### Phase 0 — Housekeeping (2-3 days)
- Confirm + commit `@anthropic-ai/sdk` to `package.json`. Smoke-test the synthesize route end-to-end.
- Document xAI as temporary, Vertex as target, in `lib/image-providers/index.ts` and `submit/route.ts`. No cutover.
- Add `template_id` / `brief_id` / `concept_id` FKs to `generated_images`.
- Create `lib/pipeline/` skeleton with a pass-through orchestrator that wraps existing `assemblePrompt` + `submitGeneration` in one stage (parity check).

### Phase 1 — Foundation (1-1.5 weeks)
- Migrations: `briefs`, `concepts`, `brand_config` singleton.
- Ref-image uploads move to Supabase Storage with signed URLs + lifecycle rule.
- First real stages: `brief.ts`, `concept.ts` with sameness detection.
- Routes: `api/pipeline/brief`, `api/pipeline/concept`.
- Brief-first surface + concept gallery UI, rendered alongside existing template grid (both entry points visible).
- **Feature flag primitive + admin UI** — `feature_flags` table, `/admin/feature-flags` page, server+client helpers. Admins control which users see which flags. Lets us ship brief-first UI to internal testers before the wider team.

### Phase 2 — Full pipeline + checkpoints (2-3 weeks)
- `copy.ts`, `visual.ts`, `critique.ts`.
- Orchestrator streaming progress via SSE.
- "Show my thinking" drawer.
- Concept approval gates.
- Brand strictness slider + wild-card toggle wired to brief creation.

### Phase 3 — Adaptive quiz + variance (1-2 weeks)
- Per-product quiz state (quiz decides whether to ask, how many, which questions).
- Sameness detector on concept JSON (cosine or Claude-judged).

### Phase 4 — Performance loop (3-4 weeks, gated on ClickHouse access)
- ClickHouse ingestion + Shopify join → `creative_performance`.
- Creative tagger job.
- Performance-insight panel on brief page.
- Predicted-performance badge on result cards.
- Retrospective eval harness using top 20-30 ads per product.

### Phase 5 — Evals and learning (ongoing)
- Nightly job: aggregate `image_reactions` (SwipeView) into `eval_scores` with `grader='swipe_aggregate'`.
- Internal gold-set eval runs on every prompt version change.
- Per-stage thumbs in production → eval dataset.
- Prompt A/B via `eval_runs.prompt_version`.

---

## 8. Decisions locked (from review)

All resolved:

1. **LLM stack.** Anthropic SDK for Claude. Vertex for image gen (target). xAI is the temporary image-gen bridge.
2. **Brand entity.** Singleton `brand_config`, not a multi-row table. Brand strictness is a per-generation slider, default Loose.
3. **Workspace scope.** Single-tenant internal tool. One brand, many users, shared products. No org/workspace FKs.
4. **Template bank.** Kept, as a co-equal entry point (not demoted). Also a training signal for the dynamic template generator later.
5. **Wild card mode.** In V1, as a toggle on the brief page. If it's not used in 3 months, cut it.
6. **Eval signal.** `SwipeView` + `image_reactions` is the human grader. Aggregate into `eval_scores` nightly. No external design-partner outreach.
7. **ClickHouse confirmation** still pending: (a) creative_id granularity, (b) creative text/copy availability, (c) platform coverage, (d) join key to Shopify. Phase 4 is gated on this.
8. **Feature flags — admin-controlled.** Add in Phase 1. Single table `feature_flags (name, enabled, allowed_user_ids[], rollout_percentage, updated_by)` + `/admin/feature-flags` page in the existing admin panel. Admins flip toggles, add user emails, set rollout %. Helpers: server `isEnabled(flag, userId)`, client `useFeatureFlag(flag)`. Enables safe rollout of the brief-first UI and every future experimental flow.

---

## 9. Things explicitly NOT in V1

- Video generation.
- Agency / multi-tenant mode.
- Cultural-moment radar, competitor preemption, narrative universe builder.
- Fine-tuning any model.
- External design-partner eval program (SwipeView replaces this in V1).
- Removing the static template bank.

---

## 10. First-week plan (actionable)

Day 1-2: Phase 0 housekeeping PR (SDK dep, FKs, pipeline skeleton, provider comments).
Day 3-4: `brand_config` singleton migration + admin edit panel (tiny). Begin `briefs` / `concepts` migrations.
Day 5: First real `brief.ts` stage + `api/pipeline/brief` route. Smoke-test end-to-end with one product.
Day 6-7: Feature flag primitive + brief-first UI shell behind the flag, alongside existing grid.

At end of week 1: internal user can type a freeform objective, get a structured brief back, approve it, and see a stubbed-out concept gallery. No rendering yet.
