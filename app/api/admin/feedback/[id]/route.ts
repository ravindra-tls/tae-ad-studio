import { requireAdmin } from '@/lib/auth/guards';
import { NextResponse } from 'next/server';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const ctx = await requireAdmin();
  if (!ctx.ok) return ctx.response;

  const { status, reviewerNote } = await request.json();
  if (!['pending', 'reviewed', 'implemented', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const { data, error } = await ctx.service
    .from('feedback_submissions')
    .update({
      status,
      reviewer_note: reviewerNote?.trim() || null,
    })
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
