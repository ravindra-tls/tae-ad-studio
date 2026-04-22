import type { GenerateParams, GenerateResult, ImageProvider, StatusResult } from './types';

/**
 * xAI has two separate image endpoints with different capabilities:
 *
 *   /v1/images/generations — pure text-to-image. No reference image input.
 *   /v1/images/edits       — text + reference image(s) → new image. Accepts
 *                            up to 5 reference images (public URLs or base64
 *                            data URIs) and supports `aspect_ratio` natively.
 *
 * When the caller passes `referenceImageUrls`, we route to /edits so the
 * references are actually honored. With no references, we stay on
 * /generations (historical behavior; aspect ratio is steered via prompt text
 * because that path was calibrated before aspect_ratio became first-class).
 *
 * Ref: https://docs.x.ai/developers/model-capabilities/images/generation
 */

const XAI_GENERATIONS_URL = 'https://api.x.ai/v1/images/generations';
const XAI_EDITS_URL       = 'https://api.x.ai/v1/images/edits';
const DEFAULT_MODEL       = 'grok-imagine-image';

/** xAI's documented ceiling for the /edits endpoint. Reject-trim above this. */
const MAX_REFERENCE_IMAGES = 5;

// Map our aspect ratio tokens to a natural-language instruction appended to the
// text-to-image prompt. xAI's /generations path was wired before aspect_ratio
// was a first-class param, and we prefer not to re-calibrate that path here.
const ASPECT_RATIO_HINT: Record<string, string> = {
  '1:1':  'square format (1:1 aspect ratio)',
  '4:5':  'portrait format (4:5 aspect ratio)',
  '9:16': 'vertical portrait format (9:16 aspect ratio)',
  '16:9': 'landscape format (16:9 aspect ratio)',
  '3:4':  'portrait format (3:4 aspect ratio)',
};

function getApiKey(): string {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error('xAI API key is not configured. Set XAI_API_KEY.');
  return key;
}

function getModelId(override?: string): string {
  return override || process.env.XAI_MODEL_ID || DEFAULT_MODEL;
}

export function getGeneratedFileExtension(_mimeType: string): string {
  // xAI returns PNG by default
  return 'png';
}

/**
 * Build the request body for the /edits endpoint. xAI accepts either a
 * singular `image` (single reference) or an `images` array (up to 5).
 * We honor both shapes literally because the docs do.
 */
function buildEditsBody(params: {
  modelId: string;
  prompt: string;
  aspectRatio: GenerateParams['aspectRatio'];
  refs: string[];
}): Record<string, unknown> {
  const base: Record<string, unknown> = {
    model:           params.modelId,
    prompt:          params.prompt,
    n:               1,
    response_format: 'b64_json',
    aspect_ratio:    params.aspectRatio,
  };

  if (params.refs.length === 1) {
    base.image = { type: 'image_url', url: params.refs[0] };
  } else {
    base.images = params.refs.map((url) => ({ type: 'image_url', url }));
  }

  return base;
}

function buildGenerationsBody(params: {
  modelId: string;
  prompt: string;
  aspectRatio: GenerateParams['aspectRatio'];
}): Record<string, unknown> {
  const aspectHint =
    ASPECT_RATIO_HINT[params.aspectRatio] ?? 'square format (1:1 aspect ratio)';
  const finalPrompt = `${params.prompt}\n\nCompose this image in ${aspectHint}.`;

  return {
    model:           params.modelId,
    prompt:          finalPrompt,
    n:               1,
    response_format: 'b64_json',
  };
}

export const xai: ImageProvider = {
  async submitGeneration(params: GenerateParams): Promise<GenerateResult> {
    const apiKey  = getApiKey();
    const modelId = getModelId(params.modelId);

    // Trim references to the provider's hard ceiling. Log if we dropped any
    // so the caller notices (better than silent truncation).
    const allRefs = params.referenceImageUrls ?? [];
    const refs    = allRefs.slice(0, MAX_REFERENCE_IMAGES);
    if (allRefs.length > MAX_REFERENCE_IMAGES) {
      console.warn(
        `[xAI] ${allRefs.length} reference images provided; truncating to ${MAX_REFERENCE_IMAGES} (xAI /edits ceiling).`,
      );
    }

    const hasRefs = refs.length > 0;
    const url     = hasRefs ? XAI_EDITS_URL : XAI_GENERATIONS_URL;
    const body    = hasRefs
      ? buildEditsBody({
          modelId,
          prompt:      params.prompt,
          aspectRatio: params.aspectRatio,
          refs,
        })
      : buildGenerationsBody({
          modelId,
          prompt:      params.prompt,
          aspectRatio: params.aspectRatio,
        });

    if (hasRefs) {
      console.log(
        `[xAI] /edits with ${refs.length} reference image(s), aspect_ratio=${params.aspectRatio}`,
      );
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const payload = await response.json();

    if (!response.ok) {
      const message =
        payload?.error?.message ||
        payload?.error ||
        `xAI image ${hasRefs ? 'edit' : 'generation'} failed (HTTP ${response.status})`;
      console.error(
        `[xAI] API error (${hasRefs ? 'edits' : 'generations'}):`,
        response.status,
        JSON.stringify(payload),
      );
      throw new Error(message);
    }

    console.log(
      `[xAI] Response keys (${hasRefs ? 'edits' : 'generations'}):`,
      Object.keys(payload),
    );
    const b64 = payload?.data?.[0]?.b64_json;
    if (!b64) {
      console.error(
        '[xAI] No b64_json in response:',
        JSON.stringify(payload).slice(0, 300),
      );
      return {
        requestId: crypto.randomUUID(),
        status:    'failed',
        error:     'xAI did not return image data',
      };
    }

    return {
      requestId: crypto.randomUUID(),
      status:    'completed',
      image: {
        data:     b64,
        mimeType: 'image/png',
      },
    };
  },

  async checkStatus(_requestId: string): Promise<StatusResult> {
    // xAI image generation is synchronous — no polling needed
    return { status: 'failed', error: 'xAI requests complete synchronously during submission' };
  },

  async cancelGeneration(_requestId: string): Promise<void> {
    return;
  },
};
