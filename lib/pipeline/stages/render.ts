/**
 * Render stage — wraps the existing imageProvider.submitGeneration.
 *
 * V1 Phase 0: this is the ONLY real stage. The orchestrator runs this and
 * returns, giving us parity with /api/generate/submit through the new
 * abstraction. Phase 1+ adds brief/concept/copy/visual stages upstream.
 */

import { imageProvider } from '@/lib/image-providers';
import type {
  GenerateParams,
  GenerateResult,
} from '@/lib/image-providers/types';
import type { Stage, StageProgress } from '../types';

export interface RenderInput {
  prompt: string;
  aspectRatio: GenerateParams['aspectRatio'];
  referenceImageUrls?: string[];
  modelId?: string;
}

export type RenderOutput = GenerateResult;

export const renderStage: Stage<RenderInput, RenderOutput> = {
  name: 'render',

  async run(input, trace) {
    const started = Date.now();
    trace.push({ stage: 'render', status: 'started' });

    try {
      const result = await imageProvider.submitGeneration({
        prompt: input.prompt,
        aspectRatio: input.aspectRatio,
        referenceImageUrls: input.referenceImageUrls,
        modelId: input.modelId,
      });

      trace.push({
        stage: 'render',
        status: result.status === 'failed' || result.status === 'nsfw' ? 'failed' : 'completed',
        durationMs: Date.now() - started,
        output: { requestId: result.requestId, status: result.status },
        error: result.error,
      });

      return result;
    } catch (err: any) {
      trace.push({
        stage: 'render',
        status: 'failed',
        durationMs: Date.now() - started,
        error: err?.message ?? String(err),
      });
      throw err;
    }
  },
};
