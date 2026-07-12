/**
 * POST /api/forge/session
 *
 * Create a Concept Forge session for a product:
 *   sessions row (source='forge') + forge_states row (rev 1) + grounding deck
 *   (distilled on first use per product — 20-60s; cached in product_decks).
 *
 * Body:     { productId }
 * Response: { session, deck (trimmed), taxonomies, groundingDepth }
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser, jsonError, forgeErrorResponse, taxonomiesPayload } from '@/lib/forge/route-helpers';
import { getOrBuildDeck } from '@/lib/forge/deck';
import { emptyState } from '@/lib/forge/state-ops';
import { sessionView } from '@/lib/forge/state';
import type { ForgeDeckView } from '@/lib/forge/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const RequestBody = z.object({
  productId: z.uuid(),
});

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { user, service } = auth;

  let body: z.infer<typeof RequestBody>;
  try {
    body = RequestBody.parse(await request.json());
  } catch (err) {
    return jsonError(400, err instanceof Error ? err.message : 'Invalid request body');
  }

  try {
    const { data: product, error: prodErr } = await service
      .from('products')
      .select('id, name')
      .eq('id', body.productId)
      .maybeSingle();
    if (prodErr || !product) return jsonError(404, 'Product not found');

    // Session row.
    const sessionName = `${product.name} — Forge · ${new Date().toLocaleDateString()}`;
    const { data: session, error: sessErr } = await service
      .from('sessions')
      .insert({
        user_id: user.id,
        product_id: product.id,
        name: sessionName,
        source: 'forge',
      })
      .select('id, user_id, product_id, name, status, source')
      .single();
    if (sessErr || !session) {
      return jsonError(500, `Session create failed: ${sessErr?.message ?? 'unknown'}`);
    }

    // Fresh state document at rev 1.
    const state = emptyState();
    const { error: stateErr } = await service
      .from('forge_states')
      .insert({ session_id: session.id, state, rev: 1 });
    if (stateErr) {
      return jsonError(500, `Forge state create failed: ${stateErr.message}`);
    }

    // Grounding deck (distills on cache miss — the long pole of this route).
    const deckResult = await getOrBuildDeck(service, product.id);
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
      session: sessionView(state, 1, session),
      deck: deckView,
      taxonomies: taxonomiesPayload(),
      groundingDepth: deckResult.depth,
    });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
