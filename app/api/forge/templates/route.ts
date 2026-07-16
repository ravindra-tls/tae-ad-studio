/**
 * GET /api/forge/templates
 *
 * Picker list over the live prompt_templates table with structural compat
 * flags (people_ok / features_person / has_headline_slot) for the client's
 * rankTemplatesForConcept (lib/templates/ranking.ts).
 *
 * Workspace-scoped: members see the universal set + their own workspace's
 * templates (listTemplates filters to active only).
 */
import { NextResponse } from 'next/server';
import { requireMember } from '@/lib/auth/guards';
import { forgeErrorResponse } from '@/lib/forge/route-helpers';
import { listTemplates } from '@/lib/templates/compat';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireMember();
  if (!ctx.ok) return ctx.response;
  try {
    const templates = await listTemplates(ctx.workspaceId);
    return NextResponse.json({ templates });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
