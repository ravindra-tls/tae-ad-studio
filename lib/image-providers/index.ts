/**
 * ─── Image provider registry ─────────────────────────────────────────────────
 *
 * Active (2026-04-26): OpenAI gpt-image-1 is the current provider.
 * xAI (aurora) and Vertex AI (Gemini 3 Pro Image) implementations are kept
 * for rollback and future evaluation.
 *
 * Selection: env var IMAGE_PROVIDER=openai|xai|vertex. Default = openai.
 *
 * DO NOT let this file drift — update the comment when the active provider
 * changes so intent is readable from the code.
 */
import { xai,    getGeneratedFileExtension as xaiExt    } from './xai';
import { vertex, getGeneratedFileExtension as vertexExt } from './vertex';
import { openai, getGeneratedFileExtension as openaiExt } from './openai';

const provider = (process.env.IMAGE_PROVIDER || 'openai').toLowerCase();

export const imageProvider =
  provider === 'vertex' ? vertex :
  provider === 'xai'    ? xai    :
  openai;

export const getGeneratedFileExtension =
  provider === 'vertex' ? vertexExt :
  provider === 'xai'    ? xaiExt    :
  openaiExt;

export type {
  GenerateParams,
  GenerateResult,
  StatusResult,
  ImageProvider,
} from './types';
