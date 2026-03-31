import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { request_id, status, images, error } = payload;

    if (!request_id) {
      return NextResponse.json({ error: 'Missing request_id' }, { status: 400 });
    }

    const supabase = await createServiceClient();

    const updateData: Record<string, any> = { status };

    if (status === 'completed' && images?.[0]?.url) {
      updateData.image_url = images[0].url;
    }

    if (status === 'failed' || status === 'nsfw') {
      updateData.error_message = error || `Generation ${status}`;
    }

    await supabase
      .from('generated_images')
      .update(updateData)
      .eq('request_id', request_id);

    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}
