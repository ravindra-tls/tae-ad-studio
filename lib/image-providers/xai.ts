import type { GenerateParams, GenerateResult, ImageProvider, StatusResult } from './types';

/**
 * xAI has two separate image endpoints with different capabilities:
 *
 *   /v1/images/generations — pure text-to-image. No reference image input.
 *   /v1/images/edits       — text + reference image(s) → new image. Accepts
 *                            up to 5 reference images (public URLs or base64
 *                            data URIs) and supports `aspect_ratio` natively.
 *
 * When the caller passes `referenceImageUrls`, we route to /edits so the
 * references are actually honored. With no references, we stay on
 * /generations (historical behavior; aspect ratio is steered via prompt text
 * because that path was calibrated before aspect_ratio became first-class).
 *
 * Ref: https://docs.x.ai/developers/model-capabilities/images/generation
 */

const XAI_GENERATIONS_URL = 'https://api.x.ai/v1/images/generations';
const XAI_EDITS_URL       = 'https://api.x.ai/v1/images/edits';
const DEFAULT_MODEL       = 'grok-imagine-image';

/** xAI's documented ceiling for the /edits endpoint. Reject-trim above this. */
const MAX_REFERENCE_IMAGES = 5;

// Map our aspect ratio tokens to a natural-language instruction appended to the
// text-to-image prompt. xAI's /generations path was wired before aspect_ratio
// was a first-class param, and we prefer not to re-calibrate that path here.
const ASPECT_RATIO_HINT: Record<string, string> = {
  '1:1':  'square format (1:1 aspect ratio)',
  '4:5':  'portrait format (4:5 aspect ratio)',
  '9:16': 'vertical portrait format (9:16 aspect ratio)',
  '16:9': 'landscape format (16:9 aspect ratio)',
  '3:4':  'portrait format (3:4 aspect ratio)',
};

/**
 * xAI's /edits endpoint only accepts a fixed enum of aspect_ratio values.
 * Our app exposes `4:5` (Instagram feed portrait) which xAI does NOT support
 * — so we substitute the closest supported ratio and steer the composition
 * via a prompt hint for the missing fraction.
 *
 * Supported by xAI (per docs, April 2026):
 *   1:1, 3:4, 4:3, 9:16, 16:9, 2:3, 3:2, 9:19.5, 19.5:9, 9:20, 20:9, 1:2, 2:1, auto
 *
 * Mapping rationale:
 *   4:5 (=0.80) → 3:4 (=0.75) is the closest supported ratio (Δ 0.05).
 *                 2:3 (=0.667) was the other candidate but is further off.
 */
const XAI_EDITS_SUPPORTED_RATIOS = new Set([
  '1:1', '3:4', '4:3', '9:16', '16:9', '2:3', '3:2',
  '9:19.5', '19.5:9', '9:20', '20:9', '1:2', '2:1', 'auto',
]);

const XAI_EDITS_RATIO_SUBSTITUTE: Record<string, { ratio: string; note: string }> = {
  '4:5': {
    ratio: '3:4',
    // Earlier iterations of this note mentioned "safe margins" and "crop
    // zones" — the image model interpreted that as "paint a beige border at
    // the top and bottom", which is exactly what we don't want. The prompt
    // should only speak to composition intent, never to canvas mechanics.
    note: 'Compose as a full-bleed portrait image — the entire canvas is photographic imagery, no borders, no empty margins, no letterboxing.',
  },
};

function resolveEditsAspectRatio(requested: string): { ratio: string; promptAddendum: string | null } {
  if (XAI_EDITS_SUPPORTED_RATIOS.has(requested)) {
    return { ratio: requested, promptAddendum: null };
  }
  const sub = XAI_EDITS_RATIO_SUBSTITUTE[requested];
  if (sub) {
    console.warn(
      `[xAI] /edits does not support aspect_ratio="${requested}"; substituting "${sub.ratio}" with a composition hint.`,
    );
    return { ratio: sub.ratio, promptAddendum: sub.note };
  }
  console.warn(
    `[xAI] /edits got unknown aspect_ratio="${requested}"; falling back to "1:1".`,
  );
  return { ratio: '1:1', promptAddendum: null };
}

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

/**
 * Build the request body for the /edits endpoint. xAI accepts either a
 * singular `image` (single reference) or an `images` array (up to 5 for
 * multi-reference editing). Ref: https://docs.x.ai/developers/rest-api-reference/inference/images
 *
 * The body shape is literally `{ url: "..." }` per the docs — NOT the
 * OpenAI chat-message `{ type: "image_url", url: "..." }` shape. We made that
 * mistake once; xAI returns a plain-text "Failed to..." error when the shape
 * is wrong, which blows up JSON.parse downstream.
 *
 * For multi-reference, the docs say refer to images as `<IMAGE_0>`, `<IMAGE_1>`
 * etc. in the prompt. Our callers today pass a single brand reference, so we
 * don't rewrite the prompt — noting it here so future multi-ref work knows.
 */
