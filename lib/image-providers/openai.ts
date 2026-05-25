/**
 * OpenAI image provider — gpt-image-1 (latest model, powers ChatGPT Images)
 *
 * Two endpoints, selected automatically based on whether reference images exist:
 *
 *   /v1/images/generations — text-to-image. JSON body, response_format=b64_json.
 *   /v1/images/edits       — image-to-image. Multipart form-data; accepts image
 *                            file(s) + optional inpainting mask.
 *
 * Key differences from xAI:
 *  - Edits endpoint is multipart (not JSON), so reference URLs must be fetched
 *    and converted to binary before upload.
 *  - Native inpainting mask support: transparent (alpha=0) = edit here.
 *    The lasso selection (red-fill PNG from canvas) is converted here using
 *    sharp: red pixels → alpha=0 (edit zone), others → opaque black (keep).
 *  - Fixed size enum instead of free aspect_ratio (see ASPECT_SIZE_MAP).
 *  - Multiple reference images use `image[]` field (not `images` array).
 *
 * Ref: https://platform.openai.com/docs/api-reference/images
 */

import sharp from 'sharp';
import type { GenerateParams, GenerateResult, ImageProvider, StatusResult } from './types';

const OPENAI_GENERATIONS_URL = 'https://api.openai.com/v1/images/generations';
const OPENAI_EDITS_URL       = 'https://api.openai.com/v1/images/edits';
const DEFAULT_MODEL          = 'gpt-image-2';

/**
 * gpt-image-1 supported output sizes (as of April 2026).
 * Maps our aspect ratio tokens to the closest supported OpenAI size.
 */
const ASPECT_SIZE_MAP: Record<string, string> = {
  '1:1':  '1024x1024',
  '4:5':  '1024x1536',  // closest portrait (actual 2:3 ratio)
  '9:16': '1024x1536',
  '16:9': '1536x1024',
  '3:4':  '1024x1536',
};

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OpenAI API key is not configured. Set OPENAI_API_KEY.');
  return key;
}

function getModelId(override?: string): string {
  return override || process.env.OPENAI_MODEL_ID || DEFAULT_MODEL;
}

export function getGeneratedFileExtension(_mimeType: string): string {
  return 'png';
}

function resolveSize(aspectRatio: string): string {
  return ASPECT_SIZE_MAP[aspectRatio] ?? '1024x1024';
}

// ─── Image helpers ────────────────────────────────────────────────────────────

/**
 * Fetch a reference image from a public URL, a relative Next.js public-folder
 * path (e.g. /product_images/foo.webp), or a base64 data URI.
 * Returns a Buffer and the detected MIME type.
 */
