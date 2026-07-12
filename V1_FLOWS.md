# TAE Ad Studio — Visual Flows

> **SUPERSEDED (2026-07-10):** flows 2–3 (brief-first pipeline) have been replaced by the **Concept Forge** workspace (`app/session/[id]/forge`). Kept for history.

Mermaid diagrams. Render inline on GitHub, VS Code (with Mermaid preview extension), or any modern Markdown viewer.

---

## 1. How the app works today

The current system is a template-fill pipeline. No LLM reasoning in the generation path.

```mermaid
flowchart LR
    U[User] --> S[Pick product]
    S --> T[Pick template from grid<br/>50+ fixed strings]
    T --> PA[prompt-assembler.ts<br/>mechanical placeholder fill]
    PA --> BR[Prepend brand DNA<br/>prompt_modifier + claims + compliance]
    BR --> AR[Append aspect ratio hint]
    AR --> IP[imageProvider.submitGeneration<br/>xAI today, Vertex target]
    IP --> ST[Supabase Storage]
    ST --> R[Results page]
    R --> SV[Gallery SwipeView<br/>like / dislike]
    SV --> IR[(image_reactions)]
```

**Weakness:** every ad for a product comes from the same templates + same `product.context`. Structural sameness. No reasoning. No performance signal.

---

## 2. V1 target — session entry (both paths visible)

Landing page has two co-equal entry points. User chooses per session.

```mermaid
flowchart TD
    S[Session landing] --> E{User picks<br/>entry point}
    E -->|Start from brief| BF[Freeform textbox<br/>+ wild-card toggle<br/>+ brand strictness slider]
    E -->|Pick a template| TG[Template grid<br/>today's UX]
    BF --> PL[Pipeline orchestrator]
    TG --> PL
    PL --> RES[Results page with<br/>predicted-perf badges]
    RES --> SVE[SwipeView]
    SVE --> IR[(image_reactions)]
```

---

## 3. Multi-stage pipeline detail

What happens inside the orchestrator. Two visible user checkpoints; everything else streams silently with a "Show my thinking" drawer.

```mermaid
flowchart TB
    IN[Input:<br/>freeform objective or template] --> B[Stage 1: BRIEF<br/>Claude produces structured brief]
    B --> CP1{Checkpoint 1<br/>user approves/edits}
    CP1 -->|edits| B
    CP1 -->|approves| C[Stage 2: CONCEPT x N<br/>Claude proposes 3-5 directions]
    C --> SD[Sameness detector<br/>on concept JSON only]
    SD -->|too similar| C
    SD -->|diverse| CP2{Checkpoint 2<br/>user picks 1-2 concepts}
    CP2 --> CO[Stage 3: COPY<br/>headline + body + CTA]
    CO --> VS[Stage 4: VISUAL SPEC<br/>scene + palette + props + hook frame]
    VS --> RD[Stage 5: RENDER<br/>imageProvider.submitGeneration]
    RD --> CR[Stage 6: CRITIQUE<br/>Claude grades on rubric]
    CR --> RF{Critique score<br/>below threshold?}
    RF -->|yes| RFN[Stage 7: REFINE<br/>one more render with feedback]
    RF -->|no| DONE[Result card<br/>+ predicted-perf badge]
    RFN --> DONE
```

Each stage is a pure function `(input, context) → structured JSON`, implemented as a Claude call using the synthesize-route pattern. Outputs persisted in `briefs` + `concepts` so any stage is replayable.

---

## 4. Performance loop — ingestion + tagging + prediction

Once ClickHouse access lands. Two ingestion paths depending on whether the warehouse stores creative assets.

```mermaid
flowchart LR
    subgraph CH [ClickHouse media buying data]
        AD[ad_id + ROAS + CTR + thumbstop + spend]
    end
    subgraph CRE [Creative source]
        W[Warehouse has<br/>creative URL + caption<br/>PREFERRED]
        FB[FB Ad Library API<br/>FALLBACK if warehouse<br/>has no creative]
    end
    subgraph SH [Shopify]
        PUR[Purchase events]
    end
    AD --> JOB[Nightly ingestion job]
    W --> JOB
    FB --> JOB
    PUR --> JOB
    JOB --> CP[(creative_performance)]
    CP --> TAG[Creative tagger<br/>Claude vision + copy analyzer]
    TAG --> CT[(creative_tags)]
    CT --> PRED[Prediction service<br/>k-NN by tag similarity]
    CT --> INS[Per-product insights<br/>on brief page]
    PRED --> BADGE[Predicted-ROAS badge<br/>on result cards]
    CT --> GEN[Training signal for<br/>concept generation]
```

**Key decision:** ask the team for creative URLs in the warehouse export. FB Ad Library is the fallback, not the default — library coverage is patchy and API access takes 1-2 weeks to provision.

---

## 5. Eval harness — two layers

Shipped separately. Layer 1 works on day 1; Layer 2 needs the performance loop running.

