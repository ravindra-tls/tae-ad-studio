/**
 * Critique stage — Claude call.
 *
 * Stage 6 of 7. Given the assembled bundle (brief + concept + copy + visual
 * spec), Claude plays adversarial reviewer and returns a verdict plus
 * per-axis notes and optional refine_targets.
 *
 * Also exports two refinement helpers:
 *   - refineCopyStage   — re-emits copy with the critic's instruction
 *   - refineVisualStage — re-emits visual spec with the critic's instruction
 *
 * Refinement is BOUNDED to one pass in V1 — the orchestrator calls critique,
 * and if verdict === 'refine' it runs exactly one refine target, then
 * returns. (Mirrors the MAX_SAMENESS_RETRIES = 1 pattern from concept.ts.)
 */

import Anthropic from '@anthropic-ai/sdk';
import type { BrandConfig, Brief, Concept, Product } from '@/types';
import type { Stage, StageProgress } from '../types';
import {
  CritiqueStructured,
  type CritiqueStructured as CritiqueStructuredT,
} from '../schemas/critique';
import {
  CopyStructured,
  type CopyStructured as CopyStructuredT,
} from '../schemas/copy';
import {
  type AspectRatio,
  VisualStructured,
  type VisualStructured as VisualStructuredT,
} from '../schemas/visual';
import {
  CRITIQUE_PROMPT_VERSION,
  CRITIQUE_SYSTEM_PROMPT,
  REFINE_COPY_SYSTEM_PROMPT,
  REFINE_VISUAL_SYSTEM_PROMPT,
  buildCritiqueUserMessage,
  buildRefineCopyUserMessage,
  buildRefineVisualUserMessage,
} from '../prompts/critique';

const CRITIQUE_MODEL = 'claude-sonnet-4-20250514';
const CRITIQUE_MAX_TOKENS = 2048;
const REFINE_MAX_TOKENS = 2048;

/** Bound on automated refinement loops — one shot, one stage. */
export const MAX_REFINE_RETRIES = 1;

// ─── Shared helpers ─────────────────────────────────────────────────────────

function stripJsonFence(raw: string): string {
  const trimmed = raw.trim();
  const m = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/);
  return m ? m[1].trim() : trimmed;
}

