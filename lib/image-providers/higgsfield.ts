import type { GenerateParams, GenerateResult, StatusResult, ImageProvider } from './types';

const BASE_URL = 'https://platform.higgsfield.ai';

function getAuthHeader(): string {
  const key = process.env.HIGGSFIELD_API_KEY;
  const secret = process.env.HIGGSFIELD_API_SECRET;
  if (!key || !secret) throw new Error('Higgsfield API credentials not configured');
  return `Key ${key}:${secret}`;
}

function getModelId(override?: string): string {
  return override || process.env.HIGGSFIELD_MODEL_ID || 'higgsfield-ai/soul/standard';
}

export const higgsfield: ImageProvider = {
  async submitGeneration(params: GenerateParams): Promise<GenerateResult> {
    const modelId = getModelId(params.modelId);

    const body: Record<string, unknown> = {
      prompt: params.prompt,
      aspect_ratio: params.aspectRatio,
    };

    if (params.referenceImageUrls?.length) {
      body.reference_images = params.referenceImageUrls;
    }

    const res = await fetch(`${BASE_URL}/${modelId}`, {
      method: 'POST',
      headers: {
        'Authorization': getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Higgsfield API error (${res.status}): ${error}`);
    }

    const data = await res.json();
    return {
      requestId: data.request_id,
      statusUrl: `${BASE_URL}/requests/${data.request_id}/status`,
    };
  },

  async checkStatus(requestId: string): Promise<StatusResult> {
    const res = await fetch(`${BASE_URL}/requests/${requestId}/status`, {
      headers: { 'Authorization': getAuthHeader() },
    });

    if (!res.ok) {
      throw new Error(`Status check failed (${res.status})`);
    }

    const data = await res.json();
    return {
      status: data.status,
      images: data.images,
      error: data.error,
    };
  },

  async cancelGeneration(requestId: string): Promise<void> {
    await fetch(`${BASE_URL}/requests/${requestId}/cancel`, {
      method: 'POST',
      headers: { 'Authorization': getAuthHeader() },
    });
  },
};
