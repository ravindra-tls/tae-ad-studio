import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { pruneEmptySessions } from '@/lib/prune-sessions';

// ─── GET — list sessions (empty ones are pruned first) ────────────────────────

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const serviceClient = await createServiceClient();

  // Clean up before returning so the list is always fresh
  await pruneEmptySessions(serviceClient, user.id);

  const { data, error } = await serviceClient
    .from('sessions')
    .select('*, product:products(name, brand, sub_brand, thumbnail_url)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// ─── POST — create a new session (prune empty ones first) ────────────────────

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { productId, name } = await request.json();

  const serviceClient = await createServiceClient();

  // Delete any leftover empty sessions before creating a new one
  await pruneEmptySessions(serviceClient, user.id);

  const { data, error } = await serviceClient
    .from('sessions')
    .insert({ user_id: user.id, product_id: productId, name })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