function extractText(response: Anthropic.Message): string {
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

// ─── Critique stage ─────────────────────────────────────────────────────────

export interface CritiqueStageArgs {
  brief: Brief;
  concept: Concept;
  /** Copy block structured blob (the persisted `structured` column). */
  copy: { structured: Record<string, unknown> };
  /** Visual spec structured blob. */
  visual: { structured: Record<string, unknown> };
  product: Product;
  brand: BrandConfig | null;
  /** Optional free-form guidance for the judge. */
  judge_notes?: string;
}

export interface CritiqueStageOutput {
  structured: CritiqueStructuredT;
  prompt_version: string;
  model: string;
}

export const critiqueStage: Stage<CritiqueStageArgs, CritiqueStageOutput> = {
  name: 'critique',

  async run(input, trace: StageProgress[]) {
    const started = Date.now();
    trace.push({ stage: 'critique', status: 'started' });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured.');

    const anthropic = new Anthropic({ apiKey });

    const conceptStructured = input.concept.structured;
    if (!conceptStructured || typeof conceptStructured !== 'object') {
      const err = 'Critique stage: concept.structured is missing.';
      trace.push({
        stage: 'critique',
        status: 'failed',
        error: err,
        durationMs: Date.now() - started,
      });
      throw new Error(err);
    }

    const userMessage = buildCritiqueUserMessage({
      brand: input.brand,
      product: {
        name: input.product.name,
        brand: input.product.brand,
        sub_brand: input.product.sub_brand,
        ingredients: input.product.ingredients,
        claims: input.product.claims,
        context: input.product.context,
      },
      brief: {
        objective: input.brief.objective,
        structured: input.brief.structured,
        strictness: input.brief.strictness,
        wild_card: input.brief.wild_card,
      },
      concept: conceptStructured,
      copy: input.copy.structured,
      visual: input.visual.structured,
      judge_notes: input.judge_notes,
    });

    let response: Anthropic.Message;
    try {
      response = await anthropic.messages.create({
        model: CRITIQUE_MODEL,
        max_tokens: CRITIQUE_MAX_TOKENS,
        system: CRITIQUE_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      trace.push({
        stage: 'critique',
        status: 'failed',
        error: `Claude call failed: ${msg}`,
        durationMs: Date.now() - started,
      });
      throw err;
    }

    const text = extractText(response);
    let json: unknown;
    try {
      json = JSON.parse(stripJsonFence(text));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      trace.push({
        stage: 'critique',
        status: 'failed',
        error: `Non-JSON response from Claude: ${msg}`,
        durationMs: Date.now() - started,
        output: { raw: text.slice(0, 500) },
      });
      throw new Error(
        `Critique stage: Claude returned non-JSON. First 500 chars: ${text.slice(0, 500)}`,
      );
    }

    const validation = CritiqueStructured.safeParse(json);
    if (!validation.success) {
      trace.push({
        stage: 'critique',
        status: 'failed',
        error: `Structured output failed schema validation: ${validation.error.message}`,
        durationMs: Date.now() - started,
        output: { raw: json },
      });
      throw new Error(
        `Critique stage: response did not match schema. ${validation.error.message}`,
      );
    }

    // Sanity: the prompt promises pass/reject have empty refine_targets. If
    // Claude drifts, we normalize rather than blow up.
    const verdict = validation.data.verdict;
    let targets = validation.data.refine_targets;
    if (verdict !== 'refine' && targets.length > 0) {
      console.warn(
        `[critique] verdict=${verdict} but refine_targets had ${targets.length} entries. Clearing.`,
      );
      targets = [];
    }
    if (verdict === 'refine' && targets.length === 0) {
      console.warn(
        `[critique] verdict=refine but refine_targets was empty. Downgrading to pass (nothing to do).`,
      );
    }

    const normalized: CritiqueStructuredT = {
      ...validation.data,
      verdict:
        verdict === 'refine' && targets.length === 0 ? 'pass' : verdict,
      refine_targets: targets,
    };

    const output: CritiqueStageOutput = {
      structured: normalized,
      prompt_version: CRITIQUE_PROMPT_VERSION,
      model: CRITIQUE_MODEL,
    };

    trace.push({
      stage: 'critique',
      status: 'completed',
      durationMs: Date.now() - started,
      output: {
        prompt_version: CRITIQUE_PROMPT_VERSION,
        model: CRITIQUE_MODEL,
        verdict: normalized.verdict,
        refine_target_count: normalized.refine_targets.length,
        axes: {
          brand: normalized.axes.brand.rating,
          concept: normalized.axes.concept.rating,
          copy: normalized.axes.copy.rating,
          visual: normalized.axes.visual.rating,
        },
      },
    });

    return output;
  },
};

// ─── Refine copy stage ──────────────────────────────────────────────────────

export interface RefineCopyStageArgs {
  brief: Brief;
  concept: Concept;
  product: Product;
  brand: BrandConfig | null;
  /** The copy we're refining (usually the latest copy_block.structured). */
  previous_copy: Record<string, unknown>;
  /** Critic's concrete instruction (from RefineTarget.instruction). */
  instruction: string;
  /** How many alternates to keep — default to match the previous copy shape. */
  alternates?: number;
}

export interface RefineCopyStageOutput {
  structured: CopyStructuredT;
  prompt_version: string;
  model: string;
}

export const refineCopyStage: Stage<RefineCopyStageArgs, RefineCopyStageOutput> = {
  name: 'refine',

  async run(input, trace: StageProgress[]) {
    const started = Date.now();
    trace.push({
      stage: 'refine',
      status: 'started',
      output: { target: 'copy' },
    });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured.');

    const anthropic = new Anthropic({ apiKey });

    // Try to infer alternate count from previous copy if caller didn't say.
    const prevAlts = Array.isArray(
      (input.previous_copy as { headline_alternates?: unknown[] })
        .headline_alternates,
    )
      ? (input.previous_copy as { headline_alternates: unknown[] })
          .headline_alternates.length
      : 3;
    const alternates = input.alternates ?? prevAlts;

    const userMessage = buildRefineCopyUserMessage({
      brand: input.brand,
      product: {
        name: input.product.name,
        brand: input.product.brand,
        sub_brand: input.product.sub_brand,
        ingredients: input.product.ingredients,
        claims: input.product.claims,
        context: input.product.context,
      },
      brief: {
        objective: input.brief.objective,
        structured: input.brief.structured,
        strictness: input.brief.strictness,
        wild_card: input.brief.wild_card,
      },
      concept: input.concept.structured ?? {},
      previous_copy: input.previous_copy,
      instruction: input.instruction,
      alternates,
    });

    let response: Anthropic.Message;
    try {
      response = await anthropic.messages.create({
        model: CRITIQUE_MODEL,
        max_tokens: REFINE_MAX_TOKENS,
        system: REFINE_COPY_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      trace.push({
        stage: 'refine',
        status: 'failed',
        error: `Claude call failed: ${msg}`,
        durationMs: Date.now() - started,
        output: { target: 'copy' },
      });
      throw err;
    }

    const text = extractText(response);
    let json: unknown;
    try {
      json = JSON.parse(stripJsonFence(text));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      trace.push({
        stage: 'refine',
        status: 'failed',
        error: `Non-JSON response from Claude: ${msg}`,
        durationMs: Date.now() - started,
        output: { target: 'copy', raw: text.slice(0, 500) },
      });
      throw new Error(
        `Refine copy stage: Claude returned non-JSON. First 500 chars: ${text.slice(0, 500)}`,
      );
    }

    const validation = CopyStructured.safeParse(json);
    if (!validation.success) {
      trace.push({
        stage: 'refine',
        status: 'failed',
        error: `Refined copy failed schema validation: ${validation.error.message}`,
        durationMs: Date.now() - started,
        output: { target: 'copy', raw: json },
      });
      throw new Error(
        `Refine copy stage: response did not match schema. ${validation.error.message}`,
      );
    }

    const output: RefineCopyStageOutput = {
      structured: validation.data,
      prompt_version: CRITIQUE_PROMPT_VERSION,
      model: CRITIQUE_MODEL,
    };

    trace.push({
      stage: 'refine',
      status: 'completed',
      durationMs: Date.now() - started,
      output: {
        target: 'copy',
        prompt_version: CRITIQUE_PROMPT_VERSION,
        model: CRITIQUE_MODEL,
        alternate_count: validation.data.headline_alternates.length,
      },
    });

    return output;
  },
};

// ─── Refine visual stage ────────────────────────────────────────────────────

export interface RefineVisualStageArgs {
  brief: Brief;
  concept: Concept;
  /** The copy block to keep in sync for text_zones. */
  copy: { structured: Record<string, unknown> };
  product: Product;
  brand: BrandConfig | null;
  /** The visual spec we're refining (usually latest visual_spec.structured). */
  previous_visual: Record<string, unknown>;
  /** Critic's concrete instruction. */
  instruction: string;
  /** Aspect ratio to preserve. */
  aspect_ratio: AspectRatio;
}

export interface RefineVisualStageOutput {
  structured: VisualStructuredT;
  prompt_text: string;
  aspect_ratio: AspectRatio;
  prompt_version: string;
  model: string;
}

export const refineVisualStage: Stage<
  RefineVisualStageArgs,
  RefineVisualStageOutput
> = {
  name: 'refine',

  async run(input, trace: StageProgress[]) {
    const started = Date.now();
    trace.push({
      stage: 'refine',
      status: 'started',
      output: { target: 'visual' },
    });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured.');

    const anthropic = new Anthropic({ apiKey });

    const userMessage = buildRefineVisualUserMessage({
      brand: input.brand,
      product: {
        name: input.product.name,
        brand: input.product.brand,
        sub_brand: input.product.sub_brand,
        ingredients: input.product.ingredients,
        claims: input.product.claims,
        context: input.product.context,
      },
      brief: {
        objective: input.brief.objective,
        structured: input.brief.structured,
        strictness: input.brief.strictness,
        wild_card: input.brief.wild_card,
      },
      concept: input.concept.structured ?? {},
      copy: input.copy.structured,
      previous_visual: input.previous_visual,
      instruction: input.instruction,
      aspect_ratio: input.aspect_ratio,
    });

    let response: Anthropic.Message;
    try {
      response = await anthropic.messages.create({
        model: CRITIQUE_MODEL,
        max_tokens: REFINE_MAX_TOKENS,
        system: REFINE_VISUAL_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      trace.push({
        stage: 'refine',
        status: 'failed',
        error: `Claude call failed: ${msg}`,
        durationMs: Date.now() - started,
        output: { target: 'visual' },
      });
      throw err;
    }

    const text = extractText(response);
    let json: unknown;
    try {
      json = JSON.parse(stripJsonFence(text));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      trace.push({
        stage: 'refine',
        status: 'failed',
        error: `Non-JSON response from Claude: ${msg}`,
        durationMs: Date.now() - started,
        output: { target: 'visual', raw: text.slice(0, 500) },
      });
      throw new Error(
        `Refine visual stage: Claude returned non-JSON. First 500 chars: ${text.slice(0, 500)}`,
      );
    }

    const validation = VisualStructured.safeParse(json);
    if (!validation.success) {
      trace.push({
        stage: 'refine',
        status: 'failed',
        error: `Refined visual failed schema validation: ${validation.error.message}`,
        durationMs: Date.now() - started,
        output: { target: 'visual', raw: json },
      });
      throw new Error(
        `Refine visual stage: response did not match schema. ${validation.error.message}`,
      );
    }

    // Echo-check aspect_ratio; caller's request wins on drift.
    const aspectRatio =
      validation.data.aspect_ratio === input.aspect_ratio
        ? validation.data.aspect_ratio
        : input.aspect_ratio;

    if (validation.data.aspect_ratio !== input.aspect_ratio) {
      console.warn(
        `[refine visual] asked for aspect_ratio=${input.aspect_ratio}, got ${validation.data.aspect_ratio}. Overriding to caller's value.`,
      );
    }

    const output: RefineVisualStageOutput = {
      structured: { ...validation.data, aspect_ratio: aspectRatio },
      prompt_text: validation.data.prompt_text,
      aspect_ratio: aspectRatio,
      prompt_version: CRITIQUE_PROMPT_VERSION,
      model: CRITIQUE_MODEL,
    };

    trace.push({
      stage: 'refine',
      status: 'completed',
      durationMs: Date.now() - started,
      output: {
        target: 'visual',
        prompt_version: CRITIQUE_PROMPT_VERSION,
        model: CRITIQUE_MODEL,
        aspect_ratio: aspectRatio,
        prompt_length: validation.data.prompt_text.length,
        text_zone_count: validation.data.text_zones.length,
      },
    });

    return output;
  },
};
