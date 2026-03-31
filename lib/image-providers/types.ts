export interface GenerateParams {
  prompt: string;
  referenceImageUrls?: string[];
  aspectRatio: '1:1' | '4:5' | '9:16' | '16:9' | '3:4';
  modelId?: string;
}

export interface GenerateResult {
  requestId: string;
  statusUrl: string;
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
