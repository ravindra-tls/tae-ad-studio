import { requireAdmin, isDevRole } from '@/lib/auth/guards';
import { NextResponse } from 'next/server';

/**
 * PATCH /api/admin/feedback/[id]
 *
 * Review a feedback submission.
 *   dev   → may review anything (general feedback lives in the dev inbox).
 *   admin → may review only template_proposals belonging to their workspace.
 * 404 (not 403) on out-of-scope rows so ids aren't enumerable.
 * ('approved' is stamped exclusively by the proposal approve flow, not here.)
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const ctx = await requireAdmin();
  if (!ctx.ok) return ctx.response;

  const { status, reviewerNote } = await request.json();
  if (!['pending', 'reviewed', 'implemented', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  // Scope check
  const { data: row } = await ctx.service
    .from('feedback_submissions')
    .select('id, kind, workspace_id, status')
    .eq('id', params.id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (!isDevRole(ctx.profile.role)) {
    const inScope = row.kind === 'template_proposal' && row.workspace_id === ctx.workspaceId;
    if (!inScope) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (row.status === 'approved') {
    return NextResponse.json({ error: 'Approved proposals can no longer be re-reviewed here' }, { status: 409 });
  }

  const { data, error } = await ctx.service
    .from('feedback_submissions')
    .update({
      status,
      reviewer_note: reviewerNote?.trim() || null,
      reviewed_by: ctx.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
