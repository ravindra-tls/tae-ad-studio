'use client';

/**
 * useGenerationStream — client hook that drives /api/pipeline/generate.
 *
 * Opens a POST stream, reads SSE frames, and projects them onto a
 * normalized state shape that the drawer can render without knowing
 * the wire protocol. The orchestrator emits a single `message` event
 * type with a JSON payload discriminated by `type`:
 *
 *   pipeline_start | stage_start | stage_complete | stage_error | done
 *
 * Two kinds of stage events flow over the wire:
 *   - Real stage steps (name = "copy" | "visual" | "render" | "critique" | "refine")
 *   - Persistence pseudo-steps (name = "copy.persisted" | "visual.persisted" | ...)
 *
 * The pseudo-steps carry IDs (copy_block_id, visual_spec_id, generated_image_id,
 * image_url) that the drawer needs but aren't themselves "work the AI is doing".
 * We project them onto a single `meta` bag and reserve the `stages` array for
 * real steps only, so the UI renders a clean progress list.
 *
 * ─ Why POST + fetch reader instead of EventSource?
 *   EventSource is GET-only; we need a body (concept_id, aspect_ratio, etc).
 *   So we read the stream manually with TextDecoder and parse the SSE frames
 *   ourselves. Standard pattern — SSE is just text with `data: …\n\n` fences.
 */

import { useCallback, useRef, useState } from 'react';

export type AspectRatio = '1:1' | '4:5' | '9:16' | '16:9' | '3:4';

export interface GenerateRequestBody {
  concept_id: string;
  aspect_ratio: AspectRatio;
  alternates?: number;
  judge_notes?: string;
  auto_refine?: boolean;
  /**
   * Opt-in: ship reference product images to the image model. Defaults
   * server-side to false. Currently this flips xAI from /generations to
   * /edits, which is stronger on product likeness but weaker on composition.
   */
  use_references?: boolean;
}

/**
 * Mirror of the server's `render_request` event. Emitted right before each
 * image-provider call so the drawer can show the marketer exactly what
 * we're about to send. Captured by the hook per pass and exposed on state.
 */
export interface RenderRequestSnapshot {
  pass: 'initial' | 'refine';
  endpoint: 'edits' | 'generations';
  prompt: string;
  negative_prompt: string | null;
  aspect_ratio: AspectRatio;
  reference_image_urls: string[];
}

export type StageName = 'prompt' | 'copy' | 'visual' | 'render' | 'critique' | 'refine';

export interface StageState {
  name: StageName;
  status: 'pending' | 'running' | 'completed' | 'failed';
  /** Set when we observe stage_start */
  startedAt?: number;
  /** Set when we observe stage_complete */
  durationMs?: number;
  /** Populated when stage_error fires */
  error?: string;
}

export interface GenerationMeta {
  copy_block_id?: string;
  visual_spec_id?: string;
  critique_id?: string;
  critique_verdict?: 'pass' | 'refine' | 'reject';
  refined?: { target: 'copy' | 'visual'; id: string };
  generated_image_id?: string;
  image_url?: string;
}

export interface GenerationStreamState {
  status: 'idle' | 'streaming' | 'completed' | 'failed';
  stages: StageState[];
  meta: GenerationMeta;
  error?: string;
  /** The concept_id currently being generated, if streaming. */
  activeConceptId?: string;
  /**
   * Diagnostic log of every image-provider call made in this run. The drawer
   * renders these so the marketer can see the final prompt + refs we sent.
   * Ordered: [0] = initial render, [1+] = refine re-renders (at most 1 today).
   */
  renderRequests: RenderRequestSnapshot[];
}

/** Default ordered stage skeleton for the full pipeline. Refine slots stay pending unless used. */
const INITIAL_STAGES: StageState[] = [
  { name: 'copy', status: 'pending' },
  { name: 'visual', status: 'pending' },
  { name: 'render', status: 'pending' },
  { name: 'critique', status: 'pending' },
  { name: 'refine', status: 'pending' },
];

/** Stage skeleton for the direct (2-stage) pipeline. */
const DIRECT_STAGES: StageState[] = [
  { name: 'prompt', status: 'pending' },
  { name: 'render', status: 'pending' },
];

