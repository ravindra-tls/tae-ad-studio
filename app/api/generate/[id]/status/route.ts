import { createClient, createServiceClient } from '@/lib/supabase/server';
import { imageProvider } from '@/lib/image-providers';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const serviceClient = await createServiceClient();

  // Get the generated image record
  const { data: genImage } = await serviceClient
    .from('generated_images')
    .select('*, session:sessions(user_id)')
    .eq('id', params.id)
    .single();

  if (!genImage) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Already terminal state
  if (['completed', 'failed', 'nsfw'].includes(genImage.status)) {
    return NextResponse.json({
      status: genImage.status,
      imageUrl: genImage.image_url,
      error: genImage.error_message,
    });
  }

  // Poll provider if the record is still in progress
  if (!genImage.request_id) {
    return NextResponse.json({ status: genImage.status });
  }

  // Synchronous providers — no async polling, DB record is the source of truth
  const SYNC_PROVIDERS = ['vertex-ai', 'xai'];
  if (SYNC_PROVIDERS.includes(genImage.api_provider)) {
    return NextResponse.json({
      status: genImage.status,
      imageUrl: genImage.image_url,
      error: genImage.error_message,
    });
  }

  try {
    const apiStatus = await imageProvider.checkStatus(genImage.request_id);

    if (apiStatus.status === 'completed' && apiStatus.images?.[0]) {
      await serviceClient
        .from('generated_images')
        .update({
          status: 'completed',
          image_url: apiStatus.images[0].url,
        })
        .eq('id', params.id);

      return NextResponse.json({
        status: 'completed',
        imageUrl: apiStatus.images[0].url,
      });
    }

    if (apiStatus.status === 'failed' || apiStatus.status === 'nsfw') {
      await serviceClient
        .from('generated_images')
        .update({
          status: apiStatus.status,
          error_message: apiStatus.error || `Generation ${apiStatus.status}`,
        })
        .eq('id', params.id);
    }

    return NextResponse.json({ status: apiStatus.status });
  } catch (err: any) {
    return NextResponse.json({ status: genImage.status, pollError: err.message });
  }
}
