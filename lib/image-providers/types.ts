/** The aspect ratios every provider's size map supports. */
export type AspectRatio = '1:1' | '4:5' | '9:16' | '16:9' | '3:4';

export interface GenerateParams {
  prompt: string;
  referenceImageUrls?: string[];
  /**
   * Override the generation quality for this specific call.
   * Falls back to OPENAI_IMAGE_QUALITY env var, then 'high'.
   */
  quality?: 'low' | 'medium' | 'high';
  /**
   * Lasso selection mask exported from the browser canvas as a PNG data URI.
   * The selected area is filled red (rgba ~239,68,68); the rest is transparent.
   *
   * Providers may support this differently. The current app flow strips this
   * from provider calls and lets the submit route composite the selected area
   * from the generated image back onto the original.
   */
  maskDataUrl?: string;
  aspectRatio: AspectRatio;
  modelId?: string;
  /**
   * Optional hard-block list. Not all providers support a native
   * negative_prompt field (xAI does not), so the provider is responsible for
   * folding this into the prompt text as "Avoid: a, b, c." Callers should
   * pass an already-joined string (comma-separated is conventional).
   */
  negativePrompt?: string;
}

export interface GeneratedAsset {
  data: string;
  mimeType: string;
}

export interface GenerateResult {
  requestId: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'nsfw';
  statusUrl?: string;
  image?: GeneratedAsset;
  error?: string;
}

export interface StatusResult {
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'nsfw';
  images?: { url: string }[];
  error?: string;
}

export interface ImageProvider {
  submitGeneration(params: GenerateParams): Promise<GenerateResult>;
  checkStatus(requestId: string): Promise<StatusResult>;
  cancelGeneration(requestId: string): Promise<void>;
}
