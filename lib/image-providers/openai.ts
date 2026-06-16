import sharp from 'sharp';
import type { GenerateParams, GenerateResult, ImageProvider, StatusResult } from './types';

const OPENAI_GENERATIONS_URL = 'https://api.openai.com/v1/images/generations';
const OPENAI_EDITS_URL = 'https://api.openai.com/v1/images/edits';
const DEFAULT_GEN_MODEL = 'gpt-image-2';
const DEFAULT_EDIT_MODEL = 'gpt-image-2';

const ASPECT_SIZE_MAP: Record<string, string> = {
  '1:1': '1024x1024',
  '4:5': '1024x1536',
  '9:16': '1024x1536',
  '16:9': '1536x1024',
  '3:4': '1024x1536',
};

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OpenAI API key is not configured. Set OPENAI_API_KEY.');
  return key;
}

function getModelId(override?: string, forEdits = false): string {
  if (override) return override;
  if (process.env.OPENAI_MODEL_ID) return process.env.OPENAI_MODEL_ID;
  return forEdits ? DEFAULT_EDIT_MODEL : DEFAULT_GEN_MODEL;
}

export function getGeneratedFileExtension(_mimeType: string): string {
  return 'png';
}

function resolveSize(aspectRatio: string): string {
  return ASPECT_SIZE_MAP[aspectRatio] ?? '1024x1024';
}

async function fetchImageAsBuffer(src: string): Promise<{ buffer: Buffer; mimeType: string }> {
  if (src.startsWith('data:')) {
    const match = src.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error('Invalid data URI for reference image');
    return { buffer: Buffer.from(match[2], 'base64'), mimeType: match[1] };
  }

  if (src.startsWith('/') && !src.startsWith('//')) {
    const { readFile } = await import('fs/promises');
    const { join } = await import('path');
    const filePath = join(process.cwd(), 'public', src);
    const buffer = await readFile(filePath);
    const ext = src.split('.').pop()?.toLowerCase() ?? 'png';
    const mimeMap: Record<string, string> = {
      webp: 'image/webp',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      avif: 'image/avif',
    };
    return { buffer, mimeType: mimeMap[ext] ?? 'image/png' };
  }

  const res = await fetch(src);
  if (!res.ok) throw new Error(`Failed to fetch reference image (HTTP ${res.status}): ${src}`);
  const mimeType = res.headers.get('content-type')?.split(';')[0] || 'image/png';
  return { buffer: Buffer.from(await res.arrayBuffer()), mimeType };
}

async function redMaskToOpenAIMask(dataUri: string): Promise<Buffer> {
  const base64 = dataUri.replace(/^data:image\/\w+;base64,/, '');
  const inputBuf = Buffer.from(base64, 'base64');
  const maskMeta = await sharp(inputBuf).metadata();
  const { width = 1024, height = 1024 } = maskMeta;

  let selectionAlpha: Buffer;
  if (maskMeta.hasAlpha) {
    selectionAlpha = await sharp(inputBuf).extractChannel('alpha').raw().toBuffer();
  } else {
    const channels = maskMeta.channels ?? 3;
    const { data: raw } = await sharp(inputBuf).raw().toBuffer({ resolveWithObject: true });
    selectionAlpha = Buffer.alloc(width * height);
    for (let i = 0; i < width * height; i++) {
      const r = raw[i * channels];
      const g = raw[i * channels + 1];
      const b = raw[i * channels + 2];
      selectionAlpha[i] = r > 100 && r > g + 30 && r > b + 30 ? 255 : 0;
    }
  }

  const output = Buffer.alloc(width * height * 4, 0);
  for (let i = 0; i < width * height; i++) {
    output[i * 4 + 3] = selectionAlpha[i] > 0 ? 0 : 255;
  }

  return sharp(output, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

async function submitGenerations(
  apiKey: string,
  modelId: string,
  size: string,
  params: GenerateParams,
): Promise<GenerateResult> {
  const quality = process.env.OPENAI_IMAGE_QUALITY ?? 'high';
  const body: Record<string, unknown> = {
    model: modelId,
    prompt: params.prompt,
    n: 1,
    size,
    quality,
    output_format: 'png',
  };

  console.log(`[OpenAI] /generations, model=${modelId}, size=${size}, prompt_len=${params.prompt.length}`);

  const response = await fetch(OPENAI_GENERATIONS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
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
  const quality = process.env.OPENAI_IMAGE_QUALITY ?? 'high';
  const formData = new FormData();
  formData.append('model', modelId);
  formData.append('prompt', params.prompt);
  formData.append('n', '1');
  formData.append('size', size);
  formData.append('quality', quality);

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

  if (validRefs.length === 0) {
    console.warn('[OpenAI] All reference images failed to load - falling back to /generations');
    return submitGenerations(apiKey, modelId, size, params);
  }

  for (const { buffer, mimeType } of validRefs) {
    const ext = mimeType.split('/')[1] || 'png';
    formData.append('image[]', new Blob([new Uint8Array(buffer)], { type: mimeType }), `ref.${ext}`);
  }

  if (params.maskDataUrl) {
    try {
      const maskBuffer = await redMaskToOpenAIMask(params.maskDataUrl);
      formData.append('mask', new Blob([new Uint8Array(maskBuffer)], { type: 'image/png' }), 'mask.png');
      console.log('[OpenAI] Lasso mask attached as inpainting mask');
    } catch (err: any) {
      console.warn(`[OpenAI] Mask conversion failed - proceeding without mask: ${err.message}`);
    }
  }

  console.log(
    `[OpenAI] /edits, model=${modelId}, size=${size}, refs=${refs.length}, mask=${!!params.maskDataUrl}, prompt_len=${params.prompt.length}`,
  );

  const response = await fetch(OPENAI_EDITS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  return parseImageResponse(response, 'edits');
}

async function parseImageResponse(response: Response, endpoint: string): Promise<GenerateResult> {
  const rawBody = await response.text();
  let payload: any = null;
  try {
    payload = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload?.error?.message ||
      (typeof payload?.error === 'string' ? payload.error : null) ||
      (rawBody && rawBody.length < 500 ? rawBody : null) ||
      `OpenAI image ${endpoint} failed (HTTP ${response.status})`;
    console.error(`[OpenAI] API error (${endpoint}):`, response.status, rawBody.slice(0, 1000));
    throw new Error(message);
  }

  const b64 = payload?.data?.[0]?.b64_json;
  if (!b64) {
    console.error('[OpenAI] No b64_json in response:', JSON.stringify(payload).slice(0, 300));
    return {
      requestId: crypto.randomUUID(),
      status: 'failed',
      error: 'OpenAI did not return image data',
    };
  }

  return {
    requestId: crypto.randomUUID(),
    status: 'completed',
    image: {
      data: b64,
      mimeType: 'image/png',
    },
  };
}

export const openai: ImageProvider = {
  async submitGeneration(params: GenerateParams): Promise<GenerateResult> {
    const apiKey = getApiKey();
    const hasRefs = (params.referenceImageUrls?.length ?? 0) > 0;
    const hasMask = !!params.maskDataUrl;
    const modelId = getModelId(params.modelId, hasRefs || hasMask);
    const size = resolveSize(params.aspectRatio);

    return hasRefs || hasMask
      ? submitEdits(apiKey, modelId, size, params)
      : submitGenerations(apiKey, modelId, size, params);
  },

  async checkStatus(_requestId: string): Promise<StatusResult> {
    return { status: 'failed', error: 'OpenAI requests complete synchronously during submission' };
  },

  async cancelGeneration(_requestId: string): Promise<void> {
    return;
  },
};
