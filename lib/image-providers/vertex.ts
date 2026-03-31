import { GoogleAuth } from 'google-auth-library';
import type { GenerateParams, GenerateResult, ImageProvider, StatusResult } from './types';

const DEFAULT_MODEL_ID = 'gemini-3-pro-image-preview';
const DEFAULT_LOCATION = 'global';
const CLOUD_PLATFORM_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const SUPPORTED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'image/heif',
]);

interface InlineImage {
  data: string;
  mimeType: string;
}

function getProjectId(): string {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.VERTEX_AI_PROJECT_ID;
  if (!projectId) {
    throw new Error('Vertex AI project is not configured. Set GOOGLE_CLOUD_PROJECT.');
  }
  return projectId;
}

function getLocation(): string {
  return process.env.GOOGLE_CLOUD_LOCATION || process.env.VERTEX_AI_LOCATION || DEFAULT_LOCATION;
}

function getModelId(override?: string): string {
  return override || process.env.VERTEX_AI_MODEL_ID || DEFAULT_MODEL_ID;
}

async function getAccessToken(): Promise<string> {
  const auth = new GoogleAuth({ scopes: [CLOUD_PLATFORM_SCOPE] });
  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();

  if (!accessToken.token) {
    throw new Error('Unable to acquire Vertex AI access token');
  }

  return accessToken.token;
}

function parseDataUrl(input: string): InlineImage | null {
  const match = input.match(/^data:(.+?);base64,(.+)$/);
  if (!match) return null;

  return {
    mimeType: match[1],
    data: match[2],
  };
}

function extensionFromMimeType(mimeType: string): string {
  switch (mimeType) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/heic':
      return 'heic';
    case 'image/heif':
      return 'heif';
    case 'image/jpeg':
    default:
      return 'jpg';
  }
}

async function toInlineImage(referenceImageUrl: string): Promise<InlineImage> {
  const dataUrl = parseDataUrl(referenceImageUrl);
  if (dataUrl) {
    return dataUrl;
  }

  const response = await fetch(referenceImageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch reference image (${response.status})`);
  }

  const mimeType = response.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg';
  if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
    throw new Error(`Unsupported reference image type: ${mimeType}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  return {
    mimeType,
    data: bytes.toString('base64'),
  };
}

export function getGeneratedFileExtension(mimeType: string): string {
  return extensionFromMimeType(mimeType);
}

export const vertex: ImageProvider = {
  async submitGeneration(params: GenerateParams): Promise<GenerateResult> {
    const projectId = getProjectId();
    const location = getLocation();
    const modelId = getModelId(params.modelId);
    const accessToken = await getAccessToken();

    const referenceImages = await Promise.all(
      (params.referenceImageUrls || []).slice(0, 14).map(toInlineImage)
    );

    const response = await fetch(
      `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:generateContent`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'USER',
              parts: [
                { text: params.prompt },
                ...referenceImages.map((image) => ({
                  inlineData: {
                    mimeType: image.mimeType,
                    data: image.data,
                  },
                })),
              ],
            },
          ],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
            candidateCount: 1,
            imageConfig: {
              aspectRatio: params.aspectRatio,
            },
          },
          safetySettings: [
            {
              method: 'PROBABILITY',
              category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE',
            },
          ],
        }),
      }
    );

    const payload = await response.json();
    if (!response.ok) {
      const message = payload?.error?.message || payload?.error || 'Vertex AI image generation failed';
      throw new Error(message);
    }

    const parts = payload?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((part: any) => part.inlineData?.data);

    if (!imagePart?.inlineData?.data || !imagePart?.inlineData?.mimeType) {
      return {
        requestId: crypto.randomUUID(),
        status: 'failed',
        error: 'Vertex AI did not return an image',
      };
    }

    return {
      requestId: crypto.randomUUID(),
      status: 'completed',
      image: {
        data: imagePart.inlineData.data,
        mimeType: imagePart.inlineData.mimeType,
      },
    };
  },

  async checkStatus(_requestId: string): Promise<StatusResult> {
    return { status: 'failed', error: 'Vertex AI requests are completed during submission' };
  },

  async cancelGeneration(_requestId: string): Promise<void> {
    return;
  },
};