/**
 * xAI has no `negative_prompt` field on either endpoint. We fold the
 * negatives into the prompt text instead, terminated with a period so the
 * model treats it as a directive rather than an extension of the preceding
 * sentence. Kept short — long negative lists start to read as "things to
 * include" to the model.
 */
function appendNegatives(prompt: string, negativePrompt?: string): string {
  const n = negativePrompt?.trim();
  if (!n) return prompt;
  return `${prompt}\n\nAvoid: ${n}.`;
}

function buildEditsBody(params: {
  modelId: string;
  prompt: string;
  aspectRatio: GenerateParams['aspectRatio'];
  refs: string[];
  negativePrompt?: string;
}): { body: Record<string, unknown>; finalPrompt: string; aspectRatio: string } {
  const { ratio, promptAddendum } = resolveEditsAspectRatio(params.aspectRatio);
  const withRatioHint = promptAddendum
    ? `${params.prompt}\n\n${promptAddendum}`
    : params.prompt;
  const finalPrompt = appendNegatives(withRatioHint, params.negativePrompt);

  const base: Record<string, unknown> = {
    model:           params.modelId,
    prompt:          finalPrompt,
    n:               1,
    response_format: 'b64_json',
    aspect_ratio:    ratio,
  };

  if (params.refs.length === 1) {
    base.image = { url: params.refs[0] };
  } else {
    base.images = params.refs.map((url) => ({ url }));
  }

  return { body: base, finalPrompt, aspectRatio: ratio };
}

function buildGenerationsBody(params: {
  modelId: string;
  prompt: string;
  aspectRatio: GenerateParams['aspectRatio'];
  negativePrompt?: string;
}): { body: Record<string, unknown>; finalPrompt: string; aspectRatio: string } {
  const aspectHint =
    ASPECT_RATIO_HINT[params.aspectRatio] ?? 'square format (1:1 aspect ratio)';
  const withRatioHint = `${params.prompt}\n\nCompose this image in ${aspectHint}.`;
  const finalPrompt = appendNegatives(withRatioHint, params.negativePrompt);

  return {
    body: {
      model:           params.modelId,
      prompt:          finalPrompt,
      n:               1,
      response_format: 'b64_json',
    },
    finalPrompt,
    aspectRatio: params.aspectRatio,
  };
}

export const xai: ImageProvider = {
  async submitGeneration(params: GenerateParams): Promise<GenerateResult> {
    const apiKey  = getApiKey();
    const modelId = getModelId(params.modelId);

    // xAI handles reference edits when IMAGE_PROVIDER=xai. Masked edits are
    // routed before they reach this provider.
    const baseRefs = params.referenceImageUrls ?? [];
    const allRefs  = baseRefs;

    const refs = allRefs.slice(0, MAX_REFERENCE_IMAGES);
    if (allRefs.length > MAX_REFERENCE_IMAGES) {
      console.warn(
        `[xAI] ${allRefs.length} refs (incl. mask) truncated to ${MAX_REFERENCE_IMAGES} (xAI /edits ceiling).`,
      );
    }

    const hasRefs = refs.length > 0;
    const url     = hasRefs ? XAI_EDITS_URL : XAI_GENERATIONS_URL;
    const built   = hasRefs
      ? buildEditsBody({
          modelId,
          prompt:         params.prompt,
          aspectRatio:    params.aspectRatio,
          refs,
          negativePrompt: params.negativePrompt,
        })
      : buildGenerationsBody({
          modelId,
          prompt:         params.prompt,
          aspectRatio:    params.aspectRatio,
          negativePrompt: params.negativePrompt,
        });
    const body = built.body;

    console.log(
      `[xAI] ${hasRefs ? `/edits with ${refs.length} reference image(s)` : '/generations (no refs)'}, ` +
      `aspect_ratio=${built.aspectRatio}, prompt_len=${built.finalPrompt.length}`,
    );

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    // xAI sometimes returns plain-text error bodies (e.g. "Failed to fetch
    // image from URL...") for /edits when a reference URL is unreachable or
    // the body shape is off. If we blindly call response.json() on those, the
    // SyntaxError ("Unexpected token 'F'...") leaks out as the user-facing
    // error and buries the actual cause. So: read as text first, try JSON,
    // fall back to the raw text for the error path.
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
        `xAI image ${hasRefs ? 'edit' : 'generation'} failed (HTTP ${response.status})`;
      console.error(
        `[xAI] API error (${hasRefs ? 'edits' : 'generations'}):`,
        response.status,
        rawBody.slice(0, 1000),
      );
      throw new Error(message);
    }

    if (!payload) {
      console.error(
        `[xAI] 2xx response was not valid JSON (${hasRefs ? 'edits' : 'generations'}):`,
        rawBody.slice(0, 500),
      );
      throw new Error('xAI returned a non-JSON response body');
    }

    console.log(
      `[xAI] Response keys (${hasRefs ? 'edits' : 'generations'}):`,
      Object.keys(payload),
    );
    const b64 = payload?.data?.[0]?.b64_json;
    if (!b64) {
      console.error(
        '[xAI] No b64_json in response:',
        JSON.stringify(payload).slice(0, 300),
      );
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
