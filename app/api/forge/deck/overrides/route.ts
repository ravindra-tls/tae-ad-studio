/**
 * PATCH /api/forge/deck/overrides — admin-only durable deck edits.
 *
 * Saves the Audience & Personas panel's edits into product_decks.overrides
 * (merged over the distilled deck at every load, so they survive re-distills)
 * and re-renders the stored prompt_block from the merged deck.
 *
 * Body:     { productId, overrides }
 * Response: { deck (merged), overrides }
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, jsonError, forgeErrorResponse } from '@/lib/forge/route-helpers';
import { applyOverrides, deckToPromptBlock } from '@/lib/forge/deck';
import type { DeckOverrides, ForgeDeck } from '@/lib/forge/types';

export const dynamic = 'force-dynamic';

const RequestBody = z.object({
  productId: z.uuid(),
  overrides: z.looseObject({
    personas: z.array(z.looseObject({ id: z.string().min(1) })).optional(),
    pains: z.array(z.looseObject({ id: z.string().min(1) })).optional(),
    brandVoice: z.looseObject({}).optional(),
    constraints: z.array(z.string()).optional(),
  }),
});

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { service } = auth;

  let body: z.infer<typeof RequestBody>;
  try {
    body = RequestBody.parse(await request.json());
  } catch (err) {
    return jsonError(400, err instanceof Error ? err.message : 'Invalid request body');
  }

  try {
    const { data: row } = await service
      .from('product_decks')
      .select('product_id, deck')
      .eq('product_id', body.productId)
      .maybeSingle();
    if (!row) {
      return jsonError(404, 'No deck for this product yet — rebuild it first (POST /api/forge/deck/rebuild).');
    }

    const overrides = body.overrides as DeckOverrides;
    const merged = applyOverrides(row.deck as ForgeDeck, overrides);
    const promptBlock = deckToPromptBlock(merged);

    const { error: upErr } = await service
      .from('product_decks')
      .update({ overrides, prompt_block: promptBlock })
      .eq('product_id', body.productId);
    if (upErr) return jsonError(500, `Failed to save overrides: ${upErr.message}`);

    return NextResponse.json({ deck: merged, overrides });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
