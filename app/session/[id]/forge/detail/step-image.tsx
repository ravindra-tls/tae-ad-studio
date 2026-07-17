'use client';

/**
 * Step 3 — the rendered ad. Progress + rotating art-direction narration
 * while in flight; once the image exists it renders in the shared ImageCard
 * (hover Download + Regenerate, no prompt flip) with a link to the session
 * results.
 */

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, TriangleAlert } from 'lucide-react';
import { ImageCard } from '@/components/ImageCard';
import { downloadImage } from '@/lib/utils';
import { GEN_MSGS, useRotatingMessage } from '../state/messages';
import { ProgressPill } from '../board/board-tabs';
import type { GeneratedImage } from '@/types';

export interface GenState {
  status: 'idle' | 'loading' | 'done' | 'error';
  url?: string;
  error?: string;
}

export function StepImage({
  gen,
  aspectRatio,
  onBack,
  onRegenerate,
  resultsHref,
}: {
  gen: GenState;
  /** Aspect of the generated ad — keeps the card from cropping non-square renders. */
  aspectRatio?: string;
  onBack: () => void;
  onRegenerate: () => void;
  resultsHref: string;
}) {
  const message = useRotatingMessage(GEN_MSGS, gen.status === 'loading', 3500);

  // Minimal GeneratedImage shell so the shared card can render the forge output.
  const cardImage = useMemo<GeneratedImage>(() => ({
    id:            'forge-preview',
    session_id:    '',
    prompt_used:   '',
    aspect_ratio:  aspectRatio || '1:1',
    image_url:     gen.url ?? null,
    api_provider:  '',
    model_id:      null,
    request_id:    null,
    template_id:   null,
    status:        'completed',
    error_message: null,
    created_at:    '',
  }), [gen.url, aspectRatio]);

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 self-start text-xs font-medium text-brand-slate hover:text-brand-forest"
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        Change template or prompt
      </button>

      {gen.status === 'loading' && (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-brand-sage/25 bg-white p-5">
          <div className="flex items-center gap-2">
            <ProgressPill />
            <span key={message} className="animate-fade-in text-xs text-brand-slate">
              {message}
            </span>
          </div>
          <p className="text-[11px] text-brand-slate/60">
            Rendering with GPT Image-2 — usually 10–30s
          </p>
        </div>
      )}

      {gen.status === 'error' && (
        <div className="flex items-start gap-1.5 rounded-lg border border-brand-wine/30 bg-brand-wine/5 px-3 py-2.5 text-xs leading-snug text-brand-wine">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{gen.error || 'Image generation failed.'}</span>
        </div>
      )}

      {gen.status === 'done' && gen.url && (
        <>
          <div className="w-full max-w-xl animate-fade-in">
            <ImageCard
              image={cardImage}
              hidePrompt
              onDownload={() => void downloadImage(gen.url as string, `forge-ad-${Date.now()}.png`)}
              onRegenerate={onRegenerate}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href={resultsHref}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-forest underline-offset-2 hover:underline"
            >
              View in session results
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
