'use client';

/**
 * Generation drawer — "Show my thinking" panel that slides in from the right
 * when the marketer clicks Continue from the concept gallery.
 *
 * Runs the orchestrator (/api/pipeline/generate) once per selected concept,
 * sequentially. The concept limit at checkpoint 2 is 2, so this is 1-2 runs
 * per open. We surface a live stage-by-stage trace so the marketer sees the
 * AI working instead of staring at a 30-60s blank loader.
 *
 * Why sequential over parallel?
 *   - Keeps the SSE event stream readable (one concept's state visible at a
 *     time).
 *   - Halves peak LLM + image-gen load on the backend.
 *   - Halts fan-out on the first failure, which matches how marketers
 *     actually think: "if concept 1 is broken, stop and let me fix it."
 *
 * Per-run state lives in useGenerationStream; this component owns the
 * *across-run* sequencing + final summary.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  X,
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  Sparkles,
  Image as ImageIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  useGenerationStream,
  type AspectRatio,
  type StageName,
  type GenerationMeta,
  type RenderRequestSnapshot,
} from '@/lib/hooks/use-generation-stream';
import type { Concept } from '@/types';

interface RunResult {
  conceptId: string;
  status: 'completed' | 'failed';
  meta: GenerationMeta;
  error?: string;
}

interface GenerationDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Concepts queued to run. Order is the run order. */
  concepts: Concept[];
  aspectRatio: AspectRatio;
  /** Pass-through to orchestrator — see AspectRatioPicker sibling toggle. */
  useReferences: boolean;
  sessionId: string;
}

const STAGE_LABELS: Record<StageName, string> = {
  copy: 'Writing copy',
  visual: 'Designing visual spec',
  render: 'Rendering image',
  critique: 'Critiquing bundle',
  refine: 'Refining weak axis',
};

const STAGE_HINTS: Record<StageName, string> = {
  copy: 'Headline, subhead, body, CTA — 3 alternates each.',
  visual: 'Composition, lighting, text zones, then assembles the image prompt.',
  render: 'xAI generates the raw image. References honored if the product has them.',
  critique: 'Adversarial pass on the assembled bundle. Verdict: pass | refine | reject.',
  refine: 'One bounded pass on the weakest axis. Re-renders image if visual is refined.',
};

