/**
 * Concept stage — Claude call with sameness detection.
 *
 * Stage 2 of 7. Given an approved brief, produces N (3-5) candidate creative
 * directions. Runs TWO sameness checks in parallel (Claude-judged + TF-IDF
 * cosine) on every batch; regenerates ONLY the flagged indices in-place
 * (kept concepts stay unchanged) before returning.
 *
 * See `sameness.ts` for the two-method design rationale.
 *
 * The API route (app/api/pipeline/concept) owns persistence; this file owns
 * only the LLM calls + validation + the sameness loop.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { BrandConfig, Brief, Product } from '@/types';
import type { Stage, StageProgress } from '../types';
import {
  ConceptBatchOutput,
  ConceptReplacementBatch,
  ConceptStructured,
  type ConceptStructured as ConceptStructuredT,
} from '../schemas/concept';
import {
  CONCEPT_PROMPT_VERSION,
  CONCEPT_REPLACEMENT_SYSTEM_PROMPT,
  CONCEPT_SYSTEM_PROMPT,
  SAMENESS_PROMPT_VERSION,
  buildConceptReplacementUserMessage,
  buildConceptUserMessage,
} from '../prompts/concept';
import { runSamenessChecks, type SamenessRound } from './sameness';

const CONCEPT_MODEL = 'claude-sonnet-4-5';
const CONCEPT_MAX_TOKENS = 4096;
const REPLACEMENT_MAX_TOKENS = 3072;

/** How many times we'll re-ask after sameness flags anything. 1 keeps latency bounded. */
const MAX_SAMENESS_RETRIES = 1;

export interface ConceptStageArgs {
  count: number;
  brief: Brief;
  product: Product;
  brand: BrandConfig | null;
}

export interface ConceptStageOutput {
  concepts: ConceptStructuredT[];
  prompt_version: string;
  model: string;
  sameness_retries: number;
  /** One entry per sameness round (initial + up to MAX_SAMENESS_RETRIES). */
  sameness_rounds: SamenessRound[];
}

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