const KNOWN_STAGES: StageName[] = ['prompt', 'copy', 'visual', 'render', 'critique', 'refine'];

function isKnownStage(name: string): name is StageName {
  return (KNOWN_STAGES as string[]).includes(name);
}

/**
 * Parse a raw SSE chunk into zero-or-more JSON payloads.
 *
 * SSE frames are separated by a blank line (`\n\n`). Each frame may span
 * multiple lines but for our producer every payload is a single `data:` line.
 * We buffer across chunk boundaries so a frame split across TCP packets is
 * still reconstructed correctly.
 */
function extractFrames(buffer: string): { frames: string[]; remainder: string } {
  const frames: string[] = [];
  let remainder = buffer;
  let idx = remainder.indexOf('\n\n');
  while (idx !== -1) {
    const frame = remainder.slice(0, idx);
    remainder = remainder.slice(idx + 2);
    if (frame.startsWith('data: ')) {
      frames.push(frame.slice(6));
    } else if (frame.startsWith('data:')) {
      frames.push(frame.slice(5));
    }
    // Non-data lines (e.g. `:keepalive`) are ignored.
    idx = remainder.indexOf('\n\n');
  }
  return { frames, remainder };
}

export function useGenerationStream() {
  const [state, setState] = useState<GenerationStreamState>({
    status: 'idle',
    stages: INITIAL_STAGES.map((s) => ({ ...s })),
    meta: {},
    renderRequests: [],
  });

  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setState({
      status: 'idle',
      stages: INITIAL_STAGES.map((s) => ({ ...s })),
      meta: {},
      renderRequests: [],
    });
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState((prev) =>
      prev.status === 'streaming'
        ? { ...prev, status: 'failed', error: prev.error ?? 'Cancelled' }
        : prev,
    );
  }, []);

  const start = useCallback(async (body: GenerateRequestBody, endpoint?: string) => {
    // Reset any prior run
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const resolvedEndpoint = endpoint ?? '/api/pipeline/generate';
    const isDirect = resolvedEndpoint === '/api/pipeline/direct-generate';

    setState({
      status: 'streaming',
      stages: isDirect
        ? DIRECT_STAGES.map((s) => ({ ...s }))
        : INITIAL_STAGES.map((s) => ({ ...s })),
      meta: {},
      renderRequests: [],
      activeConceptId: body.concept_id,
    });

    let response: Response;
    try {
      response = await fetch(resolvedEndpoint, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState((prev) => ({ ...prev, status: 'failed', error: msg }));
      return;
    }

    // Non-200 responses are plain JSON errors; the stream never opens.
    if (!response.ok) {
      let msg = `HTTP ${response.status}`;
      try {
        const data = await response.json();
        if (data?.error) msg = data.error;
      } catch {
        /* ignore parse failure */
      }
      setState((prev) => ({ ...prev, status: 'failed', error: msg }));
      return;
    }

    if (!response.body) {
      setState((prev) => ({
        ...prev,
        status: 'failed',
        error: 'Stream body was empty',
      }));
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      // Read loop. Each chunk may contain 0+ complete SSE frames; we parse
      // as much as we can and stash the tail for the next iteration.
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const { frames, remainder } = extractFrames(buffer);
        buffer = remainder;

        for (const raw of frames) {
          try {
            const payload = JSON.parse(raw);
            setState((prev) => applyEvent(prev, payload));
          } catch (err) {
            console.error('[use-generation-stream] bad JSON frame:', raw, err);
          }
        }
      }
    } catch (err) {
      if (controller.signal.aborted) {
        // Normal cancel path — state already updated in cancel()
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      setState((prev) => ({ ...prev, status: 'failed', error: msg }));
    }
  }, []);

  return { state, start, reset, cancel };
}

/**
 * Reducer for server events. Keeping it pure so React gets a stable snapshot
 * per event; setState(applyEvent(prev, ev)) is easier to reason about than
 * mutating the stages array in place.
 */
