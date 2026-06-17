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
import type { AspectRatio } from '@/lib/hooks/use-generation-stream';

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
    imageBase64?: string;
    mimeType?: string;
    references?: Array<{ imageBase64: string; mimeType: string }>;
    productIds: string[];
  };

  const { productIds } = body;

  // Normalise: support both legacy single-image and new multi-image formats
  const refArray: Array<{ imageBase64: string; mimeType: string }> =
    Array.isArray(body.references) && body.references.length > 0
      ? body.references
      : body.imageBase64
        ? [{ imageBase64: body.imageBase64, mimeType: body.mimeType ?? 'image/jpeg' }]
        : [];

  if (refArray.length === 0) return NextResponse.json({ error: 'Missing reference image' }, { status: 400 });
  if (refArray.length > 5)   return NextResponse.json({ error: 'Maximum 5 reference images allowed' }, { status: 400 });
  if (!productIds?.length)   return NextResponse.json({ error: 'Select at least one product' }, { status: 400 });

  const totalGenerations = refArray.length * productIds.length;
  if (profile.usage_count + totalGenerations > profile.usage_cap) {
    return NextResponse.json(
      {
        error: `Not enough credits. Need ${totalGenerations}` +
          (refArray.length > 1 ? ` (${refArray.length} refs × ${productIds.length} products)` : '') +
          `, have ${profile.usage_cap - profile.usage_count}.`,
      },
      { status: 429 },
    );
  }

  if (!SKILL_CONTENT) {
    return NextResponse.json({ error: 'Template skill not loaded' }, { status: 500 });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const groupId   = crypto.randomUUID();

  // ── 1 + 2. For each reference: upload image + extract template (sequential
  //           to stay under Claude rate limits; each call is fast ~2–4 s) ──

  interface RefResult { template: ParsedTemplate; referenceImageUrl: string | null; }

  const refResults: RefResult[] = [];

  for (let idx = 0; idx < refArray.length; idx++) {
    const ref       = refArray[idx];
    const base64Data = ref.imageBase64.includes(',') ? ref.imageBase64.split(',')[1] : ref.imageBase64;
    const mediaType  = ((ref.mimeType || 'image/jpeg').split(';')[0]) as
      'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

    // Upload reference image to storage
    const imageBytes = Buffer.from(base64Data, 'base64');
    const fileExt    = ref.mimeType?.includes('png') ? 'png' : ref.mimeType?.includes('webp') ? 'webp' : 'jpg';
    const refPath    = `copy-ad/${groupId}/reference-${idx}.${fileExt}`;

    let referenceImageUrl: string | null = null;
    const { error: refUpErr } = await service.storage
      .from('generated-images')
      .upload(refPath, imageBytes, { contentType: mediaType, upsert: true });

    if (!refUpErr) {
      const { data: pub } = service.storage.from('generated-images').getPublicUrl(refPath);
      referenceImageUrl = pub.publicUrl;
    } else {
      console.warn(`[copy-ad] Reference ${idx} upload failed:`, refUpErr.message);
    }

    // Extract template via Claude
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
      console.error(`[copy-ad] Template extraction error (ref ${idx}):`, err.message);
      const msg: string = err.message ?? '';
      const friendlyError =
        msg.includes('usage limits') || msg.includes('rate_limit') || msg.includes('429')
          ? 'AI service usage limit reached. Please try again after your billing period resets.'
          : msg.includes('401') || msg.includes('authentication')
          ? 'AI service authentication error. Check the ANTHROPIC_API_KEY environment variable.'
          : `AI service unavailable while processing reference ${idx + 1}. Please try again.`;
      return NextResponse.json({ error: friendlyError }, { status: 500 });
    }

    const tmpl = parseSkillOutput(raw);
    if (!tmpl) {
      console.error(`[copy-ad] Failed to parse skill output for ref ${idx}:`, raw.slice(0, 300));
      return NextResponse.json(
        { error: `Could not extract a template from reference image ${idx + 1}. Try a clearer ad image.` },
        { status: 422 },
      );
    }

    refResults.push({ template: tmpl, referenceImageUrl });
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

  // ── 5. Generate one image per (reference × product) pair ──

  const generateOne = async (product: Product, tmpl: ParsedTemplate, refUrl: string | null) => {
    // Create session with copy_ad metadata
    const sessionName = `${product.name} — Copy Ad · ${new Date().toLocaleDateString()}`;
    const { data: session, error: sessErr } = await service
      .from('sessions')
      .insert({
        user_id:             user.id,
        product_id:          product.id,
        name:                sessionName,
        source:              'copy_ad',
        reference_image_url: refUrl,
        copy_ad_group_id:    groupId,
      })
      .select('id')
      .single();

    if (sessErr || !session) {
      throw new Error(`Session create failed: ${sessErr?.message ?? 'unknown'}`);
    }

    // Fill + enrich + assemble prompt
    const filled      = fillTemplate(tmpl.template, product);
    const enriched    = await aiEnrichPrompt(filled, product);
    const finalPrompt = assemblePrompt(product, enriched, tmpl.aspect_ratio);

    // Product reference images
    const rawImages = ((product as any).product_images ?? []) as ProductImage[];
    const resolved  = await resolveReferenceImages(rawImages);
    const productRefImages: string[] = [
      ...resolved.map((img: any) => img.resolved_url),
      ...(product.thumbnail_url ? [product.thumbnail_url] : []),
    ].slice(0, 4);

    // DB record (queued)
    const { data: genRecord, error: genErr } = await service
      .from('generated_images')
      .insert({
        session_id:   session.id,
        prompt_used:  finalPrompt,
        aspect_ratio: tmpl.aspect_ratio,
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
      aspectRatio:        tmpl.aspect_ratio as AspectRatio,
      referenceImageUrls: productRefImages.length ? productRefImages : undefined,
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

  // Dispatch all (reference × product) combos in parallel
  const allTasks = refResults.flatMap(({ template, referenceImageUrl: refUrl }) =>
    orderedProducts.map((product) => generateOne(product, template, refUrl))
  );
  const settled = await Promise.allSettled(allTasks);

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

  // Build task→product mapping for error labels (tasks are ref-major order)
  const taskProducts = refResults.flatMap(() => orderedProducts);

  const sessions: (SessionResult | { error: string; productName: string })[] =
    settled.map((r, i) =>
      r.status === 'fulfilled'
        ? r.value
        : {
            error:       (r.reason as Error)?.message ?? 'Generation failed',
            productName: taskProducts[i]?.name ?? `Product ${i + 1}`,
          },
    );

  const anySucceeded = sessions.some((s) => !('error' in s));
  if (!anySucceeded) {
    const firstError = (sessions.find((s) => 'error' in s) as any)?.error ?? 'All generations failed';
    console.error('[copy-ad] All generations failed. First error:', firstError);
    return NextResponse.json({ error: firstError, sessions }, { status: 500 });
  }

  return NextResponse.json({
    groupId,
    referenceImageUrl:  refResults[0]?.referenceImageUrl ?? null,
    referenceImageUrls: refResults.map(r => r.referenceImageUrl),
    sessions,
    templateName:     refResults[0]?.template.name ?? '',
    templateCategory: refResults[0]?.template.category ?? '',
    templateText:     refResults[0]?.template.template ?? '',
  });
}
