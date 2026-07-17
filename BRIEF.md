# TAE Ad Studio — Product Brief


---

## 1. One-liner

**TAE Ad Studio is an internal, single-brand web app that turns product truth into scroll-stopping ad concepts — and then into finished ad images — through a gamified, LLM-driven "Concept Forge" workspace.** A marketer picks a product, forges a board of grounded concept cards (spin, breed, chat, refine), finalizes the winners into polished "champions," and renders them into on-brand images via a template-fill or concept-first prompt.

It is **not** a multi-tenant SaaS. One brand, many users, shared products. Performance (ROAS) is the intended north-star scoreboard; brand is a tonal corridor, not a layout lock.

---

## 2. Who it's for

| Role | What they do | Where |
|------|--------------|-------|
| **Marketer / creative** | Forge concepts, finalize champions, generate & swipe images | `/dashboard`, `/session/*`, `/gallery` |
| **Admin** | Manage products, brand config, research, templates, users, feature flags; review approvals & feedback; read stats | `/admin/*` |

Auth is Supabase (email/password), gated by `middleware.ts`; `profiles` carries `role` (`admin` \| user) and a usage cap. Row-level security scopes sessions/state to the owning user; admins can read all.

---

## 3. Tech stack

- **Framework:** Next.js 14.2 (App Router), React 18, TypeScript 5.5, Tailwind + Radix UI. Dev server on port 5020 (`npm run dev`).
- **Backend/data:** Supabase (Postgres + Auth + Storage + RLS). Migrations in `supabase/migrations/001–016`.
- **LLM:** Anthropic SDK (`@anthropic-ai/sdk` ^0.90). Model tiers in `lib/forge/models.ts`:
  - `generator` → **Haiku 4.5** (`claude-haiku-4-5-20251001`) — high-volume card generation **and** the judge (temp 0).
  - `sonnet` → **Sonnet 4.6** (`claude-sonnet-4-6`) — director chat, refine, deck distillation.
  - `opus` → **Opus 4.8** (`claude-opus-4-8`) — champion polish, insight mining, export fills (temperature stripped centrally in `lib/forge/anthropic.ts`).
- **Image generation:** provider registry (`lib/image-providers/`) with a single active slot via `IMAGE_PROVIDER` env — `openai` (gpt-image-2, default), `vertex` (Gemini image), `xai`. Handles masked lasso edits, reference edits, and pure text-to-image.
- **Storage:** Supabase Storage buckets for generated images, product reference images, and session reference uploads (signed URLs minted at submit time).

---

## 4. The core: Concept Forge

The whole product centers on the forge workspace at `app/session/[id]/forge/*`, backed by `lib/forge/*`. It is a **generate → judge → gate → refill** loop wrapped in a game-like UI (score, streak, favorites).

### 4.1 Grounding deck (the truth layer)

Every prompt is grounded in a per-product **deck** (`lib/forge/deck.ts`, cached in `product_decks`). A deck is distilled by an LLM from:

- the `products` row + `product_context`,
- the latest active `positioning_research` (matched by product name), and
- the singleton `brand_config` (voice, visual style, non-negotiables).

Tiered build: **T1** full distill when research exists → **T2** product+context only with per-persona enrichment → **T3** pure-TS minimal deck fallback. A **deterministic compliance overlay** (banned language, no medical claims) is always applied after the model — compliance is never trusted to the LLM. Admin edits live in `product_decks.overrides` and are re-merged on every re-distill. The rendered `prompt_block` is stored so the Anthropic prompt-cache prefix stays byte-stable.

A deck carries: brand/product/one-liner/market/price, `anchorType` (pain \| desire), product truths, mechanisms, proof points, **personas with inner-life fields** (inner monologue, unspoken fears, shame moments, identity lost/desired), **pains with VOC phrases**, brand voice (approved/banned language), constraints, offer, and visual style.

### 4.2 Card DNA and the creative taxonomy

Each concept **card** is defined by a DNA vector that maps 1:1 onto the creative-strategy skill stack (`lib/forge/knowledge/taxonomies.json`):

```
persona × pain × awarenessStage → messagingAngle → mechanic → hookTactic / trigger / voicePattern → format
```

- **Awareness stages:** unaware → problem-aware → solution-aware → product-aware → most-aware.
- **Mechanics** (how the viewer arrives at the truth): Implied Answer, Social Witness, Overheard Conversation, Reframe, Borrowed Enemy, Trojan Horse, Contrast Without Comment, "This and a…".
- **Triggers:** Pattern Interrupt, Identity Call-Out, Pain Agitation, Curiosity Gap, Social Proof, Contrarian, Aspiration, Urgency/Stakes.
- **Hook tactics:** 30+ (Curiosity, Contrarian, Confession, Bold Claim, Myth Busting, Price Anchor, …).
- **Voice patterns:** 10 native-feed structures (Confession & Gatekeeping, Hot Takes, Experience Arc, …).
- **Formats:** 45+ visual formats with medium + funnel stage.

