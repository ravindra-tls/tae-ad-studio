/**
 * POST /api/admin/proposals/[id]/approve — two-step proposal approval.
 *
 * Step 1 (dry run): { dryRun: true } → builds a TemplateDraft (direct if the
 *   prompt_example is already tokenized, else AI conversion) and returns it.
 *   NOTHING is written; the admin edits the draft in the approval modal.
 * Step 2 (commit): { draft: {...} } → conditional-UPDATE mutex flips the
 *   proposal to 'approved' (only from pending/reviewed — a concurrent second
 *   approve gets 409), inserts the WORKSPACE-scoped prompt_templates row
 *   (number comes from the sequence default), links resolved_template_id,
 *   and invalidates the template cache. The unique partial index on
 *   source_proposal_id is the DB backstop against double-approval.
 *
 * dev may approve for any workspace; admin only for their own (404 hiding).
 */
import { NextResponse } from 'next/server';
import { requireAdmin, isDevRole } from '@/lib/auth/guards';
import { buildTemplateDraft, sanitizeCategory, sanitizeAspect } from '@/lib/templates/create-from-text';
import { invalidateTemplateCache } from '@/lib/templates/compat';

export const maxDuration = 120; // AI conversion path calls Claude
export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const ctx = await requireAdmin();
  if (!ctx.ok) return ctx.response;
  const { service, user, profile } = ctx;

  const { data: proposal } = await service
    .from('feedback_submissions')
    .select('*')
    .eq('id', params.id)
    .eq('kind', 'template_proposal')
    .maybeSingle();
  if (!proposal) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Scope: admins act only on their workspace's proposals.
  if (!isDevRole(profile.role) && proposal.workspace_id !== ctx.workspaceId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!proposal.workspace_id) {
    return NextResponse.json({ error: 'Proposal has no workspace — a dev must assign one first' }, { status: 422 });
  }
  if (!['pending', 'reviewed'].includes(proposal.status)) {
    return NextResponse.json({ error: `Proposal is already ${proposal.status}` }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));

  // ── Step 1: dry run ────────────────────────────────────────────────────────
  if (body.dryRun) {
    try {
      const draft = await buildTemplateDraft(proposal);
      return NextResponse.json({ draft });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: `Draft generation failed: ${msg}` }, { status: 502 });
    }
  }

  // ── Step 2: commit ─────────────────────────────────────────────────────────
  const draft = body.draft as { name?: string; category?: string; default_aspect_ratio?: string; template?: string } | undefined;
  if (!draft?.name?.trim() || !draft?.template?.trim()) {
    return NextResponse.json({ error: 'draft.name and draft.template are required' }, { status: 400 });
  }

  // Mutex: only one approver wins the pending→approved flip.
  const { data: flipped } = await service
    .from('feedback_submissions')
    .update({
      status: 'approved',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', proposal.id)
    .in('status', ['pending', 'reviewed'])
    .select('id')
    .maybeSingle();
  if (!flipped) {
    return NextResponse.json({ error: 'Proposal was just approved or rejected by someone else' }, { status: 409 });
  }

  // Insert the workspace-scoped template. `number` omitted → sequence default.
  const { data: template, error: insErr } = await service
    .from('prompt_templates')
    .insert({
      name: draft.name.trim().slice(0, 120),
      category: sanitizeCategory(draft.category),
      template: draft.template.trim(),
      default_aspect_ratio: sanitizeAspect(draft.default_aspect_ratio),
      version: 1,
      workspace_id: proposal.workspace_id,
      created_by: user.id,
      source_proposal_id: proposal.id,
    })
    .select('id, number, name, category, workspace_id')
    .single();

  if (insErr) {
    // Compensate: release the mutex so the proposal isn't stuck approved-with-no-template.
    await service.from('feedback_submissions')
      .update({ status: 'reviewed' })
      .eq('id', proposal.id);
    const code = (insErr as { code?: string }).code;
    if (code === '23505') {
      return NextResponse.json({ error: 'A template was already created from this proposal' }, { status: 409 });
    }
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  await service.from('feedback_submissions')
    .update({ resolved_template_id: template.id })
    .eq('id', proposal.id);

  invalidateTemplateCache();
  // Preview generation is left to the admin templates grid's existing Preview
  // button (fire-and-forget internal auth is not worth the complexity here).

  return NextResponse.json({ approved: true, template }, { status: 201 });
}
