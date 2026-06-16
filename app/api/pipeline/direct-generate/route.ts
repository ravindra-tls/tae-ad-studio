/**
 * POST /api/pipeline/direct-generate
 *
 * Streamlined 2-stage pipeline: concept → GPT Image-2.
 *
 * Stage 1 (prompt): Claude reads concept + brief + product and writes a
 * comprehensive GPT Image-2 prompt that includes ALL ad text (headline,
 * subheading, CTA) rendered directly in the image.
 *
 * Stage 2 (render): GPT Image-2 generates the full ad creative with
 * text baked in. No separate copy/visual/critique stages needed.
 *
 * Product reference images are ALWAYS used — the product that appears
 * in the ad must match the actual product, not a random bottle/container.
 *
 * SSE format matches /api/pipeline/generate for client compatibility.
 */

import { randomUUID } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { imageProvider, getGeneratedFileExtension } from '@/lib/image-providers';
import { resolveReferenceImages } from '@/lib/storage/reference-images';
import type { Brief, Concept, Product, ProductImage, ProductContext, ColorEntry } from '@/types';
import type { AspectRatio } from '@/lib/pipeline/schemas/visual';
import type { StageProgress } from '@/lib/pipeline/types';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const RequestBody = z.object({
  concept_id:     z.string().uuid(),
  aspect_ratio:   z.enum(['1:1', '4:5', '9:16', '16:9', '3:4']).default('1:1'),
  // use_references kept for API compat but product refs are always resolved and passed.
  use_references: z.boolean().optional().default(true),
});

type WireEvent =
  | { type: 'pipeline_start'; concept_id: string; run_id: string; aspect_ratio: AspectRatio }
  | { type: 'stage_start'; stage: string; at: number }
  | { type: 'stage_complete'; stage: string; durationMs: number; output: Record<string, unknown> }
  | { type: 'stage_error'; stage: string; error: string }
  | { type: 'done'; status: 'completed' | 'failed'; generated_image_id?: string; image_url?: string; trace: StageProgress[]; error?: string };

