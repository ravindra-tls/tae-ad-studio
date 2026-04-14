import type { GenerateParams, GenerateResult, ImageProvider, StatusResult } from './types';

const XAI_API_URL  = 'https://api.x.ai/v1/images/generations';
const DEFAULT_MODEL = 'grok-imagine-image';

// Map our aspect ratio tokens to a natural-language instruction appended to the prompt.
// xAI Aurora does not accept an aspect ratio parameter — we steer it via prompt text.
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

export const xai: ImageProvider = {
  async submitGeneration(params: GenerateParams): Promise<GenerateResult> {
    const apiKey  = getApiKey();
    const modelId = getModelId(params.modelId);

    // Append aspect ratio guidance to the prompt
    const aspectHint = ASPECT_RATIO_HINT[params.aspectRatio] ?? 'square format (1:1 aspect ratio)';
    const finalPrompt = `${params.prompt}\n\nCompose this image in ${aspectHint}.`;

    const body: Record<string, unknown> = {
      model:           modelId,
      prompt:          finalPrompt,
      n:               1,
      response_format: 'b64_json',
    };

    const response = await fetch(XAI_API_URL, {
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
        `xAI image generation failed (HTTP ${response.status})`;
      console.error('[xAI] API error:', response.status, JSON.stringify(payload));
      throw new Error(message);
    }

    console.log('[xAI] Response keys:', Object.keys(payload));
    const b64 = payload?.data?.[0]?.b64_json;
    if (!b64) {
      console.error('[xAI] No b64_json in response:', JSON.stringify(payload).slice(0, 300));
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
