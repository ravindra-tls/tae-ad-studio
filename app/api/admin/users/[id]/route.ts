import { requireAdmin } from '@/lib/auth/guards';
import { NextResponse } from 'next/server';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const ctx = await requireAdmin();
  if (!ctx.ok) return ctx.response;

  const updates = await request.json();
  const allowedFields = ['role', 'usage_cap', 'usage_count'];
  const sanitized: Record<string, any> = {};
  for (const key of allowedFields) {
    if (updates[key] !== undefined) sanitized[key] = updates[key];
  }

  const { data, error } = await ctx.service
    .from('profiles')
    .update(sanitized)
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