```mermaid
flowchart TD
    subgraph L1 [Layer 1: Rubric grading — pre-ClickHouse]
        GS[Gold-set briefs<br/>20-30 per product] --> PPL[Pipeline runs<br/>on every prompt version bump]
        PPL --> GR[Claude grades each output<br/>6-dim rubric:<br/>source-fidelity, hook-clarity,<br/>copy-visual align, brand-fit,<br/>compliance, format]
        GR --> ES1[(eval_scores<br/>grader=claude)]
    end
    subgraph L2 [Layer 2: Performance correlation — post-ClickHouse]
        HIS[Top 20-30 historical<br/>per product with actual ROAS] --> TGH[Creative tagger on historical]
        TGH --> CTH[(creative_tags)]
        REG[Regenerate via<br/>new pipeline from<br/>brief-equivalent input] --> TGR[Creative tagger on regen]
        TGR --> CTR[k-NN similarity]
        CTH --> CTR
        CTR --> PR[Predicted ROAS band]
        PR --> VS2[vs. actual ROAS<br/>when team ships regens]
        VS2 --> ES2[(eval_scores<br/>grader=performance)]
    end
    subgraph L3 [Layer 3: Human + diversity signals — always on]
        SV[SwipeView reactions<br/>likes / dislikes per image] --> NJ[Nightly aggregation job]
        NJ --> ES3[(eval_scores<br/>grader=swipe_aggregate)]
        DIV[Same brief × N runs<br/>diversity check] --> ES4[(eval_scores<br/>grader=diversity)]
        SAN[Curated known-bad briefs<br/>sanity suite] --> ES5[(eval_scores<br/>grader=sanity)]
    end
    ES1 --> DASH[Eval dashboard]
    ES2 --> DASH
    ES3 --> DASH
    ES4 --> DASH
    ES5 --> DASH
```

---

## 6. Data model at a glance (after all V1 migrations)

Simplified ER of the new additions. Brand is a singleton (not a multi-row table) because this is a single-tenant internal tool.

```mermaid
erDiagram
    brand_config ||--o{ products : "informs all"
    products ||--o{ product_images : has
    products ||--o{ sessions : used_in
    sessions ||--o{ briefs : contains
    products ||--o{ briefs : targets
    briefs ||--o{ concepts : generates
    briefs ||--o{ generated_images : linked
    concepts ||--o{ generated_images : linked
    prompt_templates ||--o{ generated_images : linked
    generated_images ||--o{ creative_tags : tagged_with
    generated_images ||--o{ creative_performance : measured_by
    generated_images ||--o{ image_reactions : swiped
    generated_images ||--o{ eval_scores : graded
    eval_runs ||--o{ eval_scores : produces
    feature_flags }o--|| profiles : "updated_by"
    profiles ||--o{ image_reactions : makes
    brand_config {
        int id PK "singleton id=1"
        text name
        jsonb voice
        jsonb visual
        jsonb non_negotiables
        text default_strictness
    }
    briefs {
        uuid id PK
        uuid session_id FK
        uuid product_id FK
        text objective
        jsonb structured
        text source
        text strictness
        bool wild_card
    }
    concepts {
        uuid id PK
        uuid brief_id FK
        text hook_archetype
        jsonb structured
    }
    generated_images {
        uuid id PK
        uuid brief_id FK "NEW"
        uuid concept_id FK "NEW"
        uuid template_id FK "NEW"
        text status
        text image_url
    }
    creative_tags {
        uuid id PK
        uuid image_id FK "nullable"
        text external_creative_id "for historical"
        text hook_archetype
        text copy_framework
        text format
        numeric confidence
    }
    creative_performance {
        uuid id PK
        uuid image_id FK "nullable"
        text external_creative_id
        uuid product_id FK
        numeric roas
        numeric ctr
        numeric thumbstop
    }
    eval_runs {
        uuid id PK
        text purpose
        text prompt_version
    }
    eval_scores {
        uuid id PK
        uuid run_id FK
        uuid image_id FK
        text stage
        numeric score
        text grader
    }
    feature_flags {
        text name PK
        bool enabled
        uuid_array allowed_user_ids
        int rollout_percentage
    }
```

---

## 7. User journey — brief-first path (happy path)

What a marketer experiences end-to-end when using the new flow. Template path is unchanged.

```mermaid
sequenceDiagram
    actor M as Marketer
    participant UI as Session UI
    participant API as /api/pipeline/*
    participant CL as Claude
    participant IMG as Image provider
    participant DB as Supabase
    M->>UI: Lands on session page
    UI-->>M: Brief textbox + template grid (both visible)
    M->>UI: Types objective, sets strictness, clicks Generate
    UI->>API: POST /api/pipeline/brief
    API->>CL: Stage 1 prompt
    CL-->>API: Structured brief JSON
    API->>DB: Insert briefs row
    API-->>UI: Brief card (editable)
    M->>UI: Tweaks hypothesis, approves
    UI->>API: POST /api/pipeline/concept
    API->>CL: Stage 2 prompt with brief
    CL-->>API: 3-5 concept directions
    API->>CL: Sameness check on concept JSON
    CL-->>API: Pass / regenerate duplicates
    API->>DB: Insert concepts rows
    API-->>UI: Concept gallery
    M->>UI: Picks 1-2 concepts
    UI->>API: POST /api/pipeline/generate
    loop For each picked concept (streamed via SSE)
        API->>CL: Copy stage
        API->>CL: Visual spec stage
        API->>IMG: Render
        IMG-->>API: Image bytes
        API->>DB: generated_images with brief_id + concept_id
        API->>CL: Critique stage
        opt Critique score low
            API->>IMG: Refine render
        end
        API-->>UI: Streamed progress + result card
    end
    UI-->>M: Result cards with predicted-perf badges
    M->>UI: Swipes like/dislike in gallery
    UI->>DB: image_reactions
    Note over DB: Nightly job aggregates<br/>reactions into eval_scores
```
