/**
 * POST /api/copy-ad
 *
 * "Copy from another Ad" workflow.
 *
 * 1. Accepts a reference ad image (base64) + any number of product IDs (limited only by usage cap).
 * 2. Uses Claude + image-to-template SKILL.md to extract a reusable
 *    template from the reference image.
 * 3. Uploads the reference image to storage.
 * 4. For each product, creates a session and generates an image using
 *    the extracted template.
 * 5. Returns { groupId, sessions[], templateText, templateName, templateCategory }
 *    so the client can redirect to /copy-ad/results?group=[groupId].
 *
 * Products limited only by the user's remaining usage cap (each generates one image = 1 credit).
 */
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fillTemplate, aiEnrichPrompt, assemblePrompt } from '@/lib/prompt-assembler';
import { imageProvider, getGeneratedFileExtension } from '@/lib/image-providers';
import { resolveReferenceImages } from '@/lib/storage/reference-images';
import type { Product, ProductImage } from '@/types';

// ─── Load image-to-template skill (same skill as admin template generate) ─────

function loadSkill(): string {
  const skillPath = path.join(process.cwd(), 'skills', 'image-to-template', 'SKILL.md');
  try {
    const raw = fs.readFileSync(skillPath, 'utf-8');
    return raw.replace(/^---[\s\S]*?---\n?/, '').trim();
  } catch {
    throw new Error(`image-to-template skill not found at: ${skillPath}`);
  }
}

let SKILL_CONTENT: string;
try {
  SKILL_CONTENT = loadSkill();
} catch (e: any) {
  console.error('[copy-ad/route] SKILL load failed:', e.message);
  SKILL_CONTENT = '';
}

const OUTPUT_INSTRUCTION = `

---

IMPORTANT OUTPUT INSTRUCTION:
Produce ONLY the Step 3 output block (starting with "TEMPLATE READY"). Do not add any text before or after it. Do not explain your reasoning. Do not add a preamble. Output the Step 3 format exactly as specified above.`;

// ─── Parse Step 3 output ──────────────────────────────────────────────────────

interface ParsedTemplate {
  name: string;
  category: string;
  aspect_ratio: string;
  template: string;
}

function parseSkillOutput(raw: string): ParsedTemplate | null {
  const nameMatch     = raw.match(/^Name:\s*(.+)$/m);
  const categoryMatch = raw.match(/^Category:\s*(.+)$/m);
  const aspectMatch   = raw.match(/^Aspect Ratio:\s*(.+)$/m);
  const promptMatch   = raw.match(/Prompt:\s*\r?\n\r?\n([\s\S]+?)(?=\r?\n[─\-]{5,})/);

  if (!nameMatch || !categoryMatch || !aspectMatch || !promptMatch) return null;

  return {
    name:         nameMatch[1].trim(),
    category:     categoryMatch[1].trim(),
    aspect_ratio: aspectMatch[1].trim(),
    template:     promptMatch[1].trim(),
  };
}

// ─── Main route ───────────────────────────────────────────────────────────────

export const maxDuration = 300; // 5-minute timeout for Vercel Pro/Enterprise

