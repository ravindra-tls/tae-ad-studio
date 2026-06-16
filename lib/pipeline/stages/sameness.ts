/**
 * Concept sameness — two parallel implementations.
 *
 * The V1 plan wants sameness detection that runs on concept JSON (never on
 * rendered images). This file ships two methods side-by-side so we can
 * evaluate which one catches the right redundancy in practice:
 *
 *   1. Claude-judged (semantic)  — adversarial reviewer reads the batch and
 *      flags structurally redundant concepts with per-index reasons. Matches
 *      human intuition but costs ~2s + tokens per call.
 *
 *   2. TF-IDF lexical cosine     — classical information retrieval: tokenize
 *      each concept's fields, compute pairwise cosine over the batch's own
 *      TF-IDF vectors, flag pairs above a threshold. Free, fast, deterministic.
 *      Signal is orthogonal to Claude (catches shared vocabulary, misses
 *      paraphrases).
 *
 * The concept stage runs BOTH on each batch. Regen decision is the union of
 * flagged indices (conservative). The response surfaces both verdicts so we
 * can look back at disagreement patterns — "Claude flagged {0} but cosine
 * didn't" is the interesting case.
 *
 * If one method is demonstrably better after evaluation, the other can be
 * dropped without touching schema — callers read `sameness_checks` as an
 * array and already handle multiple entries.
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  SamenessVerdict,
  type ConceptStructured as ConceptStructuredT,
  type SamenessVerdict as SamenessVerdictT,
} from '../schemas/concept';
import {
  SAMENESS_PROMPT_VERSION,
  SAMENESS_SYSTEM_PROMPT,
  buildSamenessUserMessage,
} from '../prompts/concept';

const SAMENESS_MODEL = 'claude-sonnet-4-5';
const SAMENESS_MAX_TOKENS = 1024;

/**
 * Pairwise cosine above this is "too similar" for the lexical check.
 * Calibrated empirically later — 0.55 is a conservative default for short
 * concept docs. Override via env (COSINE_SAMENESS_THRESHOLD).
 */
const COSINE_THRESHOLD = Number(
  process.env.COSINE_SAMENESS_THRESHOLD ?? '0.55',
);

// ─── Types surfaced up to the stage ──────────────────────────────────────────

export interface PairwiseScore {
  i: number;
  j: number;
  score: number;
}

export interface SamenessCheckResult {
  method: 'claude' | 'cosine_tfidf';
  verdict: SamenessVerdictT;
  details: {
    /** Optional prompt/model version info for the Claude method. */
    prompt_version?: string;
    model?: string;
    /** Optional pairwise scores for the cosine method — useful for calibration. */
    pairwise_scores?: PairwiseScore[];
    threshold?: number;
  };
}

/** The outcome of running all sameness methods on a single batch. */
export interface SamenessRound {
  checks: SamenessCheckResult[];
  /**
   * Union of indices flagged by any method. If non-empty the stage will
   * regenerate those specific indices. Each entry carries a merged reason
   * string listing which methods flagged it.
   */
  regenerate: Array<{ index: number; reason: string }>;
}

// ─── Claude-judged ───────────────────────────────────────────────────────────

function stripJsonFence(raw: string): string {
  const trimmed = raw.trim();
  const m = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/);
  return m ? m[1].trim() : trimmed;
}

export async function judgeSamenessByClaude(
  anthropic: Anthropic,
  concepts: ConceptStructuredT[],
): Promise<SamenessCheckResult> {
  const details = {
    prompt_version: SAMENESS_PROMPT_VERSION,
    model: SAMENESS_MODEL,
  };

  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create({
      model: SAMENESS_MODEL,
      max_tokens: SAMENESS_MAX_TOKENS,
      system: SAMENESS_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildSamenessUserMessage(concepts) }],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      '[sameness.claude] API call failed, defaulting to pass:',
      msg,
    );
    return { method: 'claude', verdict: { status: 'pass' }, details };
  }

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  let json: unknown;
  try {
    json = JSON.parse(stripJsonFence(text));
  } catch {
    console.warn(
      '[sameness.claude] non-JSON verdict, defaulting to pass:',
      text.slice(0, 200),
    );
    return { method: 'claude', verdict: { status: 'pass' }, details };
  }

  const parsed = SamenessVerdict.safeParse(json);
  if (!parsed.success) {
    console.warn(
      '[sameness.claude] verdict failed schema, defaulting to pass:',
      parsed.error.message,
    );
    return { method: 'claude', verdict: { status: 'pass' }, details };
  }

  return { method: 'claude', verdict: parsed.data, details };
}

// ─── TF-IDF cosine ───────────────────────────────────────────────────────────