async function fetchImageAsBuffer(src: string): Promise<{ buffer: Buffer; mimeType: string }> {
  // base64 data URI
  if (src.startsWith('data:')) {
    const match = src.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error('Invalid data URI for reference image');
    return { buffer: Buffer.from(match[2], 'base64'), mimeType: match[1] };
  }

  // Relative path (e.g. /product_images/rufolia.webp stored by seedProductThumbnails).
  // fetch() cannot handle relative URLs server-side — read directly from the
  // Next.js public folder on the filesystem instead.
  if (src.startsWith('/') && !src.startsWith('//')) {
    const { readFile } = await import('fs/promises');
    const { join }     = await import('path');
    const filePath = join(process.cwd(), 'public', src);
    const buffer   = await readFile(filePath);
    const ext      = src.split('.').pop()?.toLowerCase() ?? 'png';
    const mimeMap: Record<string, string> = {
      webp: 'image/webp',
      jpg:  'image/jpeg',
      jpeg: 'image/jpeg',
      png:  'image/png',
      gif:  'image/gif',
      avif: 'image/avif',
    };
    return { buffer, mimeType: mimeMap[ext] ?? 'image/png' };
  }

  // Absolute HTTP URL
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Failed to fetch reference image (HTTP ${res.status}): ${src}`);
  const mimeType = res.headers.get('content-type')?.split(';')[0] || 'image/png';
  return { buffer: Buffer.from(await res.arrayBuffer()), mimeType };
}

/**
 * Convert the lasso canvas export (red-fill PNG) to an OpenAI inpainting mask.
 *
 * Input:  RGBA PNG where the selection area is painted red (R≈239, G≈68, B≈68, A>0)
 *         and the rest is fully transparent (A=0).
 * Output: RGBA PNG where former-red pixels have alpha=0 (edit here) and
 *         everything else is opaque black (keep unchanged).
 */
async function redMaskToOpenAIMask(dataUri: string): Promise<Buffer> {
  const base64 = dataUri.replace(/^data:image\/\w+;base64,/, '');
  const inputBuffer = Buffer.from(base64, 'base64');

  const { data, info } = await sharp(inputBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const output = Buffer.alloc(width * height * 4, 0);

  for (let i = 0; i < width * height; i++) {
    const src = i * 4;
    const r = data[src];
    const g = data[src + 1];
    const b = data[src + 2];
    const a = data[src + 3];

    // Red lasso pixels: R dominant, G+B low, has some alpha
    const isSelected = a > 20 && r > 140 && g < 130 && b < 130 && r > g + 30;

    const dst = i * 4;
    output[dst + 0] = 0;                       // R: black
    output[dst + 1] = 0;                       // G: black
    output[dst + 2] = 0;                       // B: black
    output[dst + 3] = isSelected ? 0 : 255;   // A: 0 = edit here, 255 = keep
  }

  return sharp(output, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

// ─── Submit helpers ───────────────────────────────────────────────────────────

async function submitGenerations(
  apiKey: string,
  modelId: string,
  size: string,
  params: GenerateParams,
): Promise<GenerateResult> {
  // 'medium' quality is 3-5× faster than 'high' with comparable output for ad
  // proofing purposes. Switch to 'high' only for final export if needed.
  const quality = process.env.OPENAI_IMAGE_QUALITY ?? 'medium';

  const body: Record<string, unknown> = {
    model:           modelId,
    prompt:          params.prompt,
    n:               1,
    size,
    quality,
    output_format:   'png',   // image encoding format; b64_json is the default response shape
  };

  console.log(`[OpenAI] /generations, size=${size}, prompt_len=${params.prompt.length}`);

  const response = await fetch(OPENAI_GENERATIONS_URL, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  return parseImageResponse(response, 'generations');
}

async function submitEdits(
  apiKey: string,
  modelId: string,
  size: string,
  params: GenerateParams,
): Promise<GenerateResult> {
  const refs = params.referenceImageUrls ?? [];

  // 'medium' quality is 3-5× faster than 'high' with comparable output for ad
  // proofing purposes. Override with OPENAI_IMAGE_QUALITY=high for final export.
  const quality = process.env.OPENAI_IMAGE_QUALITY ?? 'medium';

  const formData = new FormData();
  formData.append('model',            modelId);
  formData.append('prompt',           params.prompt);
  formData.append('n',                '1');
  formData.append('size',             size);
  formData.append('quality',          quality);
  // Note: input_fidelity is NOT sent for gpt-image-2 — the model always
  // processes at high fidelity automatically and the param is disallowed.

  // Fetch all reference images in parallel (was serial for-loop — now Promise.all)
  const fetchedRefs = await Promise.all(
    refs.slice(0, 4).map(async (ref) => {
      try {
        return await fetchImageAsBuffer(ref);
      } catch (err: any) {
        console.warn(`[OpenAI] Skipping reference image (fetch failed): ${err.message}`);
        return null;
      }
    }),
  );

  const validRefs = fetchedRefs.filter(Boolean) as { buffer: Buffer; mimeType: string }[];

  // If every reference image failed to load, avoid calling the edits endpoint
  // with no images (which returns OpenAI 400 "Missing required parameter: image").
  // Fall back to pure text-to-image generation instead.
  if (validRefs.length === 0) {
    console.warn('[OpenAI] All reference images failed to load — falling back to /generations');
    return submitGenerations(apiKey, modelId, size, params);
  }

  for (const { buffer, mimeType } of validRefs) {
    const ext = mimeType.split('/')[1] || 'png';
    formData.append('image[]', new Blob([buffer], { type: mimeType }), `ref.${ext}`);
  }

  // Convert lasso mask → OpenAI inpainting mask (transparent = edit here)
  if (params.maskDataUrl) {
    try {
      const maskBuffer = await redMaskToOpenAIMask(params.maskDataUrl);
      formData.append('mask', new Blob([maskBuffer], { type: 'image/png' }), 'mask.png');
      console.log('[OpenAI] Lasso mask attached as inpainting mask');
    } catch (err: any) {
      console.warn(`[OpenAI] Mask conversion failed — proceeding without mask: ${err.message}`);
    }
  }

  console.log(
    `[OpenAI] /edits, size=${size}, refs=${refs.length}, mask=${!!params.maskDataUrl}, prompt_len=${params.prompt.length}`,
  );

  const response = await fetch(OPENAI_EDITS_URL, {
    method:  'POST',
    headers: { Authorization: `Bearer ${apiKey}` }, // Content-Type set automatically for FormData
    body:    formData,
  });

  return parseImageResponse(response, 'edits');
}

async function parseImageResponse(response: Response, endpoint: string): Promise<GenerateResult> {
  const rawBody = await response.text();
  let payload: any = null;
  try { payload = rawBody ? JSON.parse(rawBody) : null; } catch { payload = null; }

  if (!response.ok) {
    const message =
      payload?.error?.message ||
      (typeof payload?.error === 'string' ? payload.error : null) ||
      (rawBody && rawBody.length < 500 ? rawBody : null) ||
      `OpenAI image ${endpoint} failed (HTTP ${response.status})`;
    console.error(`[OpenAI] API error (${endpoint}):`, response.status, rawBody.slice(0, 1000));
    throw new Error(message);
  }

  // gpt-image-1 returns b64_json by default on the edits endpoint;
  // for generations we request it explicitly via output_format.
  const b64 = payload?.data?.[0]?.b64_json;
  if (!b64) {
    console.error('[OpenAI] No b64_json in response:', JSON.stringify(payload).slice(0, 300));
    return {
      requestId: crypto.randomUUID(),
      status:    'failed',
      error:     'OpenAI did not return image data',
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
}

// ─── Provider export ──────────────────────────────────────────────────────────

export const openai: ImageProvider = {
  async submitGeneration(params: GenerateParams): Promise<GenerateResult> {
    const apiKey  = getApiKey();
    const modelId = getModelId(params.modelId);
    const size    = resolveSize(params.aspectRatio);
    const hasRefs = (params.referenceImageUrls?.length ?? 0) > 0;

    return hasRefs
      ? submitEdits(apiKey, modelId, size, params)
      : submitGenerations(apiKey, modelId, size, params);
  },

  async checkStatus(_requestId: string): Promise<StatusResult> {
    // OpenAI image generation is synchronous — no polling needed
    return { status: 'failed', error: 'OpenAI requests complete synchronously during submission' };
  },

  async cancelGeneration(_requestId: string): Promise<void> {
    return;
  },
};
