/**
 * POST /api/generate/submit
 *
 * V1 note (2026-04-18): this route hardcodes api_provider='xai' and
 * model_id=XAI_MODEL_ID because xAI is the TEMPORARY image-gen bridge. The
 * target is Vertex AI (Gemini 3 Pro Image) — switching means (a) flipping
 * IMAGE_PROVIDER=vertex in env (handled by lib/image-providers/index.ts) and
 * (b) sourcing api_provider + model_id from the provider object instead of
 * hardcoding. Keeping it hardcoded for now to avoid silently migrating the
 * historical generated_images rows that reference 'xai' as their provider.
 */
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getGeneratedFileExtension, imageProvider } from '@/lib/image-providers';
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
      { error: 'Weekly generation limit reached.', used: profile.usage_count, cap: profile.usage_cap },
      { status: 429 }
    );
  }

  // 2. Parse request
  const { sessionId, productId, prompt, aspectRatio, referenceImageUrls, maskDataUrl, skipAssembly } = await request.json();

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
  }
  // skipAssembly (image edits) may send a constructed prompt — always present.
  // Normal text-to-image requires both prompt and productId.
  if (!skipAssembly && (!prompt || !productId)) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  if (skipAssembly && !prompt) {
    return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
  }

  // 3. Assemble final prompt (skip for edits that already have an assembled prompt)
  let finalPrompt: string;
  if (skipAssembly) {
    finalPrompt = prompt;
  } else {
    const { data: product } = await serviceClient
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    finalPrompt = assemblePrompt(product, prompt, aspectRatio || '1:1');
  }

  // 5. Create generated_image record
  // Derive provider + model from env so the DB row reflects reality.
  const activeProvider = (process.env.IMAGE_PROVIDER || 'openai').toLowerCase();
  const modelId =
    activeProvider === 'xai'    ? (process.env.XAI_MODEL_ID    || 'grok-imagine-image') :
    activeProvider === 'vertex' ? (process.env.VERTEX_AI_MODEL_ID || 'gemini-3-pro-image-preview') :
    (process.env.OPENAI_MODEL_ID || 'gpt-image-2');

  const { data: genImage, error: insertError } = await serviceClient
    .from('generated_images')
    .insert({
      session_id:   sessionId,
      prompt_used:  finalPrompt,
      aspect_ratio: aspectRatio || '1:1',
      api_provider: activeProvider === 'vertex' ? 'vertex-ai' : activeProvider,
      model_id:     modelId,
      status:       'queued',
    })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // 6. Call Vertex AI
  // imageUrl is hoisted so we can return it directly in the response —
  // the client receives it immediately and never needs to poll for edits.
  let completedImageUrl: string | undefined;

  try {
    const result = await imageProvider.submitGeneration({
      prompt:             finalPrompt,
      aspectRatio:        aspectRatio || '1:1',
      referenceImageUrls,
      maskDataUrl,
      modelId,
    });

    if (result.status === 'completed' && result.image) {
      const imageBytes = Buffer.from(result.image.data, 'base64');
      const fileExt = getGeneratedFileExtension(result.image.mimeType);
      const filePath = `${user.id}/${genImage.id}.${fileExt}`;

      const { error: uploadError } = await serviceClient
        .storage
        .from('generated-images')
        .upload(filePath, imageBytes, {
          contentType: result.image.mimeType,
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Generated image upload failed: ${uploadError.message}`);
      }

      const { data: publicUrlData } = serviceClient
        .storage
        .from('generated-images')
        .getPublicUrl(filePath);

      completedImageUrl = publicUrlData.publicUrl;

      await serviceClient
        .from('generated_images')
        .update({
          request_id: result.requestId,
          status: 'completed',
          image_url: completedImageUrl,
        })
        .eq('id', genImage.id);
    } else if (result.status === 'failed' || result.status === 'nsfw') {
      await serviceClient
        .from('generated_images')
        .update({
          request_id: result.requestId,
          status: result.status,
          error_message: result.error || `Generation ${result.status}`,
        })
        .eq('id', genImage.id);

      return NextResponse.json({ error: result.error || 'Image generation failed' }, { status: 500 });
    } else {
      await serviceClient
        .from('generated_images')
        .update({ request_id: result.requestId, status: 'in_progress' })
        .eq('id', genImage.id);
    }

    // 7. Increment usage
    const { error: rpcErr } = await serviceClient.rpc('increment_usage', { user_id: user.id });
    if (rpcErr) console.error('[submit] increment_usage failed:', rpcErr.message);

    return NextResponse.json({
      generatedImageId: genImage.id,
      requestId:        result.requestId,
      // imageUrl is included when generation is synchronous (xAI/OpenAI).
      // The client can use it immediately and skip the polling round-trip.
      imageUrl:         completedImageUrl,
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