A card holds its DNA plus `emotionalInsight`, `messagingAngle`, `concept`, `tagline`, `visualIdea`, `hookSpoken` / `hookVisual` / `hookTextOverlay`, `primaryText`, `cta`, `rationale`, and judge `scores`.

### 4.3 The generation loop

`lib/forge/engine.ts` orchestrates:

1. **Deal** (`dealHand` / `dealStream`) — build a diversity plan across DNA dimensions, over-generate ~2× the target in parallel chunks (Haiku, temp 1), and stream cards to the board as each chunk clears the gate.
2. **Judge** (`lib/forge/judge.ts`) — a "ruthless creative director" scores every card on 6 dimensions (product truth, emotional truth, specificity, concreteness, scroll-stop, brand voice) → `overall`, with a hard **banned-language / compliance gate**. `PASS_THRESHOLD = 70`. Only passing cards ever reach the player.
3. **Refill** — a second round fires only if a round fully errored; never just to top up. Keeps cost bounded and predictable.

### 4.4 The four ways a marketer creates

- **Spin / Deal** — deal a fresh hand of concepts from the current pins/loadout.
- **Breed** (`breedCards`) — combine 2+ favorite parent cards into new offspring, with suppression of rejected genes.
- **Director chat** (`lib/forge/director.ts`, Sonnet) — a senior direct-response creative director sitting next to the user. Non-linear: pin any single part (tagline, persona, mechanic, format…) and it assembles complete grounded concepts around it, or refines referenced cards in place.
- **Inline refine** (`lib/forge/refine.ts`, Sonnet) — select text on a card → comment → regenerate just that concept.

Supporting moves: **insight mining** (`lib/forge/insights.ts`, Opus) surfaces raw human tensions from a persona's inner life (empathetic final ad, uncomfortable ideation); a **gene pool** reinforces dimension weights from keeps/discards; **favorites**, **suppressed**, **score** and **streak** gamify the session.

### 4.5 Finalize → champion → export → image

1. **Finalize** (`lib/forge/champion.ts`, Opus) polishes a chosen card into a **champion**: headline, taglines, concept, visual idea, hooks, primary text, beats, why-it-works, and a compliance check. Stored durably in `forge_concepts`.
2. **Export** (`lib/forge/export.ts`, Opus) fills a **proven ad-layout template** (async against the live `prompt_templates` table) — or composes concept-first — into ONE reproducible image prompt (`ExportRecord`): prompt + negatives folded in as an "Avoid:" line, aspect normalized to the provider enum, text zones, warnings, reference images, enhancers.
3. **Generate image** (`POST /api/forge/generate-image`) renders it with the live provider with full gallery-contract parity: usage-cap pre-check, server-authoritative prompt, reference resolution (session uploads first, else product images), `generated_images` row (status lifecycle `queued → completed / failed / nsfw`), bucket upload, usage increment, `forge_concept_id` provenance link.
4. **Gallery + SwipeView** — results feed the Tinder-style `SwipeView`; likes/dislikes land in `image_reactions`, the human-grader eval signal.

---

## 5. Data model (Concept Forge additions, migration 016)

| Table | Role |
|-------|------|
| `forge_states` | One jsonb working-state doc per session (board / pins / chat / champions / insightsCache / genePool / userRefs). Mutated via optimistic **compare-and-swap on `rev`**. |
| `forge_concepts` | Finalized champions — durable, FK-able. `card` snapshot + `champion` polish + latest `export_record`. Unique `(session_id, card_id)`. |
| `product_decks` | Distilled grounding deck per product + admin `overrides` + pre-rendered `prompt_block`, invalidated by `source_hash`. |
| `generated_images.forge_concept_id` | Provenance: which finalized concept produced each image. |

Legacy tables (`briefs`, `concepts`, `copy_blocks`, `visual_specs`, `critiques`) are **untouched** — historical gallery rows still depend on them. `sessions.source` now takes `'forge'` alongside `'template' | 'brief' | 'copy_ad'`.

Foundational tables from earlier migrations: `profiles`, `products` + `product_context` + `product_images` + `context_contributions`, `sessions`, `generated_images`, `image_reactions`, `feedback_submissions`, `brand_config` (singleton id=1), `feature_flags`, `positioning_research`, `prompt_templates`.

---

## 6. Other flows (still present)

