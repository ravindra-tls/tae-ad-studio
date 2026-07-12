/**
 * GET /api/forge/session/[id]
 *
 * Refetch/recovery: full client hydration payload for an existing forge
 * session (replaces Concept Forge's recreate-on-restart).
 *
 * Response: { session (sessionView incl. rev), deck (trimmed), taxonomies, groundingDepth }
 */
import { NextResponse } from 'next/server';
import { requireForgeSession, jsonError, forgeErrorResponse, taxonomiesPayload } from '@/lib/forge/route-helpers';
import { getDeckForSession } from '@/lib/forge/deck';
import { getForgeState, sessionView } from '@/lib/forge/state';
import type { ForgeDeckView } from '@/lib/forge/types';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await requireForgeSession(params.id);
  if (!ctx.ok) return ctx.response;
  const { service, session } = ctx;

  try {
    const snapshot = await getForgeState(service, session.id);
    if (!snapshot) return jsonError(404, 'Session state not found');

    const deckResult = await getDeckForSession(service, session.product_id);
    const deck = deckResult.deck;
    const deckView: ForgeDeckView = {
      brand: deck.brand,
      product: deck.product,
      oneLiner: deck.oneLiner,
      anchorType: deck.anchorType,
      personas: deck.personas,
      pains: deck.pains,
      referenceImages: [],
      approvedLanguage: (deck.brandVoice && deck.brandVoice.approvedLanguage) || [],
    };

    return NextResponse.json({
      session: sessionView(snapshot.state, snapshot.rev, session),
      deck: deckView,
      taxonomies: taxonomiesPayload(),
      groundingDepth: deckResult.depth,
    });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