function encodeSSE(event: WireEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

export async function POST(request: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Validate body ─────────────────────────────────────────────────────────
  let parsed: z.infer<typeof RequestBody>;
  try {
    parsed = RequestBody.parse(await request.json());
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid request body';
    return new Response(JSON.stringify({ error: msg }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const aspectRatio = parsed.aspect_ratio as AspectRatio;

  // ── Service client + usage cap ────────────────────────────────────────────
  const service = await createServiceClient();
  const { data: profile } = await service
    .from('profiles').select('usage_count, usage_cap').eq('id', user.id).single();

  if (!profile) {
    return new Response(JSON.stringify({ error: 'Profile not found' }), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }
  if (profile.usage_count >= profile.usage_cap) {
    return new Response(JSON.stringify({
      error: 'Weekly generation limit reached.',
      used: profile.usage_count, cap: profile.usage_cap,
    }), { status: 429, headers: { 'Content-Type': 'application/json' } });
  }

  // ── Ownership verification ────────────────────────────────────────────────
  const { data: conceptRow, error: conceptError } = await service
    .from('concepts')
    .select('*, brief:briefs!inner(session:sessions!inner(user_id))')
    .eq('id', parsed.concept_id)
    .single();

  if (
    conceptError || !conceptRow ||
    (conceptRow as unknown as { brief: { session: { user_id: string } } }).brief.session.user_id !== user.id
  ) {
    return new Response(JSON.stringify({ error: 'Concept not found or not accessible' }), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }
  const concept = conceptRow as Concept;

  if (!concept.brief_id) {
    return new Response(JSON.stringify({ error: 'Concept has no associated brief' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Load brief + product ──────────────────────────────────────────────────
  const [{ data: briefRow, error: briefError }, productImagesResult] = await Promise.all([
    service.from('briefs').select('*').eq('id', concept.brief_id).single(),
    // Fetch product images — we'll need the product_id from the brief, so this is a placeholder.
    // The real fetch happens below once we have the product.
    Promise.resolve({ data: null as null }),
  ]);

  if (briefError || !briefRow) {
    return new Response(JSON.stringify({ error: 'Brief not found for concept' }), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }
  const brief = briefRow as Brief;
  void productImagesResult; // unused; real fetch below with product_id

  const { data: productRow, error: productError } = await service
    .from('products').select('*').eq('id', brief.product_id).single();

  if (productError || !productRow) {
    return new Response(JSON.stringify({ error: 'Product not found for brief' }), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }
  const product = productRow as Product;

  // ── Fetch + resolve product reference images (ALWAYS — not gated by flag) ─
  // These ensure the ad shows the real product, not a hallucinated bottle.
  const { data: rawProductImages } = await service
    .from('product_images')
    .select('*')
    .eq('product_id', product.id)
    .order('is_reference', { ascending: false })
    .limit(6);

  const resolvedProductImages = await resolveReferenceImages(
    (rawProductImages ?? []) as ProductImage[]
  );
  const referenceImageUrls = resolvedProductImages
    .map((img) => img.resolved_url)
    .filter((url): url is string => !!url);

  // ── Provider + model ──────────────────────────────────────────────────────
  const activeProvider = (process.env.IMAGE_PROVIDER || 'openai').toLowerCase();
  const modelId =
    activeProvider === 'xai'    ? (process.env.XAI_MODEL_ID        || 'grok-imagine-image')        :
    activeProvider === 'vertex' ? (process.env.VERTEX_AI_MODEL_ID  || 'gemini-3-pro-image-preview') :
                                  (process.env.OPENAI_MODEL_ID     || 'gpt-image-2');
  const apiProvider = activeProvider === 'vertex' ? 'vertex-ai' : activeProvider;

  const runId = randomUUID();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const trace: StageProgress[] = [];
      const emit = (ev: WireEvent) => controller.enqueue(encodeSSE(ev));

      async function runStage<T>(
        stageName: string,
        fn: () => Promise<T>,
        outputSelector: (result: T) => Record<string, unknown>,
      ): Promise<T> {
        const started = Date.now();
        emit({ type: 'stage_start', stage: stageName, at: started });
        try {
          const result = await fn();
          emit({ type: 'stage_complete', stage: stageName, durationMs: Date.now() - started, output: outputSelector(result) });
          return result;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          emit({ type: 'stage_error', stage: stageName, error: msg });
          throw err;
        }
      }

      async function uploadWithRetry(path: string, bytes: Buffer, contentType: string): Promise<void> {
        let lastErr: unknown = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          const { error } = await service.storage
            .from('generated-images').upload(path, bytes, { contentType, upsert: true });
          if (!error) return;
          lastErr = error;
          if (attempt < 3) await new Promise((r) => setTimeout(r, 500 * attempt ** 2));
        }
        throw new Error(`Image upload failed: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`);
      }

      emit({ type: 'pipeline_start', concept_id: concept.id, run_id: runId, aspect_ratio: aspectRatio });

      try {
        // ── Stage 1: prompt assembly ──────────────────────────────────────

        const conceptStructured = (concept.structured ?? {}) as Record<string, unknown>;
        const briefStructured   = (brief.structured   ?? {}) as Record<string, unknown>;
        const briefAudience     = (briefStructured.audience ?? {}) as Record<string, unknown>;
        const briefOffer        = (briefStructured.offer    ?? {}) as Record<string, unknown>;
        const briefMeta         = (briefStructured._meta    ?? {}) as Record<string, unknown>;

        // Product visual context — colors, packaging, physical description
        const ctx          = (product.context ?? {}) as ProductContext;
        const palette      = (product.color_palette ?? []) as ColorEntry[];
        const paletteStr   = palette.length > 0
          ? palette.map((c) => `${c.name}: ${c.hex}${c.usage ? ` (${c.usage})` : ''}`).join(', ')
          : '';
        const primaryColor = ctx.primary_color
          ? `${ctx.primary_color.name} (${ctx.primary_color.hex})`
          : paletteStr.split(',')[0] ?? '';
        const accentColor  = ctx.accent_color
          ? `${ctx.accent_color.name} (${ctx.accent_color.hex})`
          : '';

        const productVisualSection = [
          `PRODUCT VISUAL — CRITICAL (the image MUST show this exact product, not a generic substitute):`,
          `Product name: ${product.name}`,
          product.sub_brand ? `Sub-brand: ${product.sub_brand}` : '',
          ctx.product_category ? `Category: ${ctx.product_category}` : '',
          ctx.product_description ? `Physical appearance: ${ctx.product_description}` : product.description ? `Description: ${product.description}` : '',
          primaryColor ? `Primary brand color: ${primaryColor}` : '',
          accentColor  ? `Accent color: ${accentColor}` : '',
          paletteStr   ? `Full palette: ${paletteStr}` : '',
          ctx.tagline  ? `Brand tagline: ${ctx.tagline}` : '',
          referenceImageUrls.length > 0
            ? `Reference images: ${referenceImageUrls.length} product image(s) provided. The product in the ad MUST visually match these reference images exactly — same packaging, same form factor, same colors. Do NOT invent, substitute, or alter the product appearance.`
            : `No reference image on file — show the ${product.name} product faithfully based on the description above. Do NOT show a random or generic bottle/container.`,
        ].filter(Boolean).join('\n');

        const personaContext = briefMeta.persona_name
          ? `\nTARGET PERSONA: ${briefMeta.persona_name as string}${briefMeta.funnel_stage ? ` | ${(briefMeta.funnel_stage as string).toUpperCase()}` : ''}`
          : '';

        const userMessage = `AD CONCEPT:
Title: ${(conceptStructured.title as string | undefined) ?? concept.title ?? ''}
Hook archetype: ${(conceptStructured.hook_archetype as string | undefined) ?? ''}
Description: ${(conceptStructured.description as string | undefined) ?? ''}
Visual direction: ${(conceptStructured.visual_direction as string | undefined) ?? ''}
Copy direction: ${(conceptStructured.copy_direction as string | undefined) ?? ''}

CREATIVE BRIEF:
Audience: ${(briefAudience.primary as string | undefined) ?? ''}
Pains: ${Array.isArray(briefAudience.pains) ? (briefAudience.pains as string[]).join('; ') : ''}
Core promise: ${(briefOffer.core_promise as string | undefined) ?? ''}
Mechanism: ${(briefOffer.mechanism as string | undefined) ?? ''}
CTA direction: ${(briefOffer.cta as string | undefined) ?? ''}
Tone: ${(briefStructured.tone_direction as string | undefined) ?? ''}
Hypothesis: ${(briefStructured.hypothesis as string | undefined) ?? ''}
${briefStructured.narrative_brief ? `\nNARRATIVE BRIEF:\n${briefStructured.narrative_brief as string}` : ''}${personaContext}

${productVisualSection}

BRAND:
Brand name: ${product.brand}
${Array.isArray(product.compliance_rules) && product.compliance_rules.length > 0
  ? `COMPLIANCE (hard rules — never violate): ${(product.compliance_rules as string[]).join('; ')}`
  : ''}
Key ingredients: ${(product.ingredients as Array<{ name: string; key: boolean }>)?.filter((i) => i.key).map((i) => i.name).join(', ') ?? ''}

ASPECT RATIO: ${aspectRatio}

Write the GPT Image-2 prompt now:`;

        let assembledPrompt = '';

        await runStage(
          'prompt',
          async () => {
            const anthropic = new Anthropic();
            const message = await anthropic.messages.create({
              model: 'claude-sonnet-4-5',
              max_tokens: 1400,
              system: `You are an expert creative director and AI image prompt engineer for Meta performance ads.

Your job: read an ad concept and product context, then write a single, detailed GPT Image-2 prompt that produces a complete, ready-to-publish Meta ad — with ALL text (headline, subheading, CTA) rendered directly and clearly in the image.

CRITICAL PRODUCT RULES (non-negotiable):
- The product shown MUST be the EXACT product described — not a random bottle, not a generic container, not a similar-looking product. If reference images are provided, the generated product must match them.
- Never invent packaging, labels, or product colours that weren't specified.
- The product should appear naturally in the scene, not Photoshopped or floating.

Output ONLY the image prompt text. No explanation, no markdown, no preamble.

Structure your output in this exact order:
1. Scene & subject (2-3 sentences): the person, setting, lighting, mood — grounded in the concept's visual direction and the target persona's life
2. PRODUCT IN SCENE (1 sentence): how the exact product appears in the frame — held, displayed, in the background — with its real visual appearance described
3. TEXT IN IMAGE: each element on its own line with label:
   HEADLINE: [exact text, 4-7 words, large bold font]
   SUBHEADING: [exact text, 8-14 words, clearly readable]
   CTA: [exact text, 2-5 words, in a button or strip]
4. COMPOSITION: where text zones sit (e.g. "top 30% for headline overlay, bottom 12% for CTA strip")
5. STYLE: lighting quality, colour palette, film grain/texture, mood (2 sentences)
6. Avoid: [comma-separated negative terms — always include: no text errors, no distorted hands, no random products, no generic bottles]

Write the prompt now:`,
              messages: [{ role: 'user', content: userMessage }],
            });

            const textBlock = message.content.find((b) => b.type === 'text');
            assembledPrompt = textBlock?.type === 'text' ? textBlock.text.trim() : '';
            return assembledPrompt;
          },
          (prompt) => ({ prompt_length: typeof prompt === 'string' ? prompt.length : 0 }),
        );

        // ── Stage 2: render ───────────────────────────────────────────────

        const { data: genImage, error: genErr } = await service
          .from('generated_images')
          .insert({
            session_id:   brief.session_id,
            prompt_used:  assembledPrompt,
            aspect_ratio: aspectRatio,
            api_provider: apiProvider,
            model_id:     modelId,
            status:       'queued',
            concept_id:   concept.id,
            brief_id:     concept.brief_id,
          })
          .select()
          .single();

        if (genErr || !genImage) {
          throw new Error(`Failed to create generated_image row: ${genErr?.message ?? 'unknown'}`);
        }

        const renderResult = await runStage(
          'render',
          () => imageProvider.submitGeneration({
            prompt:             assembledPrompt,
            aspectRatio,
            modelId,
            // Always pass product reference images so the model renders the correct product.
            referenceImageUrls: referenceImageUrls.length > 0 ? referenceImageUrls : undefined,
          }),
          (out) => ({ generated_image_id: genImage.id, status: out.status }),
        );

        let finalUrl: string | undefined;

        if (renderResult.status === 'completed' && renderResult.image) {
          const rawBytes = Buffer.from(renderResult.image.data, 'base64');
          const ext      = getGeneratedFileExtension(renderResult.image.mimeType);
          const filePath = `${user.id}/${genImage.id}.${ext}`;

          await uploadWithRetry(filePath, rawBytes, renderResult.image.mimeType);

          const { data: pubData } = service.storage.from('generated-images').getPublicUrl(filePath);
          finalUrl = pubData.publicUrl;

          await service.from('generated_images').update({
            request_id: renderResult.requestId ?? null,
            status:     'completed',
            image_url:  finalUrl,
          }).eq('id', genImage.id);

          const { error: rpcErr } = await service.rpc('increment_usage', { user_id: user.id });
          if (rpcErr) console.error('[pipeline/direct-generate] increment_usage failed:', rpcErr.message);
        } else {
          await service.from('generated_images').update({
            request_id:    renderResult.requestId ?? null,
            status:        renderResult.status === 'nsfw' ? 'nsfw' : 'failed',
            error_message: renderResult.error ?? 'Render failed',
          }).eq('id', genImage.id);
          throw new Error(renderResult.error ?? 'Image generation failed');
        }

        emit({ type: 'done', status: 'completed', generated_image_id: genImage.id, image_url: finalUrl, trace });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[pipeline/direct-generate] fatal:', msg);
        emit({ type: 'done', status: 'failed', error: msg, trace });
      } finally {
        controller.close();
      }
    },
    cancel() {},
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type':    'text/event-stream',
      'Cache-Control':   'no-cache, no-transform',
      'Connection':      'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
