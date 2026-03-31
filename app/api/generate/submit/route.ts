import { createClient, createServiceClient } from '@/lib/supabase/server';
import { imageProvider } from '@/lib/image-providers';
import { assemblePrompt } from '@/lib/prompt-assembler';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const serviceClient = await createServiceClient();

  // 1. Check usage cap
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('usage_count, usage_cap')
    .eq('id', user.id)
    .single();

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  if (profile.usage_count >= profile.usage_cap) {
    return NextResponse.json(
      { error: 'Monthly generation limit reached.', used: profile.usage_count, cap: profile.usage_cap },
      { status: 429 }
    );
  }

  // 2. Parse request
  const { sessionId, productId, prompt, aspectRatio, referenceImageUrls } = await request.json();

  if (!sessionId || !productId || !prompt) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // 3. Get product for prompt assembly
  const { data: product } = await serviceClient
    .from('products')
    .select('*')
    .eq('id', productId)
    .single();

  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  // 4. Assemble final prompt
  const finalPrompt = assemblePrompt(product, prompt, aspectRatio || '1:1');

  // 5. Create generated_image record
  const modelId = process.env.HIGGSFIELD_MODEL_ID || 'higgsfield-ai/soul/standard';

  const { data: genImage, error: insertError } = await serviceClient
    .from('generated_images')
    .insert({
      session_id: sessionId,
      prompt_used: finalPrompt,
      aspect_ratio: aspectRatio || '1:1',
      api_provider: modelId,
      model_id: modelId,
      status: 'queued',
    })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // 6. Call Higgsfield API
  try {
    const result = await imageProvider.submitGeneration({
      prompt: finalPrompt,
      aspectRatio: aspectRatio || '1:1',
      referenceImageUrls,
      modelId,
    });

    // Update record with request_id
    await serviceClient
      .from('generated_images')
      .update({ request_id: result.requestId, status: 'in_progress' })
      .eq('id', genImage.id);

    // 7. Increment usage
    await serviceClient.rpc('increment_usage', { user_id: user.id });

    return NextResponse.json({
      generatedImageId: genImage.id,
      requestId: result.requestId,
    });
  } catch (err: any) {
    // Update status to failed
    await serviceClient
      .from('generated_images')
      .update({ status: 'failed', error_message: err.message })
      .eq('id', genImage.id);

    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
