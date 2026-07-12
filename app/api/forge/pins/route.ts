/**
 * POST /api/forge/pins
 *
 * Set assembly-chain pins from the UI (partial merge; empty string clears a slot).
 *
 * Body:     { sessionId, pins }
 * Response: { session }
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireForgeSession, jsonError, forgeErrorResponse } from '@/lib/forge/route-helpers';
import { mutateForgeState, sessionView } from '@/lib/forge/state';
import { setPins } from '@/lib/forge/state-ops';
import type { ForgePins } from '@/lib/forge/types';

export const dynamic = 'force-dynamic';

const RequestBody = z.object({
  sessionId: z.uuid(),
  pins: z.looseObject({}),
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
    const { state, rev } = await mutateForgeState(service, session.id, (draft) => {
      setPins(draft, body.pins as ForgePins);
    });
    return NextResponse.json({ session: sessionView(state, rev, session) });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
