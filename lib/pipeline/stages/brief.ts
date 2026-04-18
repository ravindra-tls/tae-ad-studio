/**
 * Brief stage — Claude call.
 *
 * Produces a structured creative brief from a marketer's freeform objective,
 * conditioned on the brand config and product record. This is stage 1 of 7 in
 * the pipeline (see lib/pipeline/types.ts).
 *
 * The API route (app/api/pipeline/brief) owns persistence to the `briefs`
 * table; this stage file owns only the LLM call + validation. Keeping those
 * responsibilities split means the stage is reusable from a future
 * orchestrator that chains stages without writing every intermediate.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { BrandConfig, Product } from '@/types';
import type { Stage, StageProgress } from '../types';
import {
  BriefStageInput,
  BriefStructured,
  type BriefStructured as BriefStructuredT,
} from '../schemas/brief';
import {
  BRIEF_PROMPT_VERSION,
  BRIEF_SYSTEM_PROMPT,
  buildBriefUserMessage,
} from '../prompts/brief';

/** Model identifier — pinned so eval history is comparable. Bump deliberately. */
const BRIEF_MODEL = 'claude-sonnet-4-20250514';
const BRIEF_MAX_TOKENS = 2048;

export interface BriefStageArgs {
  objective: string;
  strictness: 'off' | 'loose' | 'tight';
  wild_card: boolean;
  source: 'quiz' | 'freeform' | 'imported';
  brand: BrandConfig | null;
  product: Product;
}

export interface BriefStageOutput {
  structured: BriefStructuredT;
  prompt_version: string;
  model: string;
}

/**
 * Strip a ```json ... ``` fence if Claude includes one. We ask for raw JSON
 * in the prompt but models occasionally hedge with a fence anyway.
 */
function stripJsonFence(raw: string): string {
  const trimmed = raw.trim();
  const m = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/);
  return m ? m[1].trim() : trimmed;
}

export const briefStage: Stage<BriefStageArgs, BriefStageOutput> = {
  name: 'brief',

  async run(input, trace: StageProgress[]) {
    const started = Date.now();
    trace.push({ stage: 'brief', status: 'started' });

    // Validate input shape. This is defensive — the API route has already
    // done this, but a stage should not trust its caller when stages get
    // chained by an orchestrator.
    const parsed = BriefStageInput.safeParse({
      objective: input.objective,
      strictness: input.strictness,
      wild_card: input.wild_card,
      source: input.source,
    });
    if (!parsed.success) {
      const err = `Invalid brief input: ${parsed.error.message}`;
      trace.push({
        stage: 'brief',
        status: 'failed',
        error: err,
        durationMs: Date.now() - started,
      });
      throw new Error(err);
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured.');

    const anthropic = new Anthropic({ apiKey });

    const userMessage = buildBriefUserMessage({
      brand: input.brand,
      product: {
        name: input.product.name,
        brand: input.product.brand,
        sub_brand: input.product.sub_brand,
        description: input.product.description,
        ingredients: input.product.ingredients,
        claims: input.product.claims,
        context: input.product.context,
        prompt_modifier: input.product.prompt_modifier,
      },
      objective: parsed.data.objective,
      strictness: parsed.data.strictness,
      wild_card: parsed.data.wild_card,
    });

    let response: Anthropic.Message;
    try {
      response = await anthropic.messages.create({
        model: BRIEF_MODEL,
        max_tokens: BRIEF_MAX_TOKENS,
        system: BRIEF_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      trace.push({
        stage: 'brief',
        status: 'failed',
        error: `Claude call failed: ${msg}`,
        durationMs: Date.now() - started,
      });
      throw err;
    }

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    let json: unknown;
    try {
      json = JSON.parse(stripJsonFence(text));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      trace.push({
        stage: 'brief',
        status: 'failed',
        error: `Non-JSON response from Claude: ${msg}`,
        durationMs: Date.now() - started,
        output: { raw: text.slice(0, 500) },
      });
      throw new Error(`Brief stage: Claude returned non-JSON. First 500 chars: ${text.slice(0, 500)}`);
    }

    const validation = BriefStructured.safeParse(json);
    if (!validation.success) {
      trace.push({
        stage: 'brief',
        status: 'failed',
        error: `Structured output failed schema validation: ${validation.error.message}`,
        durationMs: Date.now() - started,
        output: { raw: json },
      });
      throw new Error(
        `Brief stage: response did not match schema. ${validation.error.message}`,
      );
    }

    const output: BriefStageOutput = {
      structured: validation.data,
      prompt_version: BRIEF_PROMPT_VERSION,
      model: BRIEF_MODEL,
    };

    trace.push({
      stage: 'brief',
      status: 'completed',
      durationMs: Date.now() - started,
      output: { prompt_version: BRIEF_PROMPT_VERSION, model: BRIEF_MODEL },
    });

    return output;
  },
};
