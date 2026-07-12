/**
 * Concept scoring + quality gate. Ported verbatim from Concept Forge lib/judge.js.
 *
 * NOTE: the judge deliberately runs on MODELS.generator (Haiku, temp 0) for
 * speed — the rubric is explicit enough to apply consistently, and the hard
 * compliance/banned-language gate is unchanged. Swap to MODELS.sonnet here if
 * you want maximum scoring rigor.
 */
import { callClaude, extractToolInput, type TextBlockParam } from './anthropic';
import { MODELS, TEMPS } from './models';
import { JUDGE_TOOL } from './schema';
import { deckToPromptBlock } from './deck';
import { JUDGE_RUBRIC, QUALITY_BAR } from './knowledge/prompt-fragments';
import type { CardScores, ForgeCard, ForgeDeck } from './types';

export const PASS_THRESHOLD = 70;

function buildJudgeSystem(deck: ForgeDeck): TextBlockParam[] {
  const text = [
    'You are a ruthless creative director and compliance reviewer scoring ad concepts for one brand.',
    '',
    QUALITY_BAR,
    '',
    JUDGE_RUBRIC,
    '',
    '=== BRAND GROUNDING (the only facts that count as "product truth") ===',
    deckToPromptBlock(deck),
  ].join('\n');
  return [{ type: 'text', text, cache_control: { type: 'ephemeral' } }];
}

function cardForJudging(card: ForgeCard, i: number): string {
  const parts = [
    `#${i}`,
    `persona=${card.dna && card.dna.persona} pain=${card.dna && card.dna.pain} stage=${card.dna && card.dna.awarenessStage} mechanic=${card.dna && card.dna.mechanic} format=${card.dna && card.dna.format}`,
    `emotionalInsight: ${card.emotionalInsight || '(none)'}`,
    `messagingAngle: ${card.messagingAngle}`,
    `tagline: ${card.tagline}`,
  ];
  if (card.hookSpoken) parts.push(`hookSpoken: ${card.hookSpoken}`);
  if (card.hookTextOverlay) parts.push(`hookTextOverlay: ${card.hookTextOverlay}`);
  if (card.primaryText) parts.push(`primaryText: ${card.primaryText}`);
  parts.push(`concept: ${card.concept}`);
  return parts.join('\n');
}

interface Verdict {
  index: number | string;
  productTruth: number;
  emotionalTruth: number;
  specificity: number;
  concreteness: number;
  scrollStop: number;
  brandVoice: number;
  overall: number;
  bannedLanguageViolation: boolean;
  note?: string;
}

interface EmitVerdictsOutput {
  verdicts?: Verdict[];
}

/** Score a batch of cards in one call; attach `.scores` and `.gatePass` to each. */
export async function scoreCards({
  deck,
  cards,
}: {
  deck: ForgeDeck;
  cards: ForgeCard[];
}): Promise<ForgeCard[]> {
  if (!cards || !cards.length) return [];
  const userMsg = [
    `Score these ${cards.length} concepts. Return exactly one verdict per concept, matching by index.`,
    '',
    cards.map(cardForJudging).join('\n\n'),
    '',
    'Return all verdicts via the emit_verdicts tool.',
  ].join('\n');

  const response = await callClaude({
    // Gate runs on the fast model for speed — preserve this indirection.
    model: MODELS.generator,
    maxTokens: 2048,
    temperature: TEMPS.judge,
    system: buildJudgeSystem(deck),
    messages: [{ role: 'user', content: userMsg }],
    tools: [JUDGE_TOOL],
    toolChoice: { type: 'tool', name: 'emit_verdicts' },
  });
  const verdicts = extractToolInput<EmitVerdictsOutput>(response, 'emit_verdicts').verdicts || [];
  const byIndex = new Map<number | string, Verdict>(verdicts.map((v) => [v.index, v]));

  return cards.map((card, i) => {
    const v = byIndex.get(i) || byIndex.get(String(i));
    if (!v) {
      return { ...card, scores: null, gatePass: false, gateReason: 'no verdict returned' };
    }
    const scores: CardScores = {
      productTruth: v.productTruth,
      emotionalTruth: v.emotionalTruth,
      specificity: v.specificity,
      concreteness: v.concreteness,
      scrollStop: v.scrollStop,
      brandVoice: v.brandVoice,
      overall: v.overall,
      bannedLanguageViolation: !!v.bannedLanguageViolation,
      note: v.note,
    };
    const gatePass = !scores.bannedLanguageViolation && Number(scores.overall) >= PASS_THRESHOLD;
    return {
      ...card,
      scores,
      gatePass,
      gateReason: scores.bannedLanguageViolation ? 'banned language / compliance' : (gatePass ? 'pass' : 'below bar'),
    };
  });
}
