/**
 * Copy stage — Claude call.
 *
 * Stage 3 of 7. Given a selected concept + brief + brand + product, produces
 * structured ad copy: headline + N alternates + subhead + body + CTA +
 * optional disclosure. Runs per-concept — the route fans out over the
 * marketer's selected concepts (1 or 2 at checkpoint 2).
 *
 * The API route (app/api/pipeline/copy) owns persistence to copy_blocks;
 * this stage file owns only the LLM call + validation.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { BrandConfig, Brief, Concept, Product } from '@/types';
import type { Stage, StageProgress } from '../types';
import {
  CopyStructured,
  type CopyStructured as CopyStructuredT,
} from '../schemas/copy';
import {
  COPY_PROMPT_VERSION,
  COPY_SYSTEM_PROMPT,
  buildCopyUserMessage,
} from '../prompts/copy';

const COPY_MODEL = 'claude-sonnet-4-20250514';
const COPY_MAX_TOKENS = 2048;

export interface CopyStageArgs {
  brief: Brief;
  concept: Concept;
  product: Product;
  brand: BrandConfig | null;
  /** How many alternate headlines to ask for (on top of the primary). */
  alternates?: number;
}

export interface CopyStageOutput {
  structured: CopyStructuredT;
  prompt_version: string;
  model: string;
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

export const copyStage: Stage<CopyStageArgs, CopyStageOutput> = {
  name: 'copy',

  async run(input, trace: StageProgress[]) {
    const started = Date.now();
    trace.push({ stage: 'copy', status: 'started' });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured.');

    const anthropic = new Anthropic({ apiKey });

    // Pull the structured concept blob out of the persisted row. The route
    // should hand us a full concept, but we defend against it being partial.
    const conceptStructured = input.concept.structured;
    if (!conceptStructured || typeof conceptStructured !== 'object') {
      const err = 'Copy stage: concept.structured is missing or not an object.';
      trace.push({
        stage: 'copy',
        status: 'failed',
        error: err,
        durationMs: Date.now() - started,
      });
      throw new Error(err);
    }

    const alternates = input.alternates ?? 3;

    const userMessage = buildCopyUserMessage({
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
      alternates,
    });

    let response: Anthropic.Message;
    try {
      response = await anthropic.messages.create({
        model: COPY_MODEL,
        max_tokens: COPY_MAX_TOKENS,
        system: COPY_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      trace.push({
        stage: 'copy',
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
        stage: 'copy',
        status: 'failed',
        error: `Non-JSON response from Claude: ${msg}`,
        durationMs: Date.now() - started,
        output: { raw: text.slice(0, 500) },
      });
      throw new Error(
        `Copy stage: Claude returned non-JSON. First 500 chars: ${text.slice(0, 500)}`,
      );
    }

    const validation = CopyStructured.safeParse(json);
    if (!validation.success) {
      trace.push({
        stage: 'copy',
        status: 'failed',
        error: `Structured output failed schema validation: ${validation.error.message}`,
        durationMs: Date.now() - started,
        output: { raw: json },
      });
      throw new Error(
        `Copy stage: response did not match schema. ${validation.error.message}`,
      );
    }

    // Soft-check alternate count — we asked for N, but we don't fail the
    // stage if Claude returned N-1 or N+1. Log it so we can catch drift.
    const returnedAlts = validation.data.headline_alternates.length;
    if (returnedAlts !== alternates) {
      console.warn(
        `[copy] asked for ${alternates} alternates, got ${returnedAlts}. Not fatal.`,
      );
    }

    const output: CopyStageOutput = {
      structured: validation.data,
      prompt_version: COPY_PROMPT_VERSION,
      model: COPY_MODEL,
    };

    trace.push({
      stage: 'copy',
      status: 'completed',
      durationMs: Date.now() - started,
      output: {
        prompt_version: COPY_PROMPT_VERSION,
        model: COPY_MODEL,
        alternate_count: returnedAlts,
      },
    });

    return output;
  },
};
