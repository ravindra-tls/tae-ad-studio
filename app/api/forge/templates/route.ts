/**
 * GET /api/forge/templates
 *
 * Picker list over the live prompt_templates table with structural compat
 * flags (people_ok / features_person / has_headline_slot) for the client's
 * rankTemplatesForConcept (lib/templates/ranking.ts).
 */
import { NextResponse } from 'next/server';
import { requireUser, forgeErrorResponse } from '@/lib/forge/route-helpers';
import { listTemplates } from '@/lib/templates/compat';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  try {
    const templates = await listTemplates();
    return NextResponse.json({ templates });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
