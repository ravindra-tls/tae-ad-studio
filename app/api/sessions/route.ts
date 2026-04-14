import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// ─── Shared helper — deletes sessions for a user that have zero generated images ──

async function pruneEmptySessions(serviceClient: Awaited<ReturnType<typeof createServiceClient>>, userId: string) {
  // 1. Get all session IDs for this user
  const { data: allSessions } = await serviceClient
    .from('sessions')
    .select('id')
    .eq('user_id', userId);

  if (!allSessions?.length) return;

  // 2. Of those, find which ones actually have at least one generated image
  const { data: populated } = await serviceClient
    .from('generated_images')
    .select('session_id')
    .in('session_id', allSessions.map((s) => s.id));

  const idsWithImages = new Set((populated ?? []).map((r) => r.session_id));

  // 3. Delete the ones with no images
  const emptyIds = allSessions.map((s) => s.id).filter((id) => !idsWithImages.has(id));

  if (emptyIds.length > 0) {
    const { error } = await serviceClient.from('sessions').delete().in('id', emptyIds);
    if (error) console.error('[pruneEmptySessions] delete error:', error.message);
  }
}

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