export async function POST(request: Request) {
  // ── Auth ──
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = await createServiceClient();

  // ── Usage cap check ──
  const { data: profile } = await service
    .from('profiles')
    .select('usage_count, usage_cap')
    .eq('id', user.id)
    .single();

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  // ── Parse body ──
  const body = await request.json() as {
    imageBase64: string;
    mimeType: string;
    productIds: string[];
  };

  const { imageBase64, mimeType, productIds } = body;

  if (!imageBase64)        return NextResponse.json({ error: 'Missing reference image' }, { status: 400 });
  if (!productIds?.length) return NextResponse.json({ error: 'Select at least one product' }, { status: 400 });

  if (profile.usage_count + productIds.length > profile.usage_cap) {
    return NextResponse.json(
      { error: `Not enough credits. Need ${productIds.length}, have ${profile.usage_cap - profile.usage_count}.` },
      { status: 429 },
    );
  }

  if (!SKILL_CONTENT) {
    return NextResponse.json({ error: 'Template skill not loaded' }, { status: 500 });
  }

  // ── 1. Extract template from reference image using Claude ──
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
  const mediaType = ((mimeType || 'image/jpeg').split(';')[0]) as
    'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

  let raw: string;
  try {
    const response = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 2000,
      system:     SKILL_CONTENT + OUTPUT_INSTRUCTION,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
          { type: 'text', text: 'Extract a reusable ad template from this reference ad image.' },
        ],
      }],
    });
    raw = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';
  } catch (err: any) {
    console.error('[copy-ad] Template extraction error:', err.message);
    // Surface a clean, user-readable message
    const msg: string = err.message ?? '';
    const friendlyError =
      msg.includes('usage limits') || msg.includes('rate_limit') || msg.includes('429')
        ? 'AI service usage limit reached. Please try again after your billing period resets.'
        : msg.includes('401') || msg.includes('authentication')
        ? 'AI service authentication error. Check the ANTHROPIC_API_KEY environment variable.'
        : 'AI service unavailable. Please try again in a moment.';
    return NextResponse.json({ error: friendlyError }, { status: 500 });
  }

  const parsed = parseSkillOutput(raw);
  if (!parsed) {
    console.error('[copy-ad] Failed to parse skill output:', raw.slice(0, 500));
    return NextResponse.json({ error: 'Could not parse template from reference image. Try a clearer ad image.' }, { status: 422 });
  }

  // ── 2. Upload reference image to storage ──
  const groupId = crypto.randomUUID();
  const imageBytes = Buffer.from(base64Data, 'base64');
  const fileExt = mimeType?.includes('png') ? 'png' : mimeType?.includes('webp') ? 'webp' : 'jpg';
  const refPath = `copy-ad/${groupId}/reference.${fileExt}`;

  const { error: refUpErr } = await service.storage
    .from('generated-images')
    .upload(refPath, imageBytes, { contentType: mediaType, upsert: true });

  let referenceImageUrl: string | null = null;
  if (!refUpErr) {
    const { data: pub } = service.storage.from('generated-images').getPublicUrl(refPath);
    referenceImageUrl = pub.publicUrl;
  } else {
    console.warn('[copy-ad] Reference image upload failed:', refUpErr.message);
    // Continue anyway — image will still generate without storage URL
  }

  // ── 3. Fetch products ──
  const { data: products, error: prodErr } = await service
    .from('products')
    .select('*, product_images(*)')
    .in('id', productIds);

  if (prodErr || !products?.length) {
    return NextResponse.json({ error: 'Could not fetch products' }, { status: 404 });
  }

  // Preserve caller's order
  const orderedProducts = productIds
    .map((id) => products.find((p) => p.id === id))
    .filter(Boolean) as Product[];

  // ── 4. Derive image provider settings ──
  const activeProvider = (process.env.IMAGE_PROVIDER || 'openai').toLowerCase();
  const modelId =
    activeProvider === 'xai'    ? (process.env.XAI_MODEL_ID        || 'grok-imagine-image')          :
    activeProvider === 'vertex' ? (process.env.VERTEX_AI_MODEL_ID  || 'gemini-3-pro-image-preview')   :
                                  (process.env.OPENAI_MODEL_ID     || 'gpt-image-2');
  const apiProvider = activeProvider === 'vertex' ? 'vertex-ai' : activeProvider;

  // ── 5. Generate one image per product ──

  const generateOne = async (product: Product) => {
    // Create session with copy_ad metadata
    const sessionName = `${product.name} — Copy Ad · ${new Date().toLocaleDateString()}`;
    const { data: session, error: sessErr } = await service
      .from('sessions')
      .insert({
        user_id:             user.id,
        product_id:          product.id,
        name:                sessionName,
        source:              'copy_ad',
        reference_image_url: referenceImageUrl,
        copy_ad_group_id:    groupId,
      })
      .select('id')
      .single();

    if (sessErr || !session) {
      throw new Error(`Session create failed: ${sessErr?.message ?? 'unknown'}`);
    }

    // Fill + enrich + assemble prompt
    const filled      = fillTemplate(parsed.template, product);
    const enriched    = await aiEnrichPrompt(filled, product);
    const finalPrompt = assemblePrompt(product, enriched, parsed.aspect_ratio);

    // Product reference images
    const rawImages = ((product as any).product_images ?? []) as ProductImage[];
    const resolved  = await resolveReferenceImages(rawImages);
    const refImages: string[] = [
      ...resolved.map((img: any) => img.resolved_url),
      ...(product.thumbnail_url ? [product.thumbnail_url] : []),
    ].slice(0, 4);

    // DB record (queued)
    const { data: genRecord, error: genErr } = await service
      .from('generated_images')
      .insert({
        session_id:   session.id,
        prompt_used:  finalPrompt,
        aspect_ratio: parsed.aspect_ratio,
        api_provider: apiProvider,
        model_id:     modelId,
        status:       'queued',
      })
      .select()
      .single();

    if (genErr || !genRecord) {
      throw new Error(`DB insert failed: ${genErr?.message ?? 'unknown'}`);
    }

    // Generate image
    const result = await imageProvider.submitGeneration({
      prompt:             finalPrompt,
      aspectRatio:        parsed.aspect_ratio,
      referenceImageUrls: refImages.length ? refImages : undefined,
      modelId,
    });

    if (result.status === 'completed' && result.image) {
      const imgBytes  = Buffer.from(result.image.data, 'base64');
      const imgExt    = getGeneratedFileExtension(result.image.mimeType);
      const imgPath   = `${user.id}/${genRecord.id}.${imgExt}`;

      const { error: upErr } = await service.storage
        .from('generated-images')
        .upload(imgPath, imgBytes, { contentType: result.image.mimeType, upsert: true });

      if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);

      const { data: pub } = service.storage.from('generated-images').getPublicUrl(imgPath);
      const imageUrl = pub.publicUrl;

      await service.from('generated_images').update({
        request_id: result.requestId ?? null,
        status:     'completed',
        image_url:  imageUrl,
      }).eq('id', genRecord.id);

      return {
        sessionId:   session.id,
        imageId:     genRecord.id,
        imageUrl,
        productName: [product.name, product.sub_brand ?? product.brand].filter(Boolean).join(' · '),
        productId:   product.id,
      };
    }

    await service.from('generated_images').update({
      request_id:    result.requestId ?? null,
      status:        result.status === 'failed' ? 'failed' : 'in_progress',
      error_message: result.error ?? null,
    }).eq('id', genRecord.id);

    throw new Error(result.error ?? `Generation status: ${result.status}`);
  };

  const settled = await Promise.allSettled(orderedProducts.map(generateOne));

  // ── 6. Increment usage count for each product attempted ──
  const attemptCount = settled.length;
  await service.from('profiles')
    .update({ usage_count: profile.usage_count + attemptCount })
    .eq('id', user.id);

  // ── 7. Build response ──
  type SessionResult = {
    sessionId: string; imageId: string; imageUrl: string;
    productName: string; productId: string;
  };

  const sessions: (SessionResult | { error: string; productName: string })[] =
    settled.map((r, i) =>
      r.status === 'fulfilled'
        ? r.value
        : {
            error:       (r.reason as Error)?.message ?? 'Generation failed',
            productName: orderedProducts[i]?.name ?? `Product ${i + 1}`,
          },
    );

  const anySucceeded = sessions.some((s) => !('error' in s));
  if (!anySucceeded) {
    // Surface the first individual error so the UI can show something meaningful
    const firstError = (sessions.find((s) => 'error' in s) as any)?.error ?? 'All generations failed';
    console.error('[copy-ad] All generations failed. First error:', firstError);
    return NextResponse.json({ error: firstError, sessions }, { status: 500 });
  }

  return NextResponse.json({
    groupId,
    referenceImageUrl,
    sessions,
    templateName:     parsed.name,
    templateCategory: parsed.category,
    templateText:     parsed.template,
  });
}
