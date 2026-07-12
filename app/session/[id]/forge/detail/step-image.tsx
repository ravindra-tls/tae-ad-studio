'use client';

/**
 * Step 3 — the rendered ad. Progress + rotating art-direction narration
 * while in flight; once the image exists it speaks for itself: Download,
 * Regenerate, and a link to the session results.
 */

import Link from 'next/link';
import { ArrowRight, ChevronLeft, Download, RotateCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadImage } from '@/lib/utils';
import { GEN_MSGS, useRotatingMessage } from '../state/messages';
import { ProgressPill } from '../board/board-tabs';

export interface GenState {
  status: 'idle' | 'loading' | 'done' | 'error';
  url?: string;
  error?: string;
}

export function StepImage({
  gen,
  onBack,
  onRegenerate,
  resultsHref,
}: {
  gen: GenState;
  onBack: () => void;
  onRegenerate: () => void;
  resultsHref: string;
}) {
  const message = useRotatingMessage(GEN_MSGS, gen.status === 'loading', 3500);

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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={gen.url}
            alt="Generated ad"
            className="w-full max-w-xl animate-fade-in rounded-xl border border-brand-sage/25 shadow-md"
          />
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              className="gap-1.5"
              onClick={() => void downloadImage(gen.url as string, `forge-ad-${Date.now()}.png`)}
            >
              <Download className="h-4 w-4" aria-hidden />
              Download image
            </Button>
            <Button variant="outline" className="gap-1.5" onClick={onRegenerate}>
              <RotateCw className="h-4 w-4" aria-hidden />
              Regenerate
            </Button>
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
