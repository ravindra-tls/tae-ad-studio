/**
 * POST /api/pipeline/template-generate
 *
 * 3-stage pipeline: template_select → fill → render.
 *
 * Stage 1 (template_select): Claude Haiku reads the brief + product and picks
 * the best-matching ad template from the database.
 *
 * Stage 2 (fill): Fills the selected template with product data via
 * fillTemplate → aiEnrichPrompt → assemblePrompt.
 *
 * Stage 3 (render): GPT Image-2 (or active provider) generates the final ad.
 *
 * SSE format matches /api/pipeline/direct-generate for client compatibility.
 */

import { randomUUID } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { imageProvider, getGeneratedFileExtension } from '@/lib/image-providers';
import { resolveReferenceImages } from '@/lib/storage/reference-images';
import { fillTemplate, aiEnrichPrompt, assemblePrompt } from '@/lib/prompt-assembler';
import type { Brief, Product, ProductImage, PromptTemplate } from '@/types';
import type { AspectRatio } from '@/lib/pipeline/schemas/visual';
import type { StageProgress } from '@/lib/pipeline/types';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const RequestBody = z.object({
  brief_id:       z.string().uuid(),
  aspect_ratio:   z.enum(['1:1', '4:5', '9:16', '16:9', '3:4']).default('1:1'),
  use_references: z.boolean().optional().default(true),
});