export function GenerationDrawer({
  open,
  onClose,
  concepts,
  aspectRatio,
  useReferences,
  sessionId,
}: GenerationDrawerProps) {
  // activeIndex walks through concepts sequentially. -1 = not started yet.
  const [activeIndex, setActiveIndex] = useState(-1);
  const [results, setResults] = useState<RunResult[]>([]);
  const { state, start, reset, cancel } = useGenerationStream();

  // ESC key to close — but only if nothing is streaming (don't kill a run by accident).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && state.status !== 'streaming') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, state.status, onClose]);

  // Kick off the first concept on open.
  const startedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!open) return;
    if (concepts.length === 0) return;
    if (activeIndex === -1) {
      setActiveIndex(0);
    }
  }, [open, concepts.length, activeIndex]);

  // Whenever activeIndex points at a concept we haven't started yet, kick it off.
  useEffect(() => {
    if (!open) return;
    if (activeIndex < 0 || activeIndex >= concepts.length) return;
    const concept = concepts[activeIndex];
    if (startedFor.current === concept.id) return;
    startedFor.current = concept.id;
    reset();
    void start({
      concept_id: concept.id,
      aspect_ratio: aspectRatio,
      alternates: 3,
      auto_refine: true,
      use_references: useReferences,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeIndex, concepts, useReferences]);

  // When the current run terminates, capture its result and either advance
  // to the next concept or stop.
  useEffect(() => {
    if (state.status !== 'completed' && state.status !== 'failed') return;
    if (activeIndex < 0 || activeIndex >= concepts.length) return;
    const concept = concepts[activeIndex];

    setResults((prev) => {
      // Idempotent: don't double-append if this effect re-fires on state tweaks.
      if (prev.some((r) => r.conceptId === concept.id)) return prev;
      return [
        ...prev,
        {
          conceptId: concept.id,
          status: state.status === 'completed' ? 'completed' : 'failed',
          meta: state.meta,
          error: state.error,
        },
      ];
    });

    // Advance on completed. Halt the whole run on first failure so the user
    // can address it rather than burning usage on a broken concept.
    if (state.status === 'completed' && activeIndex + 1 < concepts.length) {
      // Give the UI a beat to show the completed state before moving on.
      const timer = setTimeout(() => setActiveIndex((i) => i + 1), 600);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  // Reset local state when the drawer closes so reopening starts fresh.
  useEffect(() => {
    if (open) return;
    setActiveIndex(-1);
    setResults([]);
    startedFor.current = null;
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const activeConcept = useMemo(
    () => (activeIndex >= 0 && activeIndex < concepts.length ? concepts[activeIndex] : null),
    [activeIndex, concepts],
  );

  const allDone =
    results.length > 0 &&
    results.length === concepts.length &&
    state.status !== 'streaming';

  const anyFailed = results.some((r) => r.status === 'failed');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex" aria-modal="true" role="dialog">
      {/* Backdrop */}
      <button
        type="button"
        className="flex-1 bg-black/30 backdrop-blur-sm"
        aria-label="Close drawer"
        onClick={() => {
          if (state.status === 'streaming') return; // ignore; user must cancel explicitly
          onClose();
        }}
      />

      {/* Drawer panel */}
      <div className="flex h-full w-full max-w-xl flex-col overflow-hidden bg-brand-cream shadow-2xl animate-slide-in-right">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-brand-teal/15 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-brand-teal" />
            <div>
              <h2 className="text-base font-semibold text-brand-forest">
                Show my thinking
              </h2>
              <p className="mt-0.5 text-xs text-brand-slate">
                {concepts.length === 1
                  ? 'Running the full pipeline on your selected concept.'
                  : `Running the pipeline on ${concepts.length} selected concepts, one at a time.`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={state.status === 'streaming'}
            className="rounded-md p-1 text-brand-slate transition-colors hover:bg-brand-teal/5 hover:text-brand-forest disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Concept progress chip */}
          {concepts.length > 1 && (
            <div className="mb-4 flex items-center gap-2 text-xs text-brand-slate">
              <Badge variant="outline" className="border-brand-teal/30 text-brand-teal">
                Concept {Math.max(1, activeIndex + 1)} of {concepts.length}
              </Badge>
              {activeConcept && (
                <span className="truncate">
                  {(activeConcept.structured as { title?: string } | null)?.title ??
                    'Untitled concept'}
                </span>
              )}
            </div>
          )}

          {/* Active run stage list */}
          {activeConcept && (
            <div className="space-y-2">
              {state.stages.map((s) => (
                <StageRow
                  key={s.name}
                  name={s.name}
                  label={STAGE_LABELS[s.name]}
                  hint={STAGE_HINTS[s.name]}
                  status={s.status}
                  durationMs={s.durationMs}
                  error={s.error}
                />
              ))}
            </div>
          )}

          {/* Image-provider call diagnostics — one block per render pass. */}
          {state.renderRequests.length > 0 && (
            <div className="mt-5 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-brand-slate">
                Sent to image model
              </h3>
              {state.renderRequests.map((req, i) => (
                <RenderRequestCard key={i} request={req} />
              ))}
            </div>
          )}

          {/* Stream-level error (persistence failure etc.) */}
          {state.error && state.status === 'streaming' && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{state.error}</span>
            </div>
          )}

          {/* Per-concept results (shown once at least one concept finishes) */}
          {results.length > 0 && (
            <div className="mt-6 space-y-3 border-t border-brand-teal/10 pt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-brand-slate">
                Results
              </h3>
              {results.map((r, i) => {
                const concept = concepts.find((c) => c.id === r.conceptId);
                const title =
                  (concept?.structured as { title?: string } | null)?.title ??
                  `Concept ${i + 1}`;
                return (
                  <ResultCard
                    key={r.conceptId}
                    title={title}
                    result={r}
                    sessionId={sessionId}
                  />
                );
              })}
            </div>
          )}

          {/* Terminal footer */}
          {allDone && (
            <div className="mt-6 rounded-md border border-brand-teal/20 bg-white px-4 py-3 text-sm text-brand-forest">
              {anyFailed
                ? 'Pipeline finished with errors. Results shown above.'
                : 'All concepts generated successfully.'}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between border-t border-brand-teal/15 bg-white px-6 py-3">
          <div className="text-xs text-brand-slate">
            {state.status === 'streaming'
              ? 'Streaming…'
              : allDone
                ? anyFailed
                  ? 'Finished with errors'
                  : 'Done'
                : 'Idle'}
          </div>
          <div className="flex items-center gap-2">
            {state.status === 'streaming' ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  cancel();
                  onClose();
                }}
              >
                Cancel
              </Button>
            ) : allDone ? (
              <Link
                href={`/session/${sessionId}/results`}
                className="inline-flex items-center gap-1.5 rounded-md bg-brand-teal px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-teal/90"
                onClick={onClose}
              >
                View in results
              </Link>
            ) : (
              <Button size="sm" variant="outline" onClick={onClose}>
                Close
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StageRow({
  label,
  hint,
  status,
  durationMs,
  error,
}: {
  name: StageName;
  label: string;
  hint: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  durationMs?: number;
  error?: string;
}) {
  const icon =
    status === 'running' ? (
      <Loader2 className="h-4 w-4 animate-spin text-brand-teal" />
    ) : status === 'completed' ? (
      <CheckCircle2 className="h-4 w-4 text-brand-teal" />
    ) : status === 'failed' ? (
      <AlertCircle className="h-4 w-4 text-brand-wine" />
    ) : (
      <Circle className="h-4 w-4 text-brand-slate/40" />
    );

  const textClass =
    status === 'pending'
      ? 'text-brand-slate/60'
      : status === 'failed'
        ? 'text-brand-wine'
        : 'text-brand-forest';

  return (
    <div className="flex items-start gap-3 rounded-md border border-brand-teal/10 bg-white px-3 py-2.5">
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-sm font-medium ${textClass}`}>{label}</span>
          {durationMs !== undefined && status === 'completed' && (
            <span className="text-xs text-brand-slate">
              {(durationMs / 1000).toFixed(1)}s
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-brand-slate">{hint}</p>
        {error && (
          <p className="mt-1 text-xs text-brand-wine">{error}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Diagnostic card that shows, in one block, the exact inputs we handed to
 * the image provider on a given pass: endpoint chosen, final prompt (with
 * aspect-ratio hint and negatives already folded in on the server side —
 * this view renders the raw visual_specs.prompt_text plus the negatives
 * separately so the marketer can see what each piece contributes), ref
 * images if any, and aspect ratio.
 *
 * We deliberately show the negatives on their own line rather than
 * re-concatenating with "Avoid: …" — the drawer is a debugging surface
 * and separating the pieces reads more clearly than a wall of prose.
 */
function RenderRequestCard({ request }: { request: RenderRequestSnapshot }) {
  const endpointLabel =
    request.endpoint === 'edits' ? 'xAI /edits' : 'xAI /generations';
  return (
    <div className="rounded-md border border-brand-teal/15 bg-white p-3 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="border-brand-teal/30 text-brand-teal">
          {request.pass === 'initial' ? 'Initial render' : 'Refine re-render'}
        </Badge>
        <Badge variant="outline" className="border-brand-slate/30 text-brand-slate">
          {endpointLabel}
        </Badge>
        <Badge variant="outline" className="border-brand-slate/30 text-brand-slate">
          {request.aspect_ratio}
        </Badge>
        <Badge variant="outline" className="border-brand-slate/30 text-brand-slate">
          {request.reference_image_urls.length} ref
          {request.reference_image_urls.length === 1 ? '' : 's'}
        </Badge>
      </div>

      <div className="mt-2">
        <div className="text-[10px] uppercase tracking-wide text-brand-slate">
          Prompt
        </div>
        <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-brand-cream/50 p-2 font-mono text-[11px] leading-snug text-brand-navy">
          {request.prompt}
        </pre>
      </div>

      {request.negative_prompt && (
        <div className="mt-2">
          <div className="text-[10px] uppercase tracking-wide text-brand-slate">
            Negatives (appended as &quot;Avoid: …&quot;)
          </div>
          <p className="mt-1 rounded bg-brand-wine/5 p-2 font-mono text-[11px] leading-snug text-brand-wine/90">
            {request.negative_prompt}
          </p>
        </div>
      )}

      {request.reference_image_urls.length > 0 && (
        <div className="mt-2">
          <div className="text-[10px] uppercase tracking-wide text-brand-slate">
            Reference images
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            {request.reference_image_urls.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
                title={`Reference ${i + 1} (opens in new tab)`}
              >
                <img
                  src={url}
                  alt={`Reference ${i + 1}`}
                  className="h-14 w-14 rounded border border-brand-teal/15 object-cover"
                />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ResultCard({
  title,
  result,
  sessionId: _sessionId,
}: {
  title: string;
  result: RunResult;
  sessionId: string;
}) {
  const verdictTone =
    result.meta.critique_verdict === 'reject'
      ? 'border-brand-wine/30 text-brand-wine'
      : result.meta.critique_verdict === 'refine'
        ? 'border-amber-400/50 text-amber-800'
        : 'border-brand-teal/30 text-brand-teal';

  return (
    <div className="flex gap-3 rounded-md border border-brand-teal/15 bg-white p-3">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded border border-brand-teal/10 bg-brand-cream/50">
        {result.meta.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={result.meta.image_url}
            alt={title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-brand-slate/40">
            <ImageIcon className="h-5 w-5" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-brand-forest">
            {title}
          </span>
          {result.status === 'failed' ? (
            <Badge variant="outline" className="border-brand-wine/40 text-brand-wine">
              Failed
            </Badge>
          ) : (
            <Badge variant="outline" className="border-brand-teal/30 text-brand-teal">
              Done
            </Badge>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
          {result.meta.critique_verdict && (
            <Badge variant="outline" className={verdictTone}>
              Critique: {result.meta.critique_verdict}
            </Badge>
          )}
          {result.meta.refined && (
            <Badge variant="outline" className="border-brand-teal/30 text-brand-teal">
              Refined {result.meta.refined.target}
            </Badge>
          )}
        </div>
        {result.error && (
          <p className="mt-1 text-xs text-brand-wine">{result.error}</p>
        )}
      </div>
    </div>
  );
}
