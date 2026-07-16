import { requireMember } from '@/lib/auth/guards';
import { NextResponse } from 'next/server';

export async function GET() {
  const ctx = await requireMember();
  if (!ctx.ok) return ctx.response;

  const { data, error } = await ctx.service
    .from('products')
    .select('*, product_images(*)')
    .eq('workspace_id', ctx.workspaceId)
    .is('archived_at', null)
    .order('brand');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
