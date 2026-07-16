import { NextResponse } from 'next/server';
import { requireMember } from '@/lib/auth/guards';
import { pruneEmptySessions } from '@/lib/prune-sessions';

// ─── GET — list sessions (empty ones are pruned first) ────────────────────────

export async function GET() {
  const ctx = await requireMember();
  if (!ctx.ok) return ctx.response;

  // Clean up before returning so the list is always fresh
  await pruneEmptySessions(ctx.service, ctx.user.id);

  const { data, error } = await ctx.service
    .from('sessions')
    .select('*, product:products(name, brand, sub_brand, thumbnail_url)')
    .eq('user_id', ctx.user.id)
    .eq('workspace_id', ctx.workspaceId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// ─── POST — create a new session (prune empty ones first) ────────────────────

export async function POST(request: Request) {
  const ctx = await requireMember();
  if (!ctx.ok) return ctx.response;

  const { productId, name } = await request.json();

  // The product must belong to the caller's workspace before we spin up a
  // session for it (service client bypasses RLS — enforce ownership here).
  const { data: product } = await ctx.service
    .from('products')
    .select('workspace_id')
    .eq('id', productId)
    .maybeSingle();

  if (!product || product.workspace_id !== ctx.workspaceId) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  // Delete any leftover empty sessions before creating a new one
  await pruneEmptySessions(ctx.service, ctx.user.id);

  const { data, error } = await ctx.service
    .from('sessions')
    .insert({ user_id: ctx.user.id, product_id: productId, name, workspace_id: ctx.workspaceId })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
