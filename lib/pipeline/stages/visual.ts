/**
 * Visual stage — Claude call.
 *
 * Stage 4 of 7. Given a concept (+ optional copy block), produces a
 * structured visual spec AND the assembled prompt string that goes to the
 * image provider. The API route (app/api/pipeline/visual) owns persistence.
 *
 * One Claude call handles both the spec and the prompt so they cohere —
 * the prompt describes exactly what the spec describes.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { BrandConfig, Brief, Concept, Product } from '@/types';
import type { Stage, StageProgress } from '../types';
import {
  type AspectRatio,
  VisualStructured,
  type VisualStructured as VisualStructuredT,
} from '../schemas/visual';
import {
  VISUAL_PROMPT_VERSION,
  VISUAL_SYSTEM_PROMPT,
  buildVisualUserMessage,
} from '../prompts/visual';

const VISUAL_MODEL = 'claude-sonnet-4-20250514';
const VISUAL_MAX_TOKENS = 2048;

export interface VisualStageArgs {
  brief: Brief;
  concept: Concept;
  /**
   * Optional copy block to anchor text zones. If null, text_zones will be
   * empty — callers typically pair copy + visual at checkpoint-3 time.
   */
  copy: {
    structured: Record<string, unknown>;
  } | null;
  product: Product;
  brand: BrandConfig | null;
  aspect_ratio: AspectRatio;
}

export interface VisualStageOutput {
  structured: VisualStructuredT;
  prompt_text: string;
  aspect_ratio: AspectRatio;
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

export const visualStage: Stage<VisualStageArgs, VisualStageOutput> = {
  name: 'visual',

  async run(input, trace: StageProgress[]) {
    const started = Date.now();
    trace.push({ stage: 'visual', status: 'started' });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured.');

    const anthropic = new Anthropic({ apiKey });

    const conceptStructured = input.concept.structured;
    if (!conceptStructured || typeof conceptStructured !== 'object') {
      const err = 'Visual stage: concept.structured is missing or not an object.';
      trace.push({
        stage: 'visual',
        status: 'failed',
        error: err,
        durationMs: Date.now() - started,
      });
      throw new Error(err);
    }

    const userMessage = buildVisualUserMessage({
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
      copy: input.copy?.structured ?? null,
      aspect_ratio: input.aspect_ratio,
    });

    let response: Anthropic.Message;
    try {
      response = await anthropic.messages.create({
        model: VISUAL_MODEL,
        max_tokens: VISUAL_MAX_TOKENS,
        system: VISUAL_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      trace.push({
        stage: 'visual',
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
        stage: 'visual',
        status: 'failed',
        error: `Non-JSON response from Claude: ${msg}`,
        durationMs: Date.now() - started,
        output: { raw: text.slice(0, 500) },
      });
      throw new Error(
        `Visual stage: Claude returned non-JSON. First 500 chars: ${text.slice(0, 500)}`,
      );
    }

    // Source-of-truth override: the caller told us which aspect_ratio to use,
    // and it's already persisted on the visual_specs row separately. Claude's
    // echoed value is purely for traceability inside `structured`, and we've
    // seen it drift (return "1080x1350", a different enum value, or omit the
    // field entirely — which hard-failed schema validation). Pre-inject the
    // caller's value so the field can never be the reason we fail.
    if (json && typeof json === 'object' && !Array.isArray(json)) {
      const reported = (json as Record<string, unknown>).aspect_ratio;
      if (reported !== input.aspect_ratio) {
        console.warn(
          `[visual] asked for aspect_ratio=${input.aspect_ratio}, Claude returned ${JSON.stringify(reported)}. Overriding to caller's value.`,
        );
      }
      (json as Record<string, unknown>).aspect_ratio = input.aspect_ratio;
    }

    const validation = VisualStructured.safeParse(json);
    if (!validation.success) {
      trace.push({
        stage: 'visual',
        status: 'failed',
        error: `Structured output failed schema validation: ${validation.error.message}`,
        durationMs: Date.now() - started,
        output: { raw: json },
      });
      throw new Error(
        `Visual stage: response did not match schema. ${validation.error.message}`,
      );
    }

    const output: VisualStageOutput = {
      structured: validation.data,
      prompt_text: validation.data.prompt_text,
      aspect_ratio: input.aspect_ratio,
      prompt_version: VISUAL_PROMPT_VERSION,
      model: VISUAL_MODEL,
    };

    trace.push({
      stage: 'visual',
      status: 'completed',
      durationMs: Date.now() - started,
      output: {
        prompt_version: VISUAL_PROMPT_VERSION,
        model: VISUAL_MODEL,
        aspect_ratio: input.aspect_ratio,
        prompt_length: validation.data.prompt_text.length,
        text_zone_count: validation.data.text_zones.length,
      },
    });

    return output;
  },
};