- **Template flow** (`/session/[id]/prompts`) — the original template-fill image generator: pick product → pick template(s) → `lib/prompt-assembler.ts` fills `[PLACEHOLDER]` tokens → render. Kept as a fallback and a training signal; toggled by the `concept_forge_ui` feature flag (on at 100%).
- **Copy-ad** (`/copy-ad`) — copy/clone an existing ad's structure.
- **Gallery** (`/gallery`) — browse, swipe, and manage generated images + template previews.

---

## 7. Admin surface (`/admin`)

Approvals · Brand (edit `brand_config`) · Research (positioning research) · Products · Templates · Users · Feature flags · Feedback · Settings · Stats. The **Audience & Personas** panel writes deck `overrides`.

---

## 8. Quality, compliance & evals

- **Hard compliance gate** at generation, judge, and deck-build time — deterministic banned-language / no-medical-claims overlay, never delegated to the model.
- **Judge rubric** (6-dim, threshold 70) gates every card before it reaches the board.
- **Human grader:** `image_reactions` via SwipeView (intended to aggregate nightly into eval scores).
- **Feature flags** (`feature_flags` + `/admin/feature-flags`, server `isEnabled` / client `useFeatureFlag`) gate rollout of new surfaces.

---

## 9. Roadmap & explicitly out of scope

**Intended next (per V1 thesis, gated on data access):** ClickHouse media-buying + Shopify conversion ingestion → `creative_performance`; a creative tagger; predicted-ROAS badges on result cards; retrospective eval on top ads per product.

**Not in scope:** video generation, agency/multi-tenant mode, fine-tuning, external design-partner eval program, removing the static template bank.

---

## 10. Key file map

```
lib/forge/
├── engine.ts        # deal / breed loop: generate → judge → gate → refill
├── generator.ts     # card generation (Haiku, temp 1) + system-block builder
├── judge.ts         # 6-dim scoring + compliance gate (PASS_THRESHOLD 70)
├── director.ts      # chat creative-partner (Sonnet)
├── refine.ts        # inline select-to-comment refinement (Sonnet)
├── insights.ts      # deep audience-tension mining (Opus)
├── champion.ts      # finalize / polish (Opus)
├── export.ts        # champion → reproducible image prompt (Opus)
├── deck.ts          # per-product grounding deck distill + compliance overlay
├── knowledge/       # taxonomies.json, archetype families, format composition, prompt fragments
├── models.ts        # model tiers + temps
├── schema.ts        # tool (structured-output) schemas
├── state.ts         # forge_states CAS read/write
└── types.ts         # domain types (ForgeCard, ForgeDeck, ForgeState, …)

app/session/[id]/forge/   # workspace UI: composer, board, chat rail, detail steps, comments
app/api/forge/            # deal, breed, chat, refine, champion, export, generate-image, insights, deck, session, …
lib/image-providers/      # openai / vertex / xai registry
supabase/migrations/      # 001–016 (016 = Concept Forge)
```

---

_Source docs in-repo: `V1_PLAN.md` and `V1_FLOWS.md` (both marked superseded — brief-first pipeline replaced by Concept Forge). This brief reflects the current live system._

---

## Architecture update (July 2026)

The single-brand model above has been superseded by a **workspace** model (migrations 020–026):

- **Workspaces & roles** — every user belongs to exactly one workspace. Role hierarchy: `dev` > `admin` > `user`. New members join via invites; a signup without a matching invite lands in a **pending** state until assigned. Devs bootstrap/oversee all workspaces; admins manage their own.
- **Workspace scoping** — `products` (+ context/images/decks), `brand_config` (no longer a singleton), the gallery (`generated_images`), and `sessions` are all scoped to a workspace; RLS enforces isolation (hardened in 026).
- **Template catalog** — `prompt_templates` are either **universal** (dev-curated, visible to all workspaces) or **workspace-local**, with a proposal lifecycle: user **proposes** → workspace admin **approves** (workspace template) → dev can **promote** to universal.
- **Feedback routing** — general feedback routes to the **dev inbox**; template/other proposals route to the proposing user's **workspace admins**.
- **DB-backed stars** — image stars moved from localStorage to `image_stars` (one-time client import of legacy keys via `POST /api/images/stars/import`; hook `lib/hooks/use-starred.ts`).
- **Search** — trigram (`pg_trgm`) indexes power fuzzy search across the gallery and template catalog.
- **Authorization** — `lib/auth/guards.ts` is the **single authorization entry point** (session → profile → workspace/role guards); routes and server actions call it instead of ad-hoc checks.

**Migration ledger:** `020_workspaces_core` · `021_workspace_scoping` (+ `021b_products_workspace_notnull`, `021c_handle_new_user_no_fallback`, `021d_dev_bootstrap`) · `022_image_stars` · `023_feedback_routing` · `024_template_scope` · `025_search` · `026_rls_defense`.