type WireEvent =
  | { type: 'pipeline_start'; concept_id: string; run_id: string; aspect_ratio: AspectRatio }
  | { type: 'stage_start'; stage: string; at: number }
  | { type: 'stage_complete'; stage: string; durationMs: number; output: Record<string, unknown> }
  | { type: 'stage_error'; stage: string; error: string }
  | { type: 'template_selected'; template_id: string; template_name: string; template_category: string; rationale: string }
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

  const requestedAspectRatio = parsed.aspect_ratio as AspectRatio;

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

  // ── Ownership verification: brief → session → user_id ────────────────────
  const { data: briefRow, error: briefError } = await service
    .from('briefs')
    .select('*, session:sessions!inner(user_id)')
    .eq('id', parsed.brief_id)
    .single();

  if (
    briefError || !briefRow ||
    (briefRow as unknown as { session: { user_id: string } }).session.user_id !== user.id
  ) {
    return new Response(JSON.stringify({ error: 'Brief not found or not accessible' }), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }
  const brief = briefRow as Brief;

  // ── Load product ──────────────────────────────────────────────────────────
  const { data: productRow, error: productError } = await service
    .from('products').select('*').eq('id', brief.product_id).single();

  if (productError || !productRow) {
    return new Response(JSON.stringify({ error: 'Product not found for brief' }), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }
  const product = productRow as Product;

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

      // Use brief.id as concept_id for hook compatibility
      emit({ type: 'pipeline_start', concept_id: brief.id, run_id: runId, aspect_ratio: requestedAspectRatio });

      try {
        // ── Stage 1: template_select ──────────────────────────────────────

        const briefStructured = (brief.structured ?? {}) as Record<string, unknown>;

        // Fetch all templates (limit 50)
        const { data: templateRows } = await service
          .from('prompt_templates')
          .select('id, number, name, category, template, default_aspect_ratio')
          .limit(50);

        const templates = (templateRows ?? []) as Pick<PromptTemplate, 'id' | 'number' | 'name' | 'category' | 'template' | 'default_aspect_ratio'>[];

        let selectedTemplate: typeof templates[number] | null = null;
        let selectionResult: { template_id: string; template_name: string; rationale: string } = {
          template_id: '',
          template_name: '',
          rationale: '',
        };

        await runStage(
          'template_select',
          async () => {
            if (templates.length === 0) {
              throw new Error('No prompt templates found in database');
            }

            const anthropic = new Anthropic();
            const templateList = templates
              .map((t) => `${t.id} | ${t.name} | ${t.category} | ${t.default_aspect_ratio}`)
              .join('\n');

            const userMessage = `BRIEF:
Audience: ${(briefStructured.audience as any)?.primary ?? ''}
Core promise: ${(briefStructured.offer as any)?.core_promise ?? ''}
Tone direction: ${(briefStructured.tone_direction as string | undefined) ?? ''}
Hypothesis: ${(briefStructured.hypothesis as string | undefined) ?? ''}
${briefStructured.narrative_brief ? `Narrative: ${briefStructured.narrative_brief as string}` : ''}
Funnel stage: ${((briefStructured._meta as any)?.funnel_stage ?? '').toUpperCase() || 'unknown'}
Persona: ${(briefStructured._meta as any)?.persona_name ?? ''}

PRODUCT: ${product.name} — ${product.description ?? ''}

AVAILABLE TEMPLATES (id | name | category | default_aspect_ratio):
${templateList}

Select the template that best matches this brief's hook archetype, emotional tone, and funnel stage. Return JSON now:`;

            const message = await anthropic.messages.create({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 600,
              system: `You are a senior performance-marketing strategist. Select the single best ad template for the given brief.
Return ONLY valid JSON with no markdown: {"template_id":"...","template_name":"...","rationale":"1-2 sentences explaining the match"}`,
              messages: [{ role: 'user', content: userMessage }],
            });

            const textBlock = message.content.find((b) => b.type === 'text');
            const rawText = textBlock?.type === 'text' ? textBlock.text.trim() : '{}';

            try {
              const jsonStr = rawText
                .replace(/^```(?:json)?\n?/i, '')
                .replace(/\n?```$/i, '')
                .trim();
              const parsed = JSON.parse(jsonStr) as { template_id?: string; template_name?: string; rationale?: string };
              selectionResult = {
                template_id: parsed.template_id ?? '',
                template_name: parsed.template_name ?? '',
                rationale: parsed.rationale ?? '',
              };

              // Find the matching template
              const found = templates.find((t) => t.id === selectionResult.template_id);
              selectedTemplate = found ?? templates[0]; // fallback to first if not found
            } catch {
              // JSON parse failure — fallback to first template
              selectedTemplate = templates[0];
              selectionResult = {
                template_id: templates[0].id,
                template_name: templates[0].name,
                rationale: 'Fallback: selected first available template.',
              };
            }

            return selectionResult;
          },
          (result) => ({
            template_name: selectedTemplate?.name ?? '',
            template_category: selectedTemplate?.category ?? '',
            rationale: result.rationale,
          }),
        );

        if (!selectedTemplate) {
          throw new Error('Template selection failed — no template available');
        }

        // Emit the template_selected event after stage_complete
        emit({
          type: 'template_selected',
          template_id: selectedTemplate.id,
          template_name: selectedTemplate.name,
          template_category: selectedTemplate.category,
          rationale: selectionResult.rationale,
        });

        // Prefer the template's own default_aspect_ratio over the caller's request
        const effectiveAspectRatio = (selectedTemplate.default_aspect_ratio || requestedAspectRatio) as AspectRatio;

        // ── Stage 2: fill ─────────────────────────────────────────────────

        let finalPrompt = '';

        await runStage(
          'fill',
          async () => {
            const filled = fillTemplate(selectedTemplate!.template, product);
            const enriched = await aiEnrichPrompt(filled, product);
            finalPrompt = assemblePrompt(product, enriched, effectiveAspectRatio);
            return finalPrompt;
          },
          (prompt) => ({ prompt_length: typeof prompt === 'string' ? prompt.length : 0 }),
        );

        // ── Stage 3: render ───────────────────────────────────────────────

        // Fetch + resolve product reference images
        const { data: rawProductImages } = await service
          .from('product_images')
          .select('*')
          .eq('product_id', product.id)
          .order('is_reference', { ascending: false })
          .limit(6);

        const resolvedProductImages = await resolveReferenceImages(
          (rawProductImages ?? []) as ProductImage[]
        );
        const resolvedUrls = resolvedProductImages
          .map((img) => img.resolved_url)
          .filter((url): url is string => !!url);

        // Insert generated_images row
        const { data: genImage, error: genErr } = await service
          .from('generated_images')
          .insert({
            session_id:   brief.session_id,
            prompt_used:  finalPrompt,
            aspect_ratio: effectiveAspectRatio,
            api_provider: apiProvider,
            model_id:     modelId,
            status:       'queued',
            brief_id:     brief.id,
            template_id:  selectedTemplate.id,
          })
          .select()
          .single();

        if (genErr || !genImage) {
          throw new Error(`Failed to create generated_image row: ${genErr?.message ?? 'unknown'}`);
        }

        const renderResult = await runStage(
          'render',
          () => imageProvider.submitGeneration({
            prompt:             finalPrompt,
            aspectRatio:        effectiveAspectRatio,
            modelId,
            referenceImageUrls: resolvedUrls.length > 0 ? resolvedUrls : undefined,
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
          if (rpcErr) console.error('[pipeline/template-generate] increment_usage failed:', rpcErr.message);
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
        console.error('[pipeline/template-generate] fatal:', msg);
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
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache, no-transform',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
