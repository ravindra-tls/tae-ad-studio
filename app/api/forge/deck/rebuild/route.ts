/**
 * POST /api/forge/deck/rebuild — admin-only forced deck re-distill.
 *
 * Body:     { productId }
 * Response: { deck (full, overrides merged), depth, sourceHash, distilledAt }
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, jsonError, forgeErrorResponse } from '@/lib/forge/route-helpers';
import { getOrBuildDeck } from '@/lib/forge/deck';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const RequestBody = z.object({
  productId: z.uuid(),
});

export async function POST(request: Request) {
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
    const result = await getOrBuildDeck(service, body.productId, { force: true });
    return NextResponse.json({
      deck: result.deck,
      depth: result.depth,
      sourceHash: result.sourceHash,
      distilledAt: result.distilledAt,
    });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
