/**
 * Image provider registry
 *
 * All image generation routes through a single provider slot:
 *
 *   IMAGE_PROVIDER - all generation modes. Default: openai (gpt-image-2)
 *
 * Routing logic:
 *   - Lasso mask edits generate freely, then the submit route composites the
 *     selected pixels back onto the original.
 *   - Reference edits send reference images without a mask.
 *   - Pure text-to-image sends the prompt only.
 */
import { xai,    getGeneratedFileExtension as xaiExt    } from './xai';
import { vertex, getGeneratedFileExtension as vertexExt } from './vertex';
import { openai, getGeneratedFileExtension as openaiExt } from './openai';
import type { ImageProvider, GenerateParams, GenerateResult, StatusResult } from './types';

const ACTIVE_PROVIDER = (process.env.IMAGE_PROVIDER || 'openai').toLowerCase();

const PROVIDERS: Record<string, ImageProvider> = { openai, xai, vertex };

const provider = PROVIDERS[ACTIVE_PROVIDER] ?? openai;

export const imageProvider: ImageProvider = {
  async submitGeneration(params: GenerateParams): Promise<GenerateResult> {
    const hasMask = !!params.maskDataUrl;
    const hasRefs = (params.referenceImageUrls?.length ?? 0) > 0;

    if (hasMask) {
      console.log(`[provider] masked edit -> ${ACTIVE_PROVIDER} (text-only, compositor applies lasso)`);
      return provider.submitGeneration({
        ...params,
        referenceImageUrls: undefined,
        maskDataUrl: undefined,
      });
    }
    if (hasRefs) {
      console.log(`[provider] reference edit -> ${ACTIVE_PROVIDER}`);
      return provider.submitGeneration(params);
    }
    console.log(`[provider] generation -> ${ACTIVE_PROVIDER}`);
    return provider.submitGeneration(params);
  },

  async checkStatus(requestId: string): Promise<StatusResult> {
    return provider.checkStatus(requestId);
  },

  async cancelGeneration(requestId: string): Promise<void> {
    return provider.cancelGeneration(requestId);
  },
};

export function getGeneratedFileExtension(mimeType: string): string {
  if (ACTIVE_PROVIDER === 'vertex') return vertexExt(mimeType);
  if (ACTIVE_PROVIDER === 'xai')    return xaiExt(mimeType);
  return openaiExt(mimeType);
}

export type {
  GenerateParams,
  GenerateResult,
  StatusResult,
  ImageProvider,
} from './types';