/** Generate an initial batch of N concepts. */
async function generateBatch(
  anthropic: Anthropic,
  args: ConceptStageArgs,
): Promise<ConceptStructuredT[]> {
  const userMessage = buildConceptUserMessage({
    brand: args.brand,
    product: {
      name: args.product.name,
      brand: args.product.brand,
      sub_brand: args.product.sub_brand,
      ingredients: args.product.ingredients,
      claims: args.product.claims,
      context: args.product.context,
    },
    brief: {
      objective: args.brief.objective,
      structured: args.brief.structured,
      strictness: args.brief.strictness,
      wild_card: args.brief.wild_card,
    },
    count: args.count,
  });

  const response = await anthropic.messages.create({
    model: CONCEPT_MODEL,
    max_tokens: CONCEPT_MAX_TOKENS,
    system: CONCEPT_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = extractText(response);
  let json: unknown;
  try {
    json = JSON.parse(stripJsonFence(text));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Concept stage: Claude returned non-JSON (${msg}). First 500 chars: ${text.slice(0, 500)}`,
    );
  }

  const parsed = ConceptBatchOutput.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `Concept stage: response did not match batch schema. ${parsed.error.message}`,
    );
  }

  if (parsed.data.concepts.length !== args.count) {
    throw new Error(
      `Concept stage: expected ${args.count} concepts, got ${parsed.data.concepts.length}`,
    );
  }

  return parsed.data.concepts;
}

/**
 * Replace ONLY the flagged indices in-place. Kept concepts are passed to
 * Claude as "do not duplicate these angles" context. Returns a new array
 * with replacements spliced in at their target indices.
 *
 * If Claude returns the wrong count or targets an unflagged index, we log
 * and keep the original batch rather than risk mangling it.
 */
async function regenerateFlaggedIndices(
  anthropic: Anthropic,
  args: ConceptStageArgs,
  current: ConceptStructuredT[],
  flagged: Array<{ index: number; reason: string }>,
): Promise<ConceptStructuredT[]> {
  const flaggedSet = new Set(flagged.map((f) => f.index));
  const keptConcepts = current
    .map((concept, index) => ({ index, concept }))
    .filter(({ index }) => !flaggedSet.has(index));

  const userMessage = buildConceptReplacementUserMessage({
    brand: args.brand,
    product: {
      name: args.product.name,
      brand: args.product.brand,
      sub_brand: args.product.sub_brand,
      ingredients: args.product.ingredients,
      claims: args.product.claims,
      context: args.product.context,
    },
    brief: {
      objective: args.brief.objective,
      structured: args.brief.structured,
      strictness: args.brief.strictness,
      wild_card: args.brief.wild_card,
    },
    keptConcepts,
    slotsToReplace: flagged,
  });

  const response = await anthropic.messages.create({
    model: CONCEPT_MODEL,
    max_tokens: REPLACEMENT_MAX_TOKENS,
    system: CONCEPT_REPLACEMENT_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = extractText(response);
  let json: unknown;
  try {
    json = JSON.parse(stripJsonFence(text));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Concept regen: Claude returned non-JSON (${msg}). First 500 chars: ${text.slice(0, 500)}`,
    );
  }

  const parsed = ConceptReplacementBatch.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `Concept regen: response did not match replacement schema. ${parsed.error.message}`,
    );
  }

  // Validate that Claude only targeted flagged indices, and produced exactly
  // one replacement per flagged slot. If it went off-script, refuse the regen
  // rather than risk overwriting a kept concept.
  const returnedIndices = new Set(parsed.data.replacements.map((r) => r.target_index));
  if (returnedIndices.size !== parsed.data.replacements.length) {
    throw new Error('Concept regen: duplicate target_index in replacements');
  }
  for (const idx of returnedIndices) {
    if (!flaggedSet.has(idx)) {
      throw new Error(
        `Concept regen: Claude targeted index ${idx} which was not flagged`,
      );
    }
  }
  for (const idx of flaggedSet) {
    if (!returnedIndices.has(idx)) {
      throw new Error(
        `Concept regen: missing replacement for flagged index ${idx}`,
      );
    }
  }

  // Splice replacements into the current array.
  const next = [...current];
  for (const { target_index, concept } of parsed.data.replacements) {
    next[target_index] = concept;
  }
  return next;
}

export const conceptStage: Stage<ConceptStageArgs, ConceptStageOutput> = {
  name: 'concept',

  async run(input, trace: StageProgress[]) {
    const started = Date.now();
    trace.push({ stage: 'concept', status: 'started' });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured.');

    const anthropic = new Anthropic({ apiKey });

    // ── Initial generation ────────────────────────────────────────────────
    let concepts: ConceptStructuredT[];
    try {
      concepts = await generateBatch(anthropic, input);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      trace.push({
        stage: 'concept',
        status: 'failed',
        error: msg,
        durationMs: Date.now() - started,
      });
      throw err;
    }

    // ── Sameness loop ─────────────────────────────────────────────────────
    const rounds: SamenessRound[] = [];
    let retries = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const round = await runSamenessChecks(anthropic, concepts);
      rounds.push(round);

      if (round.regenerate.length === 0) break;

      if (retries >= MAX_SAMENESS_RETRIES) {
        console.warn(
          '[concept] sameness retries exhausted; shipping batch with known redundancy at indices:',
          round.regenerate.map((r) => r.index),
        );
        break;
      }

      try {
        concepts = await regenerateFlaggedIndices(
          anthropic,
          input,
          concepts,
          round.regenerate,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(
          '[concept] per-index regeneration failed, keeping original batch:',
          msg,
        );
        break;
      }

      retries += 1;
    }

    const output: ConceptStageOutput = {
      concepts,
      prompt_version: CONCEPT_PROMPT_VERSION,
      model: CONCEPT_MODEL,
      sameness_retries: retries,
      sameness_rounds: rounds,
    };

    trace.push({
      stage: 'concept',
      status: 'completed',
      durationMs: Date.now() - started,
      output: {
        concept_count: concepts.length,
        sameness_retries: retries,
        sameness_rounds: rounds.length,
        sameness_prompt_version: SAMENESS_PROMPT_VERSION,
        model: CONCEPT_MODEL,
      },
    });

    return output;
  },
};

export { ConceptStructured };