/** Simple English stopword list — enough to avoid boilerplate skewing scores. */
const STOPWORDS = new Set([
  'the','a','an','and','or','but','if','then','else','of','in','on','for','to','is','are','was','were','be','been','being','that','this','those','these','it','its','as','at','by','with','from','into','about','over','under','up','down','out','off','so','just','more','most','less','least','not','no','do','does','did','can','could','should','would','will','shall','may','might','must','have','has','had','you','your','yours','we','our','ours','they','their','theirs','he','she','him','her','his','hers','them','us','who','whom','which','what','when','where','why','how','than','also','very','too','some','any','all','each','every','one','two','three','four','five',
]);

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function conceptToDocument(c: ConceptStructuredT): string {
  return [
    c.title,
    c.hook_archetype,
    c.description,
    c.visual_direction,
    c.copy_direction,
    ...(c.leaning_on.pains ?? []),
    ...(c.leaning_on.proof_points ?? []),
  ].join(' ');
}

function termFreq(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  return tf;
}

function computeIdf(docs: Map<string, number>[]): Map<string, number> {
  const n = docs.length;
  const df = new Map<string, number>();
  for (const d of docs) {
    for (const t of d.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const idf = new Map<string, number>();
  for (const [t, dfi] of df) {
    // Smoothed IDF: log((N+1)/(df+1)) + 1, always positive.
    idf.set(t, Math.log((n + 1) / (dfi + 1)) + 1);
  }
  return idf;
}

function tfidfVector(
  tf: Map<string, number>,
  idf: Map<string, number>,
): Map<string, number> {
  const v = new Map<string, number>();
  for (const [t, f] of tf) v.set(t, f * (idf.get(t) ?? 0));
  return v;
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const [t, va] of a) {
    const vb = b.get(t) ?? 0;
    dot += va * vb;
    na += va * va;
  }
  for (const [, vb] of b) nb += vb * vb;
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function judgeSamenessByCosine(
  concepts: ConceptStructuredT[],
  threshold: number = COSINE_THRESHOLD,
): SamenessCheckResult {
  const tfs = concepts.map((c) => termFreq(tokenize(conceptToDocument(c))));
  const idf = computeIdf(tfs);
  const vecs = tfs.map((tf) => tfidfVector(tf, idf));

  const pairwise: PairwiseScore[] = [];
  const flaggedLater = new Map<number, Array<{ other: number; score: number }>>();

  for (let i = 0; i < vecs.length; i++) {
    for (let j = i + 1; j < vecs.length; j++) {
      const score = cosine(vecs[i], vecs[j]);
      pairwise.push({ i, j, score: Number(score.toFixed(4)) });
      if (score >= threshold) {
        // Convention: flag the LATER of the two so earlier concepts are kept.
        const bucket = flaggedLater.get(j) ?? [];
        bucket.push({ other: i, score });
        flaggedLater.set(j, bucket);
      }
    }
  }

  const details = {
    pairwise_scores: pairwise.sort((a, b) => b.score - a.score),
    threshold,
  };

  if (flaggedLater.size === 0) {
    return { method: 'cosine_tfidf', verdict: { status: 'pass' }, details };
  }

  const items = [...flaggedLater.entries()].map(([index, matches]) => ({
    index,
    reason: `TF-IDF cosine >= ${threshold} vs. ${matches
      .map((m) => `#${m.other} (${m.score.toFixed(3)})`)
      .join(', ')}`,
  }));

  return {
    method: 'cosine_tfidf',
    verdict: { status: 'regenerate', items },
    details,
  };
}

// ─── Combined runner ─────────────────────────────────────────────────────────

/**
 * Run every sameness method on a batch and return the union of flagged
 * indices. Claude runs in parallel with cosine since cosine is synchronous —
 * the cost of the second method is effectively zero.
 */
export async function runSamenessChecks(
  anthropic: Anthropic,
  concepts: ConceptStructuredT[],
): Promise<SamenessRound> {
  const cosineCheck = judgeSamenessByCosine(concepts);
  const claudeCheck = await judgeSamenessByClaude(anthropic, concepts);

  // Merge per-index reasons so the regen prompt can mention both signals.
  const merged = new Map<number, string[]>();
  for (const check of [claudeCheck, cosineCheck]) {
    if (check.verdict.status !== 'regenerate') continue;
    for (const item of check.verdict.items) {
      const arr = merged.get(item.index) ?? [];
      arr.push(`[${check.method}] ${item.reason}`);
      merged.set(item.index, arr);
    }
  }

  const regenerate = [...merged.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, reasons]) => ({ index, reason: reasons.join(' | ') }));

  return {
    checks: [claudeCheck, cosineCheck],
    regenerate,
  };
}
