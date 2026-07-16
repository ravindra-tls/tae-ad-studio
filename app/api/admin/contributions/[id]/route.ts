import { requireAdmin } from '@/lib/auth/guards';
import { NextResponse } from 'next/server';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const ctx = await requireAdmin();
  if (!ctx.ok) return ctx.response;

  const { status, reviewerNote } = await request.json();
  if (!['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'Status must be approved or rejected' }, { status: 400 });
  }

  const { data, error } = await ctx.service
    .from('context_contributions')
    .update({ status, reviewer_note: reviewerNote || null })
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
