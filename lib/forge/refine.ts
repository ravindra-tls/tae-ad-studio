/**
 * Inline-comment refinement of ONE board concept (select-text → comment →
 * regenerate). Ported verbatim from Concept Forge lib/refine.js — Sonnet.
 */
import { callClaude, extractToolInput } from './anthropic';
import { MODELS } from './models';
import { REFINE_TOOL } from './schema';
import { buildSystemBlocks } from './generator';
import { taxonomies } from './knowledge';
import type { ForgeCard, ForgeDeck, ForgePins } from './types';

export interface RefineComment {
  quote: string;
  comment: string;
}

function compactCard(card: ForgeCard) {
  return {
    dna: card.dna,
    emotionalInsight: card.emotionalInsight,
    messagingAngle: card.messagingAngle,
    concept: card.concept,
    tagline: card.tagline,
    visualIdea: card.visualIdea,
    hookSpoken: card.hookSpoken,
    hookVisual: card.hookVisual,
    hookTextOverlay: card.hookTextOverlay,
    primaryText: card.primaryText,
    cta: card.cta,
  };
}

interface EmitRefinedOutput {
  card: Omit<ForgeCard, 'id'>;
}

/**
 * Revise ONE concept from inline comments the strategist left on specific text
 * (plan-mode / design-annotation style). Preserves the card id so it replaces
 * the original on the board.
 */
export async function refineCard({
  deck,
  card,
  comments,
  pins,
}: {
  deck: ForgeDeck;
  card: ForgeCard;
  comments: RefineComment[];
  pins?: ForgePins;
}): Promise<ForgeCard> {
  const system = buildSystemBlocks(deck);
  const commentLines = (comments || [])
    .map((c, i) => `${i + 1}. On the text "${c.quote}" → ${c.comment}`)
    .join('\n');

  // Keep honoring the active chain: constraints + CTA (unless a comment overrides them).
  const activeLines: string[] = [];
  const cons = ((pins && pins.constraints) || [])
    .map((id) => taxonomies.constraintCards.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  cons.forEach((c) => activeLines.push(`- Constraint still applies: ${c.instruction}`));
  if (pins && pins.cta) activeLines.push(`- Keep driving toward the CTA "${pins.cta}" (in the cta field).`);

  const userMsg = [
    'Revise ONE existing ad concept using the strategist\'s inline comments.',
    'Address EVERY comment precisely, relative to the exact text it targets. Keep everything that was NOT commented on intact — do not restyle the whole thing. Keep the same dna unless a comment asks to change it. Stay grounded and compliant.',
    '',
    'CURRENT CONCEPT:',
    JSON.stringify(compactCard(card), null, 2),
    '',
    'INLINE COMMENTS:',
    commentLines || '(none — just tighten it)',
    activeLines.length ? '\nSTILL IN EFFECT (unless a comment overrides):\n' + activeLines.join('\n') : '',
    '',
    'Return the fully revised concept via the emit_refined tool. Always include a tagline and a concrete visualIdea.',
  ].filter(Boolean).join('\n');

  const response = await callClaude({
    model: MODELS.sonnet,
    maxTokens: 2048,
    system,
    messages: [{ role: 'user', content: userMsg }],
    tools: [REFINE_TOOL],
    toolChoice: { type: 'tool', name: 'emit_refined' },
  });
  const out = extractToolInput<EmitRefinedOutput>(response, 'emit_refined');
  return { ...out.card, id: card.id }; // preserve id → replaces on the board
}