function applyEvent(
  prev: GenerationStreamState,
  event: Record<string, unknown>,
): GenerationStreamState {
  const type = event.type as string | undefined;
  const stageName = event.stage as string | undefined;

  switch (type) {
    case 'pipeline_start': {
      return prev; // already reset in start()
    }

    case 'render_request': {
      const snap: RenderRequestSnapshot = {
        pass: event.pass as RenderRequestSnapshot['pass'],
        endpoint: event.endpoint as RenderRequestSnapshot['endpoint'],
        prompt: String(event.prompt ?? ''),
        negative_prompt:
          typeof event.negative_prompt === 'string' ? event.negative_prompt : null,
        aspect_ratio: event.aspect_ratio as AspectRatio,
        reference_image_urls: Array.isArray(event.reference_image_urls)
          ? (event.reference_image_urls as string[])
          : [],
      };
      return { ...prev, renderRequests: [...prev.renderRequests, snap] };
    }

    case 'stage_start': {
      if (!stageName || !isKnownStage(stageName)) return prev;
      return {
        ...prev,
        stages: prev.stages.map((s) =>
          s.name === stageName
            ? { ...s, status: 'running', startedAt: Number(event.at) }
            : s,
        ),
      };
    }

    case 'stage_complete': {
      if (!stageName) return prev;
      const output = (event.output as Record<string, unknown>) ?? {};
      const duration = Number(event.durationMs ?? 0);

      // Pseudo-stages (dot-suffixed) only carry IDs; fold into `meta`.
      if (!isKnownStage(stageName)) {
        const meta: GenerationMeta = { ...prev.meta };
        if (typeof output.copy_block_id === 'string') {
          // On refine, overwrite so meta.copy_block_id always points at
          // the freshest copy. Target === 'copy' branch sets this.
          meta.copy_block_id = output.copy_block_id;
        }
        if (typeof output.visual_spec_id === 'string') {
          meta.visual_spec_id = output.visual_spec_id;
        }
        if (typeof output.critique_id === 'string') {
          meta.critique_id = output.critique_id;
        }
        if (typeof output.verdict === 'string') {
          meta.critique_verdict = output.verdict as GenerationMeta['critique_verdict'];
        }
        if (typeof output.generated_image_id === 'string') {
          meta.generated_image_id = output.generated_image_id;
        }
        if (typeof output.image_url === 'string') {
          meta.image_url = output.image_url;
        }
        if (stageName.startsWith('refine.') && typeof output.target === 'string') {
          const target = output.target as 'copy' | 'visual';
          const id =
            target === 'copy'
              ? (output.copy_block_id as string | undefined)
              : (output.visual_spec_id as string | undefined);
          if (id) meta.refined = { target, id };
        }
        return { ...prev, meta };
      }

      // Real stage: mark completed with duration.
      return {
        ...prev,
        stages: prev.stages.map((s) =>
          s.name === stageName ? { ...s, status: 'completed', durationMs: duration } : s,
        ),
      };
    }

    case 'stage_error': {
      if (!stageName) return prev;
      const err = String(event.error ?? 'Stage failed');
      if (!isKnownStage(stageName)) {
        // Pseudo-stage errors (e.g. persistence) are surfaced at the top
        // level so the user sees them, but don't flip any stage row red.
        return { ...prev, error: prev.error ? `${prev.error}; ${err}` : err };
      }
      return {
        ...prev,
        stages: prev.stages.map((s) =>
          s.name === stageName ? { ...s, status: 'failed', error: err } : s,
        ),
      };
    }

    case 'done': {
      const finalStatus =
        event.status === 'completed' ? ('completed' as const) : ('failed' as const);
      const meta: GenerationMeta = { ...prev.meta };
      if (typeof event.generated_image_id === 'string') {
        meta.generated_image_id = event.generated_image_id;
      }
      if (typeof event.image_url === 'string') {
        meta.image_url = event.image_url;
      }

      // Any stage still pending when we hit `done` was skipped (e.g. no
      // refine). Mark it 'completed' visually only if we reached a good
      // terminal state; otherwise leave it as pending so the user sees
      // the pipeline stopped short.
      const stages =
        finalStatus === 'completed'
          ? prev.stages.map((s) =>
              s.status === 'pending' ? { ...s, status: 'completed' as const } : s,
            )
          : prev.stages;

      return {
        ...prev,
        status: finalStatus,
        stages,
        meta,
        error: typeof event.error === 'string' ? event.error : prev.error,
      };
    }

    default:
      return prev;
  }
}
