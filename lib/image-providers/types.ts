export interface GenerateParams {
  prompt: string;
  referenceImageUrls?: string[];
  aspectRatio: '1:1' | '4:5' | '9:16' | '16:9' | '3:4';
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
