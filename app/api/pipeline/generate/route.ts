/**
 * POST /api/pipeline/generate
 *
 * Orchestrator + SSE stream for checkpoint 3 onward.
 *
 * Given a concept the marketer selected at checkpoint 2, this route runs
 * the remaining pipeline end-to-end:
 *
 *     copy → visual → render → critique → [refine (copy|visual)] → [re-render if visual refined]
 *
 * It streams stage transitions back to the browser via Server-Sent Events
 * so the "Show my thinking" drawer (task #21) can surface each step live
 * instead of waiting 30-60s for a blob of JSON.
 *
 * ─ Why one orchestrator, not sequential client-side fetches?
 *   Each individual /api/pipeline/{copy,visual,critique} route already
 *   exists and works, but chaining them from the client means four HTTPS
 *   round trips plus client-side state shuttling the IDs between each.
 *   This route shortcuts all of that: one stream, one fan-out, one
 *   consistent trace log. The individual routes stay for debugging and
 *   for scenarios where you only want one stage (e.g. re-running visual
 *   after editing copy).
 *
 * ─ SSE format (single message type, JSON payload discriminated by `type`):
 *     data: {"type":"pipeline_start","concept_id":"…","run_id":"…"}
 *     data: {"type":"stage_start","stage":"copy","at":1745000000000}
 *     data: {"type":"stage_complete","stage":"copy","durationMs":1800,"output":{"copy_block_id":"…"}}
 *     data: {"type":"stage_error","stage":"visual","error":"…"}
 *     data: {"type":"done","status":"completed","generated_image_id":"…","image_url":"…"}
 *
 *   Client uses EventSource or fetch+ReadableStream reader; every event
 *   is a plain `data:` line so `EventSource.onmessage` sees all of them.
 *
 * ─ Request body:
 *     {
 *       concept_id:    uuid,            required
 *       aspect_ratio:  "1:1" | "4:5" | "9:16" | "16:9" | "3:4" (see AspectRatio schema)
 *       alternates?:   0-5              copy stage alternate count (default 3)
 *       judge_notes?:  string (max 2000)
 *       auto_refine?:  boolean          default true
 *     }
 *
 * ─ Auth: user must own the concept (via RLS chain concept → brief → session).
 *   Usage cap is enforced ONCE up front — an over-cap caller gets a 429 and
 *   the stream never opens.
 *
 * ─ Usage accounting: we bump usage_count ONE time on successful initial
 *   render. A re-render triggered by a visual refine does NOT double-count
 *   — the marketer asked for one final image.
 */

import { randomUUID } from 'crypto';
import { z } from 'zod';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getBrandConfig } from '@/lib/brand-config';
import { copyStage } from '@/lib/pipeline/stages/copy';
import { visualStage } from '@/lib/pipeline/stages/visual';
import { renderStage } from '@/lib/pipeline/stages/render';
import {
  critiqueStage,
  refineCopyStage,
  refineVisualStage,
} from '@/lib/pipeline/stages/critique';
import { getGeneratedFileExtension } from '@/lib/image-providers';
import { resolveReferenceImages } from '@/lib/storage/reference-images';
import type { AspectRatio } from '@/lib/pipeline/schemas/visual';
import type { StageProgress } from '@/lib/pipeline/types';
import type {
  Brief,
  Concept,
  Product,
  ProductImage,
} from '@/types';

// Full pipeline = 3 Claude calls + 1-2 image generations. 5 min is generous;
// real runs are typically 30-60s. Leaving the ceiling high so critique/refine
// have headroom on a slow day.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const RequestBody = z.object({
  concept_id: z.string().uuid(),
  aspect_ratio: z.enum(['1:1', '4:5', '9:16', '16:9', '3:4']),
  alternates: z.number().int().min(0).max(5).optional(),
  judge_notes: z.string().max(2000).optional(),
  auto_refine: z.boolean().optional(),
});

/**
 * Wire event shapes. Kept deliberately thin — the drawer client uses IDs
 * to fetch full rows lazily rather than trying to re-render the whole
 * pipeline state from the stream.
 */
type WireEvent =
  | { type: 'pipeline_start'; concept_id: string; run_id: string; aspect_ratio: AspectRatio }
  | { type: 'stage_start'; stage: string; at: number }
  | { type: 'stage_complete'; stage: string; durationMs: number; output: Record<string, unknown> }
  | { type: 'stage_error'; stage: string; error: string }
  | { type: 'done'; status: 'completed' | 'failed'; generated_image_id?: string; image_url?: string; trace: StageProgress[]; error?: string };

