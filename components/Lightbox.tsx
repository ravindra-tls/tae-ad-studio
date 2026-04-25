'use client';

/**
 * Lightbox — full-screen image viewer with navigation + flip-to-prompt.
 * Portalled to document.body — bypasses all CSS stacking contexts.
 *
 * Layout:
 *  - Full-screen backdrop handles backdrop-click-to-close.
 *  - Close / Prev / Next are inside the card wrapper so they always
 *    sit adjacent to the card, not floating at viewport edges.
 *  - "View Prompt"  slides up from bottom on hover  (same as ImageCard)
 *  - Download + Star fade in from right on hover     (opacity approach)
 *  - Click "View Prompt" → 3D flip identical to ImageCard
 */

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X, ChevronLeft, ChevronRight,
  FileText, Copy, Check, Download, Star, ArrowLeft, Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GeneratedImage } from '@/types';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface LightboxCreatorInfo {
  name:     string;
  initials: string;
}

interface LightboxProps {
  images:       GeneratedImage[];
  startIndex:   number;
  onClose:      () => void;
  creatorMap?:  Map<string, LightboxCreatorInfo>;
  onDownload?:  (image: GeneratedImage) => void;
  onStar?:      (imageId: string) => void;
  isStarred?:   (imageId: string) => boolean;
  onEdit?:      (image: GeneratedImage) => void;
}

// ─── Injected styles ──────────────────────────────────────────────────────────

const LIGHTBOX_STYLES = `
  /* 3-keyframe flip — matches ImageCard exactly */
  @keyframes lb-flip-to-back {
    0%   { transform: rotateY(0deg)   scale(1);    }
    45%  { transform: rotateY(90deg)  scale(0.88); }
    100% { transform: rotateY(180deg) scale(1);    }
  }
  @keyframes lb-flip-to-front {
    0%   { transform: rotateY(180deg) scale(1);    }
    45%  { transform: rotateY(90deg)  scale(0.88); }
    100% { transform: rotateY(0deg)   scale(1);    }
  }
  .lb-flip-card  { perspective: 900px; }
  .lb-flip-inner {
    transform-style: preserve-3d;
    position: relative; width: 100%; height: 100%;
  }
  .lb-flip-inner.is-back       { transform: rotateY(180deg); }
  .lb-flip-inner.anim-to-back  { animation: lb-flip-to-back  0.58s cubic-bezier(0.45, 0, 0.55, 1) forwards; }
  .lb-flip-inner.anim-to-front { animation: lb-flip-to-front 0.58s cubic-bezier(0.45, 0, 0.55, 1) forwards; }
  .lb-flip-face {
    position: absolute; inset: 0;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    border-radius: 16px;
    overflow: hidden;
  }
  .lb-flip-face-back { transform: rotateY(180deg); }

  /* "View Prompt" — slides up from bottom on card hover */
  .lb-prompt-btn {
    transform: translateY(100%);
    transition: transform 0.24s ease-out;
    pointer-events: none;
  }
  .lb-card-hover:hover .lb-prompt-btn {
    transform: translateY(0);
    pointer-events: auto;
  }

  /* Action buttons (Download / Star) — opacity + subtle slide on card hover.
     No overflow-hidden trick needed; buttons are invisible via opacity:0. */
  .lb-action-1 {
    opacity: 0;
    transform: translateX(8px);
    transition: opacity 0.2s ease-out 0s, transform 0.2s ease-out 0s;
    pointer-events: none;
  }
  .lb-action-2 {
    opacity: 0;
    transform: translateX(8px);
    transition: opacity 0.2s ease-out 0.1s, transform 0.2s ease-out 0.1s;
    pointer-events: none;
  }
  .lb-action-3 {
    opacity: 0;
    transform: translateX(8px);
    transition: opacity 0.2s ease-out 0.2s, transform 0.2s ease-out 0.2s;
    pointer-events: none;
  }
  .lb-card-hover:hover .lb-action-1,
  .lb-card-hover:hover .lb-action-2,
  .lb-card-hover:hover .lb-action-3 {
    opacity: 1;
    transform: translateX(0);
    pointer-events: auto;
  }

  /* Image cross-fade on navigation */
  @keyframes lb-img-enter {
    from { opacity: 0; transform: scale(0.96); }
    to   { opacity: 1; transform: scale(1);    }
  }
  .lb-img-enter { animation: lb-img-enter 0.22s cubic-bezier(0.22, 0.61, 0.36, 1) forwards; }

`;

