/**
 * Generate → judge → gate → refill loop. Only cards that clear the quality bar
 * are ever returned, so the player never sees weak concepts. Bounded rounds keep
 * cost predictable. Ported verbatim from Concept Forge lib/engine.js.
 */
import { generateCards, breedCards, buildDiversityPlan, chunkPlan, generateForChunk } from './generator';
import { scoreCards } from './judge';
import type { ForgeCard, ForgeDeck, ForgeLoadout } from './types';

export interface DealStats {
  generated: number;
  passed: number;
  rounds: number;
}

export interface DealResult {
  cards: ForgeCard[];
  stats: DealStats;
}

async function fillToTarget(
  genFn: (want: number) => Promise<ForgeCard[]>,
  deck: ForgeDeck,
  target: number,
): Promise<DealResult> {
  // Single round: generation is parallel (fast), so over-generate ~2× the target
  // in one shot, judge once, and return the passers. A 2nd round only fires if the
  // whole round errored out — this halves wall-clock vs a 2-round loop.
  const over = Math.min(target * 2 + 1, 12);
  const passing: ForgeCard[] = [];
  const seenIds = new Set<string>();
  let generated = 0;
  let rounds = 0;

  async function round(want: number): Promise<void> {
    rounds += 1;
    const raw = await genFn(want);
    generated += raw.length;
    if (!raw.length) return;
    const scored = await scoreCards({ deck, cards: raw });
    for (const card of scored) {
      if (card.gatePass && !seenIds.has(card.id)) { seenIds.add(card.id); passing.push(card); }
    }
  }

  try {
    await round(over);
  } catch (err) {
    console.error('[forge] generation round failed:', err instanceof Error ? err.message : err);
  }
  // Only retry if we got NOTHING (a fully failed round) — never just to top up.
  if (passing.length === 0) {
    try { await round(over); } catch (err) { console.error('[forge] retry round failed:', err instanceof Error ? err.message : err); }
  }

  passing.sort((a, b) => (b.scores?.overall || 0) - (a.scores?.overall || 0));
  return {
    cards: passing.slice(0, target),
    stats: { generated, passed: passing.length, rounds },
  };
}

/**
 * Streaming deal: generate + judge each plan chunk INDEPENDENTLY and in parallel,
 * calling onCard(card) for every card that clears the gate the moment its chunk is
 * judged — so cards appear on the board progressively instead of all at once.
 * Per-chunk failures are tolerated (logged, chunk skipped).
 */
export async function dealStream({
  deck,
  loadout,
  onCard,
}: {
  deck: ForgeDeck;
  loadout: ForgeLoadout;
  onCard: (card: ForgeCard) => void;
}): Promise<DealResult> {
  const target = Math.min(Math.max(Number(loadout.count) || 4, 1), 8);
  const over = Math.min(target * 2 + 1, 12);
  const chunks = chunkPlan(buildDiversityPlan({ ...loadout, medium: 'Static' }, over));
  let generated = 0;
  const passed: ForgeCard[] = [];
  await Promise.all(chunks.map(async (chunk) => {
    let raw: ForgeCard[] = [];
    try { raw = await generateForChunk({ deck, loadout, chunk }); }
    catch (e) { console.error('[forge] gen chunk failed:', e instanceof Error ? e.message : e); return; }
    generated += raw.length;
    if (!raw.length) return;
    let scored: ForgeCard[] = [];
    try { scored = await scoreCards({ deck, cards: raw }); }
    catch (e) { console.error('[forge] judge chunk failed:', e instanceof Error ? e.message : e); return; }
    for (const card of scored) {
      if (card.gatePass) { passed.push(card); try { onCard(card); } catch { /* stream write best-effort */ } }
    }
  }));
  passed.sort((a, b) => (b.scores?.overall || 0) - (a.scores?.overall || 0));
  return { cards: passed, stats: { generated, passed: passed.length, rounds: 1 } };
}

export async function dealHand({
  deck,
  loadout,
}: {
  deck: ForgeDeck;
  loadout: ForgeLoadout;
}): Promise<DealResult> {
  const target = Math.min(Math.max(Number(loadout.count) || 4, 1), 8);
  return fillToTarget(
    (want) => generateCards({ deck, loadout: { ...loadout, count: want } }),
    deck,
    target,
  );
}

export async function breedHand({
  deck,
  parents,
  loadout,
  suppressed,
}: {
  deck: ForgeDeck;
  parents: ForgeCard[];
  loadout: ForgeLoadout;
  suppressed?: string[];
}): Promise<DealResult> {
  const target = Math.min(Math.max(Number(loadout.count) || 4, 1), 8);
  return fillToTarget(
    (want) => breedCards({ deck, parents, loadout: { ...loadout, count: want }, suppressed }),
    deck,
    target,
  );
}
