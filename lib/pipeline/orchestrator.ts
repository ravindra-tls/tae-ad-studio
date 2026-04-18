/**
 * Pipeline orchestrator.
 *
 * V1 Phase 0: pass-through orchestrator. Takes a pre-assembled prompt and
 * calls the render stage. Maintains parity with /api/generate/submit's
 * existing behavior so we can introduce this abstraction without regressing.
 *
 * Phase 1 will add stages upstream:
 *   brief → concept → copy → visual → render → critique → refine?
 *
 * The orchestrator will become a state machine with checkpoints (user-
 * approved gates after `brief` and `concept`) and SSE streaming of stage
 * progress. Phase 0 keeps it synchronous and single-stage to avoid touching
 * the submit route's contract.
 */

import { renderStage } from './stages/render';
import type {
  OrchestratorInput,
  OrchestratorOutput,
  StageProgress,
} from './types';

export async function runPipeline(
  input: OrchestratorInput,
): Promise<OrchestratorOutput> {
  const trace: StageProgress[] = [];

  try {
    const renderResult = await renderStage.run(
      {
        prompt: input.prompt,
        aspectRatio: input.aspectRatio,
        referenceImageUrls: input.referenceImageUrls,
        modelId: input.modelId,
      },
      trace,
    );

    return {
      requestId: renderResult.requestId,
      status:
        renderResult.status === 'queued' ? 'in_progress' : renderResult.status,
      image: renderResult.image,
      error: renderResult.error,
      trace,
    };
  } catch (err: any) {
    return {
      requestId: '',
      status: 'failed',
      error: err?.message ?? String(err),
      trace,
    };
  }
}