// ─── Component ────────────────────────────────────────────────────────────────

export function Lightbox({
  images,
  startIndex,
  onClose,
  onDownload,
  onStar,
  isStarred,
  onEdit,
}: LightboxProps) {
  const [index,   setIndex]   = useState(startIndex);
  const [imgKey,  setImgKey]  = useState(0);
  const [isBack,  setIsBack]  = useState(false);
  const [animDir, setAnimDir] = useState<'to-back' | 'to-front' | null>(null);
  const [copied,  setCopied]  = useState(false);

  const current = images[index];
  const hasPrev = index > 0;
  const hasNext = index < images.length - 1;
  const starred = isStarred?.(current?.id ?? '') ?? false;

  // ── Flip ──────────────────────────────────────────────────────────────────

  const flipToBack = useCallback(() => {
    if (isBack || animDir) return;
    setAnimDir('to-back');
    setTimeout(() => { setIsBack(true); setAnimDir(null); }, 580);
  }, [isBack, animDir]);

  const flipToFront = useCallback(() => {
    if (!isBack || animDir) return;
    setAnimDir('to-front');
    setTimeout(() => { setIsBack(false); setAnimDir(null); }, 580);
  }, [isBack, animDir]);

  // ── Navigation ────────────────────────────────────────────────────────────

  const goTo = useCallback((i: number) => {
    setIsBack(false);
    setAnimDir(null);
    setIndex(i);
    setImgKey((k) => k + 1);
  }, []);

  const goPrev = useCallback(() => { if (hasPrev) goTo(index - 1); }, [hasPrev, index, goTo]);
  const goNext = useCallback(() => { if (hasNext) goTo(index + 1); }, [hasNext, index, goTo]);

  // ── Keyboard ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape')     onClose();
      if (e.key === 'ArrowLeft')  goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, goPrev, goNext]);

  // ── Copy prompt ───────────────────────────────────────────────────────────

  const handleCopy = useCallback(() => {
    if (!current?.prompt_used) return;
    navigator.clipboard.writeText(current.prompt_used).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [current]);

  if (!current || typeof document === 'undefined') return null;

  const innerClass = cn(
    'lb-flip-inner',
    !animDir && isBack     && 'is-back',
    animDir === 'to-back'  && 'anim-to-back',
    animDir === 'to-front' && 'anim-to-front',
  );

  const isAnimating  = animDir !== null;
  const showingFront = !isBack && !isAnimating;

  return createPortal(
    <>
      <style>{LIGHTBOX_STYLES}</style>

      {/* ── Backdrop — click outside card to close ────────────────────── */}
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90"
        onClick={onClose}
      >

        {/* ── Close — top-right of viewport ───────────────────────────── */}
        <button
          className="absolute top-4 right-4 z-20 rounded-full bg-white/15 p-2.5 text-white hover:bg-white/25 transition-colors"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {/* ── Counter — top-center of viewport ────────────────────────── */}
        {images.length > 1 && (
          <div className="absolute top-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3.5 py-1.5 text-white/70 text-xs tabular-nums select-none pointer-events-none">
            {index + 1} / {images.length}
          </div>
        )}

        {/* ── Prev — left-center of viewport ──────────────────────────── */}
        {hasPrev && (
          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 rounded-full bg-white/15 p-3 text-white hover:bg-white/25 transition-colors"
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            aria-label="Previous"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        {/* ── Next — right-center of viewport ─────────────────────────── */}
        {hasNext && (
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 rounded-full bg-white/15 p-3 text-white hover:bg-white/25 transition-colors"
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            aria-label="Next"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}

        {/* ── Card — stop backdrop click ───────────────────────────────── */}
        <div onClick={(e) => e.stopPropagation()}>

          {/* ── Flip card ───────────────────────────────────────────────── */}
          <div
            className="lb-flip-card lb-card-hover"
            style={{
              width:  'min(460px, 80vw)',
              height: 'min(76vh, 620px)',
            }}
          >
            <div className={innerClass}>

              {/* ── FRONT: Image ────────────────────────────────────── */}
              <div className="lb-flip-face flex items-center justify-center bg-black/50">

                {/* Image */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={imgKey}
                  src={current.image_url!}
                  alt="Generated ad"
                  className="lb-img-enter"
                  style={{
                    maxWidth:  '100%',
                    maxHeight: '100%',
                    width:     'auto',
                    height:    'auto',
                    display:   'block',
                  }}
                />

                {/* Download + Star + Edit — fade in from right on hover */}
                {showingFront && (
                  <div className="absolute top-3 right-3 flex flex-col gap-2">
                    <button
                      data-glow=""
                      className="lb-action-1 rounded-full bg-white/90 p-2 shadow-md transition-colors"
                      onClick={(e) => { e.stopPropagation(); onDownload?.(current); }}
                      title="Download"
                    >
                      <Download className="h-4 w-4 text-brand-forest" />
                    </button>
                    <button
                      data-glow=""
                      className="lb-action-2 rounded-full bg-white/90 p-2 shadow-md transition-colors"
                      onClick={(e) => { e.stopPropagation(); onStar?.(current.id); }}
                      title={starred ? 'Unstar' : 'Star'}
                    >
                      <Star className={cn(
                        'h-4 w-4',
                        starred ? 'fill-yellow-400 text-yellow-400' : 'text-brand-forest',
                      )} />
                    </button>
                    {onEdit && (
                      <button
                        data-glow=""
                        className="lb-action-3 rounded-full bg-white/90 p-2 shadow-md transition-colors"
                        onClick={(e) => { e.stopPropagation(); onEdit(current); }}
                        title="Edit image"
                      >
                        <Pencil className="h-4 w-4 text-brand-forest" />
                      </button>
                    )}
                  </div>
                )}

                {/* "View Prompt" — slides up from bottom on hover */}
                <div className="absolute bottom-0 inset-x-0 overflow-hidden rounded-b-2xl">
                  <button
                    data-glow=""
                    className="lb-prompt-btn w-full flex items-center justify-center gap-1.5 bg-brand-forest py-3 text-sm font-semibold text-white"
                    onClick={flipToBack}
                  >
                    <FileText className="h-4 w-4" />
                    View Prompt
                  </button>
                </div>

              </div>

              {/* ── BACK: Prompt panel ────────────────────────────────── */}
              <div className="lb-flip-face lb-flip-face-back bg-white flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-brand-sage/15 shrink-0">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-brand-forest" />
                    <span className="text-sm font-semibold text-brand-forest">Prompt</span>
                  </div>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border border-brand-sage/25 text-brand-slate hover:bg-brand-cream hover:text-brand-forest transition-colors"
                  >
                    {copied
                      ? <><Check className="h-3.5 w-3.5 text-green-600" /> Copied</>
                      : <><Copy  className="h-3.5 w-3.5" /> Copy</>
                    }
                  </button>
                </div>

                {/* Prompt text */}
                <div className="flex-1 overflow-y-auto px-5 py-5 min-h-0">
                  <p className="text-sm text-brand-forest/90 leading-relaxed">
                    {current.prompt_used ?? 'No prompt available.'}
                  </p>
                </div>

                {/* Footer */}
                <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-3.5 border-t border-brand-sage/15 bg-brand-cream/40">
                  <span className="text-[11px] text-brand-slate/50">
                    {current.model_id ?? current.api_provider ?? ''}
                  </span>
                  <button
                    onClick={flipToFront}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold bg-brand-forest text-white hover:bg-brand-forest/90 transition-colors"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Back to Image
                  </button>
                </div>

              </div>

            </div>
          </div>

        </div>{/* end stopPropagation wrapper */}

      </div>{/* end backdrop */}
    </>,
    document.body,
  );
}