/** SSE frame encoder. Each event is a single `data:` line followed by blank line. */
function encodeSSE(event: WireEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

export async function POST(request: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Validate body ─────────────────────────────────────────────────────────
  let parsed: z.infer<typeof RequestBody>;
  try {
    parsed = RequestBody.parse(await request.json());
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid request body';
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const autoRefine = parsed.auto_refine ?? true;
  const aspectRatio = parsed.aspect_ratio as AspectRatio;

  // ── Usage cap check up front ─────────────────────────────────────────────
  // If the user is already at/over cap we refuse BEFORE opening the stream.
  // Opening an SSE with a 429 body is confusing to clients.
  const service = await createServiceClient();
  const { data: profile } = await service
    .from('profiles')
    .select('usage_count, usage_cap')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return new Response(JSON.stringify({ error: 'Profile not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (profile.usage_count >= profile.usage_cap) {
    return new Response(
      JSON.stringify({
        error: 'Weekly generation limit reached.',
        used: profile.usage_count,
        cap: profile.usage_cap,
      }),
      { status: 429, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // ── Ownership: concept via RLS ────────────────────────────────────────────
  const { data: conceptRow, error: conceptError } = await supabase
    .from('concepts')
    .select('*')
    .eq('id', parsed.concept_id)
    .single();

  if (conceptError || !conceptRow) {
    return new Response(
      JSON.stringify({ error: 'Concept not found or not accessible' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    );
  }
  const concept = conceptRow as Concept;

  // ── Load brief + product + brand via service client ──────────────────────
  const { data: briefRow, error: briefError } = await service
    .from('briefs')
    .select('*')
    .eq('id', concept.brief_id)
    .single();

  if (briefError || !briefRow) {
    return new Response(
      JSON.stringify({ error: 'Brief not found for concept' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    );
  }
  const brief = briefRow as Brief;

  const [{ data: productRow, error: productError }, brand] = await Promise.all([
    service.from('products').select('*').eq('id', brief.product_id).single(),
    getBrandConfig(),
  ]);

  if (productError || !productRow) {
    return new Response(
      JSON.stringify({ error: 'Product not found for brief' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    );
  }
  const product = productRow as Product;

  // Session ID — we persist generated_images against it. The session
  // is the marketer's workspace and owns the brief that owns the concept.
  const sessionId = brief.session_id;

  // ── Reference images: resolve signed URLs server-side ────────────────────
  // We do NOT trust a client-supplied referenceImageUrls list — signed URLs
  // could leak across sessions. Always mint fresh from product_images here.
  const { data: refImageRows } = await service
    .from('product_images')
    .select('*')
    .eq('product_id', product.id)
    .eq('is_reference', true);

  const resolvedRefs = await resolveReferenceImages(
    (refImageRows || []) as ProductImage[],
  );
  const referenceImageUrls = resolvedRefs.map((r) => r.resolved_url);

  // ── Open the SSE stream ──────────────────────────────────────────────────
  const runId = randomUUID();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const trace: StageProgress[] = [];
      const emit = (ev: WireEvent) => controller.enqueue(encodeSSE(ev));

      /**
       * Wrap a stage run with start/complete/error emission. `outputSelector`
       * picks which fields of the stage's output get published to the
       * client (keep the stream small — full structured JSON goes to DB).
       */
      async function runStage<T>(
        stageName: string,
        fn: () => Promise<T>,
        outputSelector: (result: T) => Record<string, unknown>,
      ): Promise<T> {
        const started = Date.now();
        emit({ type: 'stage_start', stage: stageName, at: started });
        try {
          const result = await fn();
          const duration = Date.now() - started;
          emit({
            type: 'stage_complete',
            stage: stageName,
            durationMs: duration,
            output: outputSelector(result),
          });
          return result;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          emit({ type: 'stage_error', stage: stageName, error: msg });
          throw err;
        }
      }

      emit({
        type: 'pipeline_start',
        concept_id: concept.id,
        run_id: runId,
        aspect_ratio: aspectRatio,
      });

      try {
        // ── Stage: copy ─────────────────────────────────────────────────────
        const copyOut = await runStage(
          'copy',
          () =>
            copyStage.run(
              {
                brief,
                concept,
                product,
                brand,
                alternates: parsed.alternates ?? 3,
              },
              trace,
            ),
          (out) => ({
            prompt_version: out.prompt_version,
            model: out.model,
          }),
        );

        const { data: copyRow, error: copyErr } = await service
          .from('copy_blocks')
          .insert({
            concept_id: concept.id,
            brief_id: brief.id,
            structured: {
              ...copyOut.structured,
              _meta: {
                prompt_version: copyOut.prompt_version,
                model: copyOut.model,
              },
            },
            prompt_version: copyOut.prompt_version,
            model: copyOut.model,
          })
          .select()
          .single();

        if (copyErr || !copyRow) {
          throw new Error(
            `Failed to persist copy: ${copyErr?.message ?? 'unknown'}`,
          );
        }

        // Send the ID now so the drawer can fetch the full row asynchronously.
        emit({
          type: 'stage_complete',
          stage: 'copy.persisted',
          durationMs: 0,
          output: { copy_block_id: copyRow.id },
        });

        // ── Stage: visual ───────────────────────────────────────────────────
        const visualOut = await runStage(
          'visual',
          () =>
            visualStage.run(
              {
                brief,
                concept,
                copy: { structured: copyRow.structured },
                product,
                brand,
                aspect_ratio: aspectRatio,
              },
              trace,
            ),
          (out) => ({
            prompt_version: out.prompt_version,
            model: out.model,
            aspect_ratio: out.aspect_ratio,
          }),
        );

        const { data: visualRow, error: visualErr } = await service
          .from('visual_specs')
          .insert({
            concept_id: concept.id,
            brief_id: brief.id,
            copy_block_id: copyRow.id,
            prompt_text: visualOut.prompt_text,
            aspect_ratio: visualOut.aspect_ratio,
            structured: {
              ...visualOut.structured,
              _meta: {
                prompt_version: visualOut.prompt_version,
                model: visualOut.model,
              },
            },
            prompt_version: visualOut.prompt_version,
            model: visualOut.model,
          })
          .select()
          .single();

        if (visualErr || !visualRow) {
          throw new Error(
            `Failed to persist visual: ${visualErr?.message ?? 'unknown'}`,
          );
        }

        emit({
          type: 'stage_complete',
          stage: 'visual.persisted',
          durationMs: 0,
          output: { visual_spec_id: visualRow.id },
        });

        // ── Stage: render (first pass) ──────────────────────────────────────
        // Create the generated_images row FIRST so failures still leave a
        // trace in the DB (parity with /api/generate/submit).
        const modelId = process.env.XAI_MODEL_ID || 'grok-imagine-image';
        const { data: genImage, error: genErr } = await service
          .from('generated_images')
          .insert({
            session_id: sessionId,
            brief_id: brief.id,
            concept_id: concept.id,
            prompt_used: visualRow.prompt_text,
            aspect_ratio: aspectRatio,
            api_provider: 'xai',
            model_id: modelId,
            status: 'queued',
          })
          .select()
          .single();

        if (genErr || !genImage) {
          throw new Error(
            `Failed to create generated_image row: ${genErr?.message ?? 'unknown'}`,
          );
        }

        const renderResult = await runStage(
          'render',
          () =>
            renderStage.run(
              {
                prompt: visualRow.prompt_text,
                aspectRatio,
                referenceImageUrls,
                modelId,
              },
              trace,
            ),
          (out) => ({
            generated_image_id: genImage.id,
            status: out.status,
          }),
        );

        let finalImageUrl: string | undefined;

        if (renderResult.status === 'completed' && renderResult.image) {
          const imageBytes = Buffer.from(renderResult.image.data, 'base64');
          const fileExt = getGeneratedFileExtension(renderResult.image.mimeType);
          const filePath = `${user.id}/${genImage.id}.${fileExt}`;

          const { error: uploadErr } = await service.storage
            .from('generated-images')
            .upload(filePath, imageBytes, {
              contentType: renderResult.image.mimeType,
              upsert: true,
            });
          if (uploadErr) {
            throw new Error(`Image upload failed: ${uploadErr.message}`);
          }

          const { data: publicUrlData } = service.storage
            .from('generated-images')
            .getPublicUrl(filePath);
          finalImageUrl = publicUrlData.publicUrl;

          await service
            .from('generated_images')
            .update({
              request_id: renderResult.requestId,
              status: 'completed',
              image_url: finalImageUrl,
            })
            .eq('id', genImage.id);

          // Bump usage on first successful render; any refine re-render is free.
          const { error: rpcErr } = await service.rpc('increment_usage', {
            user_id: user.id,
          });
          if (rpcErr) {
            console.error('[pipeline/generate] increment_usage failed:', rpcErr.message);
          }
        } else {
          await service
            .from('generated_images')
            .update({
              request_id: renderResult.requestId,
              status: renderResult.status === 'nsfw' ? 'nsfw' : 'failed',
              error_message: renderResult.error ?? 'Render failed',
            })
            .eq('id', genImage.id);
          throw new Error(renderResult.error ?? 'Image generation failed');
        }

        emit({
          type: 'stage_complete',
          stage: 'render.persisted',
          durationMs: 0,
          output: { generated_image_id: genImage.id, image_url: finalImageUrl },
        });

        // ── Stage: critique ─────────────────────────────────────────────────
        const critiqueOut = await runStage(
          'critique',
          () =>
            critiqueStage.run(
              {
                brief,
                concept,
                copy: { structured: copyRow.structured },
                visual: { structured: visualRow.structured },
                product,
                brand,
                judge_notes: parsed.judge_notes,
              },
              trace,
            ),
          (out) => ({
            verdict: out.structured.verdict,
            prompt_version: out.prompt_version,
            model: out.model,
          }),
        );

        const { data: critiqueRow, error: critErr } = await service
          .from('critiques')
          .insert({
            concept_id: concept.id,
            brief_id: brief.id,
            copy_block_id: copyRow.id,
            visual_spec_id: visualRow.id,
            verdict: critiqueOut.structured.verdict,
            structured: {
              ...critiqueOut.structured,
              _meta: {
                prompt_version: critiqueOut.prompt_version,
                model: critiqueOut.model,
              },
            },
            prompt_version: critiqueOut.prompt_version,
            model: critiqueOut.model,
          })
          .select()
          .single();

        if (critErr || !critiqueRow) {
          // Critique persistence failure is non-fatal for the stream — the
          // user still has an image. Emit an error and move on.
          console.error(
            '[pipeline/generate] critique insert failed:',
            critErr?.message,
          );
          emit({
            type: 'stage_error',
            stage: 'critique.persisted',
            error: `Failed to persist critique: ${critErr?.message}`,
          });
        } else {
          emit({
            type: 'stage_complete',
            stage: 'critique.persisted',
            durationMs: 0,
            output: { critique_id: critiqueRow.id, verdict: critiqueRow.verdict },
          });
        }

        // ── Stage: refine (at most one) ─────────────────────────────────────
        const shouldRefine =
          autoRefine &&
          critiqueOut.structured.verdict === 'refine' &&
          critiqueOut.structured.refine_targets.length > 0;

        if (shouldRefine) {
          const target = critiqueOut.structured.refine_targets[0];

          if (target.stage === 'copy') {
            const refinedCopy = await runStage(
              'refine',
              () =>
                refineCopyStage.run(
                  {
                    brief,
                    concept,
                    product,
                    brand,
                    previous_copy: copyRow.structured,
                    instruction: target.instruction,
                  },
                  trace,
                ),
              (out) => ({
                target: 'copy',
                prompt_version: out.prompt_version,
                model: out.model,
              }),
            );

            const { data: newCopyRow, error: newCopyErr } = await service
              .from('copy_blocks')
              .insert({
                concept_id: concept.id,
                brief_id: brief.id,
                structured: {
                  ...refinedCopy.structured,
                  _meta: {
                    prompt_version: refinedCopy.prompt_version,
                    model: refinedCopy.model,
                    refined_from: copyRow.id,
                    refine_instruction: target.instruction,
                  },
                },
                prompt_version: refinedCopy.prompt_version,
                model: refinedCopy.model,
              })
              .select()
              .single();

            if (newCopyErr || !newCopyRow) {
              emit({
                type: 'stage_error',
                stage: 'refine.persisted',
                error: `Failed to persist refined copy: ${newCopyErr?.message}`,
              });
            } else {
              emit({
                type: 'stage_complete',
                stage: 'refine.persisted',
                durationMs: 0,
                output: { target: 'copy', copy_block_id: newCopyRow.id },
              });
            }
            // Copy refine does not trigger a re-render in V1 — the image
            // was visually valid, only the words changed.
          } else if (target.stage === 'visual') {
            const refinedVisual = await runStage(
              'refine',
              () =>
                refineVisualStage.run(
                  {
                    brief,
                    concept,
                    copy: { structured: copyRow.structured },
                    product,
                    brand,
                    previous_visual: visualRow.structured,
                    instruction: target.instruction,
                    aspect_ratio: aspectRatio,
                  },
                  trace,
                ),
              (out) => ({
                target: 'visual',
                prompt_version: out.prompt_version,
                model: out.model,
              }),
            );

            const { data: newVisualRow, error: newVisualErr } = await service
              .from('visual_specs')
              .insert({
                concept_id: concept.id,
                brief_id: brief.id,
                copy_block_id: copyRow.id,
                prompt_text: refinedVisual.prompt_text,
                aspect_ratio: refinedVisual.aspect_ratio,
                structured: {
                  ...refinedVisual.structured,
                  _meta: {
                    prompt_version: refinedVisual.prompt_version,
                    model: refinedVisual.model,
                    refined_from: visualRow.id,
                    refine_instruction: target.instruction,
                  },
                },
                prompt_version: refinedVisual.prompt_version,
                model: refinedVisual.model,
              })
              .select()
              .single();

            if (newVisualErr || !newVisualRow) {
              emit({
                type: 'stage_error',
                stage: 'refine.persisted',
                error: `Failed to persist refined visual: ${newVisualErr?.message}`,
              });
            } else {
              emit({
                type: 'stage_complete',
                stage: 'refine.persisted',
                durationMs: 0,
                output: { target: 'visual', visual_spec_id: newVisualRow.id },
              });

              // Re-render with the refined visual prompt. No usage bump —
              // the user paid for one generation; this is the AI doing
              // the second pass on its own dime.
              const { data: reImage, error: reErr } = await service
                .from('generated_images')
                .insert({
                  session_id: sessionId,
                  brief_id: brief.id,
                  concept_id: concept.id,
                  prompt_used: newVisualRow.prompt_text,
                  aspect_ratio: aspectRatio,
                  api_provider: 'xai',
                  model_id: modelId,
                  status: 'queued',
                })
                .select()
                .single();

              if (reErr || !reImage) {
                emit({
                  type: 'stage_error',
                  stage: 'render.refine',
                  error: `Failed to create refined render row: ${reErr?.message}`,
                });
              } else {
                try {
                  const reRender = await runStage(
                    'render',
                    () =>
                      renderStage.run(
                        {
                          prompt: newVisualRow.prompt_text,
                          aspectRatio,
                          referenceImageUrls,
                          modelId,
                        },
                        trace,
                      ),
                    (out) => ({
                      generated_image_id: reImage.id,
                      status: out.status,
                      refined: true,
                    }),
                  );

                  if (reRender.status === 'completed' && reRender.image) {
                    const bytes = Buffer.from(reRender.image.data, 'base64');
                    const ext = getGeneratedFileExtension(reRender.image.mimeType);
                    const path = `${user.id}/${reImage.id}.${ext}`;
                    await service.storage
                      .from('generated-images')
                      .upload(path, bytes, {
                        contentType: reRender.image.mimeType,
                        upsert: true,
                      });
                    const { data: pub } = service.storage
                      .from('generated-images')
                      .getPublicUrl(path);
                    finalImageUrl = pub.publicUrl;

                    await service
                      .from('generated_images')
                      .update({
                        request_id: reRender.requestId,
                        status: 'completed',
                        image_url: finalImageUrl,
                      })
                      .eq('id', reImage.id);

                    emit({
                      type: 'stage_complete',
                      stage: 'render.refine.persisted',
                      durationMs: 0,
                      output: {
                        generated_image_id: reImage.id,
                        image_url: finalImageUrl,
                        refined: true,
                      },
                    });
                  } else {
                    // Re-render failed — keep the original image, log it.
                    await service
                      .from('generated_images')
                      .update({
                        request_id: reRender.requestId,
                        status: 'failed',
                        error_message: reRender.error ?? 'Refine re-render failed',
                      })
                      .eq('id', reImage.id);
                    emit({
                      type: 'stage_error',
                      stage: 'render.refine',
                      error: reRender.error ?? 'Refine re-render failed',
                    });
                  }
                } catch (err) {
                  // runStage already emitted stage_error. We swallow here
                  // because the original image is still the final artifact.
                  const msg = err instanceof Error ? err.message : String(err);
                  console.error('[pipeline/generate] refine re-render failed:', msg);
                }
              }
            }
          }
        }

        // ── Done ────────────────────────────────────────────────────────────
        emit({
          type: 'done',
          status: 'completed',
          generated_image_id: genImage.id,
          image_url: finalImageUrl,
          trace,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[pipeline/generate] fatal:', msg);
        emit({
          type: 'done',
          status: 'failed',
          error: msg,
          trace,
        });
      } finally {
        controller.close();
      }
    },

    cancel() {
      // Client disconnected (tab closed, navigation). Nothing to clean up
      // — Claude/xAI calls are fire-and-forget as far as we're concerned.
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Disable proxy buffering (nginx/CF); without this SSE can stall.
      'X-Accel-Buffering': 'no',
    },
  });
}
