/**
 * Pipeline orchestrator — shared type surface.
 *
 * V1 Phase 0: this file defines the shapes that every stage and the
 * orchestrator agree on. Stages are added in Phase 1+ as real Claude calls;
 * today only `render` is implemented (a thin pass-through over imageProvider).
 */

import type { GenerateParams } from '@/lib/image-providers/types';

/** Every stage in the pipeline reports progress via this shape. */
export type StageName =
  | 'brief'      // Phase 1
  | 'concept'    // Phase 1
  | 'copy'       // Phase 2
  | 'visual'     // Phase 2
  | 'render'     // Phase 0 (only stage implemented)
  | 'critique'   // Phase 2
  | 'refine';    // Phase 2

export interface StageProgress {
  stage: StageName;
  status: 'started' | 'completed' | 'failed';
  output?: unknown;
  error?: string;
  durationMs?: number;
}

/**
 * Input to the orchestrator. In Phase 0 this is a pre-assembled prompt +
 * aspect ratio (parity with today's /api/generate/submit). In Phase 1+ this
 * becomes an objective + product + strictness and the pipeline figures out
 * the prompt itself.
 */
export interface OrchestratorInput {
  /** Pre-assembled prompt. Phase 0 only. Phase 1 will add objective/brief. */
  prompt: string;
  aspectRatio: GenerateParams['aspectRatio'];
  referenceImageUrls?: string[];
  modelId?: string;
}

export interface OrchestratorOutput {
  requestId: string;
  status: 'completed' | 'failed' | 'nsfw' | 'in_progress';
  image?: {
    data: string;        // base64
    mimeType: string;
  };
  error?: string;
  /** Ordered log of stage transitions — surfaces in the "Show my thinking" drawer. */
  trace: StageProgress[];
}

/** Signature every stage implements. Returned output is stage-specific. */
export interface Stage<Input, Output> {
  name: StageName;
  run(input: Input, trace: StageProgress[]): Promise<Output>;
}
