/**
 * Concept stage — Claude call with sameness detection.
 *
 * Stage 2 of 7. Given an approved brief, produces N (3-5) candidate creative
 * directions. Runs a sameness pass on the concept JSON; if any are judged
 * structurally redundant, regenerates the flagged ones (max 1 retry) before
 * returning.
 *
 * The API route (app/api/pipeline/concept) owns persistence; this file owns
 * only the LLM calls + validation + the sameness loop.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { BrandConfig, Brief, Product } from '@/types';
import type { Stage, StageProgress } from '../types';
import {
  ConceptBatchOutput,
  ConceptStructured,
  SamenessVerdict,
  type ConceptStructured as ConceptStructuredT,
  type SamenessVerdict as SamenessVerdictT,
} from '../schemas/concept';
import {
  CONCEPT_PROMPT_VERSION,
  CONCEPT_SYSTEM_PROMPT,
  SAMENESS_PROMPT_VERSION,
  SAMENESS_SYSTEM_PROMPT,
  buildConceptUserMessage,
  buildSamenessUserMessage,
} from '../prompts/concept';

const CONCEPT_MODEL = 'claude-sonnet-4-20250514';
const CONCEPT_MAX_TOKENS = 4096;
const SAMENESS_MODEL = 'claude-sonnet-4-20250514';
const SAMENESS_MAX_TOKENS = 1024;

/** How many times we'll re-ask after a sameness fail. 1 keeps latency bounded. */
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
  sameness_verdicts: SamenessVerdictT[];
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

/** Run the generation prompt once; returns N parsed concepts. */
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

/** Ask Claude whether any concepts in the batch are structurally redundant. */
async function judgeSameness(
  anthropic: Anthropic,
  concepts: ConceptStructuredT[],
): Promise<SamenessVerdictT> {
  const response = await anthropic.messages.create({
    model: SAMENESS_MODEL,
    max_tokens: SAMENESS_MAX_TOKENS,
    system: SAMENESS_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildSamenessUserMessage(concepts) }],
  });

  const text = extractText(response);
  let json: unknown;
  try {
    json = JSON.parse(stripJsonFence(text));
  } catch (err) {
    // A malformed sameness response shouldn't fail the whole stage —
    // treat it as "pass" and move on. Log so we notice pattern drift.
    console.warn(
      '[concept] sameness judge returned non-JSON, defaulting to pass:',
      text.slice(0, 200),
    );
    return { status: 'pass' };
  }

  const parsed = SamenessVerdict.safeParse(json);
  if (!parsed.success) {
    console.warn(
      '[concept] sameness verdict failed schema, defaulting to pass:',
      parsed.error.message,
    );
    return { status: 'pass' };
  }

  return parsed.data;
}

/**
 * Regenerate specific indices in a batch. We ask Claude to produce fresh
 * directions for just those slots, given the full batch as "avoid these
 * patterns" context and the sameness reasons.
 */
async function regenerateFlagged(
  anthropic: Anthropic,
  args: ConceptStageArgs,
  current: ConceptStructuredT[],
  verdict: Extract<SamenessVerdictT, { status: 'regenerate' }>,
): Promise<ConceptStructuredT[]> {
  // Build a "keep these, replace these" prompt. The simplest implementation:
  // regenerate the whole batch with the rejected angles listed as anti-patterns.
  // A per-index partial regen would save tokens but complicates schema; we
  // can optimize later if cost shows up.
  const rejectedSummaries = verdict.items
    .map(
      (it) => `  - Concept ${it.index} ("${current[it.index]?.title ?? ''}", archetype=${current[it.index]?.hook_archetype ?? ''}): ${it.reason}`,
    )
    .join('\n');

  const augmented = buildConceptUserMessage({
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

  const avoidBlock = [
    '',
    '## Anti-patterns from previous attempt (DO NOT repeat these angles)',
    rejectedSummaries,
    '',
    'Regenerate the full batch. Each concept must use a structurally different angle from the ones above, and all N archetypes must be distinct from each other.',
  ].join('\n');

  const response = await anthropic.messages.create({
    model: CONCEPT_MODEL,
    max_tokens: CONCEPT_MAX_TOKENS,
    system: CONCEPT_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: augmented + avoidBlock }],
  });

  const text = extractText(response);
  let json: unknown;
  try {
    json = JSON.parse(stripJsonFence(text));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Concept stage regen: Claude returned non-JSON (${msg}). First 500 chars: ${text.slice(0, 500)}`,
    );
  }

  const parsed = ConceptBatchOutput.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `Concept stage regen: response did not match batch schema. ${parsed.error.message}`,
    );
  }

  return parsed.data.concepts;
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
    const verdicts: SamenessVerdictT[] = [];
    let retries = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const verdict = await judgeSameness(anthropic, concepts);
      verdicts.push(verdict);

      if (verdict.status === 'pass') break;

      if (retries >= MAX_SAMENESS_RETRIES) {
        // We've hit the ceiling. Ship what we have — the UI can still surface
        // the verdict so the marketer knows some concepts are redundant.
        console.warn(
          `[concept] sameness retries exhausted; shipping batch with known redundancy:`,
          verdict.items,
        );
        break;
      }

      try {
        concepts = await regenerateFlagged(anthropic, input, concepts, verdict);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Regen failure: keep the original batch, log, exit loop.
        console.warn('[concept] regeneration failed, keeping original batch:', msg);
        break;
      }

      retries += 1;
    }

    const output: ConceptStageOutput = {
      concepts,
      prompt_version: CONCEPT_PROMPT_VERSION,
      model: CONCEPT_MODEL,
      sameness_retries: retries,
      sameness_verdicts: verdicts,
    };

    trace.push({
      stage: 'concept',
      status: 'completed',
      durationMs: Date.now() - started,
      output: {
        concept_count: concepts.length,
        sameness_retries: retries,
        sameness_prompt_version: SAMENESS_PROMPT_VERSION,
        model: CONCEPT_MODEL,
      },
    });

    return output;
  },
};

// Re-export so callers can narrow the discriminated union without importing
// from the schemas file.
export { ConceptStructured };
