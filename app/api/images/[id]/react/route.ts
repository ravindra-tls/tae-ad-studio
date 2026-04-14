import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { reaction } = await request.json();
  if (reaction !== 'like' && reaction !== 'dislike') {
    return NextResponse.json({ error: 'Invalid reaction' }, { status: 400 });
  }

  const serviceClient = await createServiceClient();

  // Upsert — replaces any previous reaction by this user on this image
  const { error } = await serviceClient
    .from('image_reactions')
    .upsert(
      { image_id: params.id, user_id: user.id, reaction },
      { onConflict: 'image_id,user_id' },
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// DELETE — remove a reaction (undo swipe)
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const serviceClient = await createServiceClient();

  const { error } = await serviceClient
    .from('image_reactions')
    .delete()
    .eq('image_id', params.id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
