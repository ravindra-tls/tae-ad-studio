/**
 * POST /api/admin/templates/test
 *
 * Given a templateId, selects 3 random products, fills + enriches the
 * template prompt for each, generates one image per product using the
 * active image provider, and returns the results.
 *
 * Runs all 3 generations in parallel. One failure doesn't cancel the others.
 * Admin-only.
 */
import { requireAdmin } from '@/lib/auth/guards';
import { NextResponse } from 'next/server';
import { fillTemplate, aiEnrichPrompt, assemblePrompt } from '@/lib/prompt-assembler';
import { imageProvider, getGeneratedFileExtension } from '@/lib/image-providers';
import { resolveReferenceImages } from '@/lib/storage/reference-images';
import type { Product, ProductImage } from '@/types';

export async function POST(request: Request) {
  const ctx = await requireAdmin();
  if (!ctx.ok) return ctx.response;
  const { user, service, workspaceId } = ctx;
  if (!workspaceId) return NextResponse.json({ error: 'No workspace selected' }, { status: 400 });

  const body = await request.json() as { templateId: string };
  const { templateId } = body;
  if (!templateId) return NextResponse.json({ error: 'Missing templateId' }, { status: 400 });

  // Fetch template
  const { data: template, error: tplErr } = await service
    .from('prompt_templates').select('*').eq('id', templateId).single();
  if (tplErr || !template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  // Fetch products (with images) IN THIS WORKSPACE, pick 3 at random
  const { data: allProducts, error: prodErr } = await service
    .from('products').select('*, product_images(*)')
    .eq('workspace_id', workspaceId).is('archived_at', null).limit(50);
  if (prodErr || !allProducts?.length) {
    return NextResponse.json({ error: 'No products found' }, { status: 404 });
  }

  const shuffled = ([...allProducts] as Product[]).sort(() => Math.random() - 0.5).slice(0, 3);

  // Derive provider + model (mirrors submit/route.ts)
  const activeProvider = (process.env.IMAGE_PROVIDER || 'openai').toLowerCase();
  const modelId =
    activeProvider === 'xai'    ? (process.env.XAI_MODEL_ID        || 'grok-imagine-image')          :
    activeProvider === 'vertex' ? (process.env.VERTEX_AI_MODEL_ID  || 'gemini-3-pro-image-preview')   :
                                  (process.env.OPENAI_MODEL_ID     || 'gpt-image-2');
  const apiProvider = activeProvider === 'vertex' ? 'vertex-ai' : activeProvider;

  // ─── Per-product generation ─────────────────────────────────────────────────

  const generateOne = async (product: Product) => {
    // Create a lightweight session so the image record has a valid foreign key
    const { data: session, error: sessErr } = await service
      .from('sessions')
      .insert({
        user_id:      user.id,
        product_id:   product.id,
        workspace_id: workspaceId,
        is_test:      true, // excluded from gallery + dashboard listings
        name:         `Template Test · ${template.name}`,
      })
      .select('id')
      .single();

    if (sessErr || !session) {
      throw new Error(`Session create failed: ${sessErr?.message ?? 'unknown'}`);
    }

    // Fill static tokens, then AI-enrich remaining ones, then add product context
    const filled      = fillTemplate(template.template, product);
    const enriched    = await aiEnrichPrompt(filled, product);
    const finalPrompt = assemblePrompt(product, enriched, template.default_aspect_ratio);

    // Reference images attached to this product
    const rawImages = ((product as any).product_images ?? []) as ProductImage[];
    const resolved = await resolveReferenceImages(rawImages);
    const refImages: string[] = [
      ...resolved.map((img) => img.resolved_url),
      ...(product.thumbnail_url ? [product.thumbnail_url] : []),
    ].slice(0, 4);

    // Insert DB record (status: queued)
    const { data: genRecord, error: genErr } = await service
      .from('generated_images')
      .insert({
        session_id:   session.id,
        prompt_used:  finalPrompt,
        aspect_ratio: template.default_aspect_ratio,
        api_provider: apiProvider,
        model_id:     modelId,
        template_id:  templateId,
        status:       'queued',
      })
      .select()
      .single();

    if (genErr || !genRecord) {
      throw new Error(`DB insert failed: ${genErr?.message ?? 'unknown'}`);
    }

    // Submit to image provider
    const result = await imageProvider.submitGeneration({
      prompt:             finalPrompt,
      aspectRatio:        template.default_aspect_ratio,
      referenceImageUrls: refImages.length > 0 ? refImages : undefined,
      modelId,
    });

    if (result.status === 'completed' && result.image) {
      // Upload to storage
      const imageBytes = Buffer.from(result.image.data, 'base64');
      const fileExt    = getGeneratedFileExtension(result.image.mimeType);
      const filePath   = `${user.id}/${genRecord.id}.${fileExt}`;

      const { error: upErr } = await service.storage
        .from('generated-images')
        .upload(filePath, imageBytes, {
          contentType: result.image.mimeType,
          upsert: true,
        });

      if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);

      const { data: pub } = service.storage
        .from('generated-images')
        .getPublicUrl(filePath);

      const imageUrl = pub.publicUrl;

      await service
        .from('generated_images')
        .update({
          request_id: result.requestId ?? null,
          status:     'completed',
          image_url:  imageUrl,
        })
        .eq('id', genRecord.id);

      return {
        imageId:     genRecord.id,
        imageUrl,
        productName: [product.name, product.sub_brand ?? product.brand]
          .filter(Boolean).join(' · '),
        aspectRatio: template.default_aspect_ratio,
      };
    }

    // Generation did not complete synchronously — update DB and surface as error
    await service
      .from('generated_images')
      .update({
        request_id:    result.requestId ?? null,
        status:        result.status === 'failed' ? 'failed' : 'in_progress',
        error_message: result.error ?? null,
      })
      .eq('id', genRecord.id);

    throw new Error(result.error ?? `Generation status: ${result.status}`);
  };

  // Run 3 in parallel — one failure must not cancel the others
  const settled = await Promise.allSettled(shuffled.map(generateOne));

  type SuccessResult = {
    imageId: string; imageUrl: string;
    productName: string; aspectRatio: string;
  };
  type FailResult = { error: string; productName: string };

  const results: (SuccessResult | FailResult)[] = settled.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : {
          error:       (r.reason as Error)?.message ?? 'Generation failed',
          productName: shuffled[i]?.name ?? `Product ${i + 1}`,
        },
  );

  const anySucceeded = results.some((r) => !('error' in r));
  if (!anySucceeded) {
    return NextResponse.json({ error: 'All 3 generations failed', results }, { status: 500 });
  }

  return NextResponse.json({ results });
}
