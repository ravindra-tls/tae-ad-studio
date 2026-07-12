/**
 * POST /api/forge/insights
 *
 * Mine deep human-tension insights for a persona (Opus). Cached per
 * persona(::pain) in state.insightsCache. A CAS'd `pending` marker before the
 * Opus call keeps two tabs from double-mining the same key.
 *
 * Body:     { sessionId, persona?, pain?, force? }
 * Response: { insights, cached, session }
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireForgeSession, jsonError, forgeErrorResponse } from '@/lib/forge/route-helpers';
import { getDeckForSession } from '@/lib/forge/deck';
import { getForgeState, mutateForgeState, sessionView, MutationAbortError } from '@/lib/forge/state';
import { setInsightsCache } from '@/lib/forge/state-ops';
import { mineInsights } from '@/lib/forge/insights';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const PENDING_TTL_MS = 120_000;

const RequestBody = z.object({
  sessionId: z.uuid(),
  persona: z.string().max(200).optional(),
  pain: z.string().max(200).optional(),
  force: z.boolean().optional(),
});

export async function POST(request: Request) {
  let body: z.infer<typeof RequestBody>;
  try {
    body = RequestBody.parse(await request.json());
  } catch (err) {
    return jsonError(400, err instanceof Error ? err.message : 'Invalid request body');
  }

  const ctx = await requireForgeSession(body.sessionId);
  if (!ctx.ok) return ctx.response;
  const { service, session } = ctx;

  try {
    const snapshot = await getForgeState(service, session.id);
    if (!snapshot) return jsonError(404, 'Session state not found');

    const pins = snapshot.state.pins || {};
    const personaId = body.persona || (typeof pins.persona === 'string' ? pins.persona : '');
    if (!personaId) return jsonError(400, 'Pick a persona first — insights are mined for one person.');
    const painId = body.pain || (typeof pins.pain === 'string' ? pins.pain : '') || '';
    const key = painId ? `${personaId}::${painId}` : personaId;

    // Cache hit (unless forced; a stale pending marker does not count as a hit).
    const cachedEntry = snapshot.state.insightsCache?.[key];
    if (!body.force && cachedEntry && !cachedEntry.pending) {
      return NextResponse.json({
        insights: cachedEntry.insights,
        cached: true,
        session: sessionView(snapshot.state, snapshot.rev, session),
      });
    }

    // ── CAS a pending marker (idempotency across tabs) ────────────────────
    try {
      await mutateForgeState(service, session.id, (draft) => {
        const entry = draft.insightsCache?.[key];
        if (entry?.pending && Date.now() - Date.parse(entry.at) < PENDING_TTL_MS) {
          throw new MutationAbortError('Insight mining for this persona is already in progress.');
        }
        draft.insightsCache[key] = { at: new Date().toISOString(), insights: entry?.insights || [], pending: true };
      });
    } catch (err) {
      if (err instanceof MutationAbortError) return jsonError(409, err.message);
      throw err;
    }

    // ── Opus mining (outside the CAS window) ──────────────────────────────
    const deck = (await getDeckForSession(service, session.product_id)).deck;
    let insights;
    try {
      insights = await mineInsights({ deck, personaId, painId: painId || undefined });
    } catch (err) {
      // Clear the pending marker so the next attempt is not locked out.
      await mutateForgeState(service, session.id, (draft) => {
        const entry = draft.insightsCache?.[key];
        if (entry?.pending) {
          if (entry.insights.length) delete entry.pending;
          else delete draft.insightsCache[key];
        }
      }).catch(() => { /* best-effort cleanup */ });
      throw err;
    }

    const { state, rev } = await mutateForgeState(service, session.id, (draft) => {
      setInsightsCache(draft, key, insights);
    });

    return NextResponse.json({
      insights,
      cached: false,
      session: sessionView(state, rev, session),
    });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
