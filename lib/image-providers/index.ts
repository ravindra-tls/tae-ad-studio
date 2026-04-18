/**
 * ─── Image provider registry ─────────────────────────────────────────────────
 *
 * V1 state (2026-04-18): xAI is the TEMPORARY default image-gen provider while
 * Vertex AI (Gemini 3 Pro Image) is being wired up as the target. The Vertex
 * implementation already exists in ./vertex.ts — switching is a one-line change
 * here plus env config, but we are intentionally not cutting over until Vertex
 * has been validated end-to-end in production.
 *
 * Selection: env var IMAGE_PROVIDER=vertex|xai. Default = xai for V1.
 *
 * DO NOT let this file drift — if you are reading this and we have cut over to
 * Vertex, update the comment and flip the default so the intent is readable
 * from the code, not from the V1 plan doc.
 */
import { xai, getGeneratedFileExtension as xaiExt } from './xai';
import { vertex, getGeneratedFileExtension as vertexExt } from './vertex';

const provider = (process.env.IMAGE_PROVIDER || 'xai').toLowerCase();

export const imageProvider = provider === 'vertex' ? vertex : xai;
export const getGeneratedFileExtension =
  provider === 'vertex' ? vertexExt : xaiExt;

export type {
  GenerateParams,
  GenerateResult,
  StatusResult,
  ImageProvider,
} from './types';
