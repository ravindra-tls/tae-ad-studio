# `lib/pipeline/` — Multi-stage generation pipeline

## Phase 0 state (2026-04-18)

Skeleton only. `orchestrator.ts` calls `stages/render.ts` as a pass-through
wrapper over the existing `imageProvider.submitGeneration`. This gives parity
with `/api/generate/submit`'s current behavior through the new abstraction
without touching that route's contract.

## Target shape (Phase 1+)

```
input → [BRIEF] → [CONCEPT × N] → [COPY] → [VISUAL SPEC] → [RENDER] → [CRITIQUE] → [REFINE?]
         ^^^^^^                  ^^^^^^^
      checkpoint 1            checkpoint 2
     (approve brief)      (pick concept directions)
```

- Every stage is a pure function `(input, context) → structured JSON`.
- Stage outputs are persisted (`briefs`, `concepts` tables — Phase 1).
- Render wraps `imageProvider.submitGeneration` — minimal change from today.
- Critique is a new Claude call; optionally triggers one Refine pass.
- Orchestrator streams progress via SSE to the client in Phase 2.

## Layout

```
lib/pipeline/
├── orchestrator.ts      # state machine, runs stages in order
├── types.ts             # shared type surface
├── stages/
│   ├── render.ts        # Phase 0 (implemented)
│   ├── brief.ts         # Phase 1
│   ├── concept.ts       # Phase 1 (incl. sameness detection)
│   ├── copy.ts          # Phase 2
│   ├── visual.ts        # Phase 2
│   └── critique.ts      # Phase 2
├── schemas/             # zod schemas per stage (Phase 1+)
└── prompts/             # system prompts per stage, version-controlled
```

## Convention for adding a new stage

Each stage follows the pattern in `stages/render.ts`:

1. Declare `Input` and `Output` types at the top.
2. Export a `const nameStage: Stage<Input, Output>` object.
3. The `run()` method pushes a `{ stage, status: 'started' }` entry onto the
   trace at the start and a `{ stage, status: 'completed' | 'failed' }` entry
   at the end — this is what drives the "Show my thinking" drawer.
4. For Claude-backed stages (Phase 1+): import from `@anthropic-ai/sdk`,
   keep the system prompt in `prompts/`, validate output with the zod schema
   in `schemas/`, persist the row, and return the parsed JSON.

Refer to `app/api/products/synthesize/route.ts` for the structured-output
pattern that every Claude stage should follow.
