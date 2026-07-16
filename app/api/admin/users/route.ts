import { requireAdmin } from '@/lib/auth/guards';
import { NextResponse } from 'next/server';

export async function GET() {
  const ctx = await requireAdmin();
  if (!ctx.ok) return ctx.response;

  const { data, error } = await ctx.service
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
