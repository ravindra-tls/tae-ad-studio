'use client';

/**
 * ImageCard — shared flip card used in both Results and Gallery pages.
 *
 * Front:  image with top-right Download + Star, bottom hover "View Prompt" bar
 * Back:   full prompt text with Copy + Hide controls
 *
 * Optional `galleryMeta` renders a creator + product footer (gallery only).
 */

import { useState, useCallback } from 'react';
import Image from 'next/image';
import { Download, Star, FileText, Copy, Check, X, Pencil, Maximize2, RefreshCw, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { GeneratedImage } from '@/types';

export interface GalleryMeta {
  creatorName:      string;
  creatorInitials:  string;
  productName:      string | null;
  productSubBrand:  string | null;
}

interface ImageCardProps {
  image:          GeneratedImage;
  index?:         number;
  isStarred:      boolean;
  onStar:         () => void;
  onDownload:     () => void;
  onOpenLightbox: () => void;
  onEdit?:        () => void;
  /** Async — ImageCard shows a spinner while it resolves. */
  onUpscale?:     () => Promise<void>;
  /** Re-submit to GPT Image-2 at max quality — fresh generation, not a pixel stretch. */
  onRegenerate?:  () => Promise<void>;
  galleryMeta?:   GalleryMeta;
  /** Hide the "View Prompt" hover button + flip (e.g. dashboard thumbnails) */
  hidePrompt?:    boolean;
}

type AnimDir = 'to-back' | 'to-front';

export function ImageCard({
  image,
  index = 0,
  isStarred,
  onStar,
  onDownload,
  onOpenLightbox,
  onEdit,
  onUpscale,
  onRegenerate,
  galleryMeta,
  hidePrompt = false,
}: ImageCardProps) {
  const [isBack,       setIsBack]       = useState(false);
  const [animDir,      setAnimDir]      = useState<AnimDir | null>(null);
  const [copied,       setCopied]       = useState(false);
  const [upscaling,    setUpscaling]    = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const handleFlip = useCallback(() => {
    const dir: AnimDir = isBack ? 'to-front' : 'to-back';
    setAnimDir(dir);
    setTimeout(() => {
      setIsBack((prev) => !prev);
      setAnimDir(null);
    }, 520);
  }, [isBack]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(image.prompt_used).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [image.prompt_used]);

  const handleUpscale = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onUpscale || upscaling) return;
    setUpscaling(true);
    try {
      await onUpscale();
    } finally {
      setUpscaling(false);
    }
  }, [onUpscale, upscaling]);

  const handleRegenerate = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onRegenerate || regenerating) return;
    setRegenerating(true);
    try {
      await onRegenerate();
    } finally {
      setRegenerating(false);
    }
  }, [onRegenerate, regenerating]);

  const isAnimating = animDir !== null;
  const showingBack = isBack && !isAnimating;

  const innerClass = cn(
    'tae-flip-inner',
    !isAnimating && isBack   && 'is-back',
    animDir === 'to-back'    && 'anim-to-back',
    animDir === 'to-front'   && 'anim-to-front',
  );

  return (
    <>
      <div
        className="tae-flip-card tae-card-hover stagger-item"
        style={{ animationDelay: `${index * 60}ms` }}
      >
        <div
          className="relative rounded-xl overflow-hidden border border-brand-sage/20 shadow-sm"
          style={{ aspectRatio: (image.aspect_ratio || '1:1').replace(':', '/') }}
        >
          <div className={innerClass}>

            {/* ── FRONT ──────────────────────────────────────────────── */}
            <div className="tae-flip-face tae-flip-face-front rounded-xl overflow-hidden bg-brand-cream">

              {/* Image — clickable for lightbox */}
              <button
                className="absolute inset-0 w-full h-full"
                onClick={onOpenLightbox}
                tabIndex={-1}
                aria-label="View full size"
              >
                {image.image_url && (
                  <Image
                    src={image.image_url}
                    alt="Generated ad"
                    fill
                    className="object-cover"
                  />
                )}
              </button>

              {/* Top-right: Download + Star — hidden when showing back or animating */}
              <div className={cn(
                'absolute top-2.5 right-2.5 flex flex-col gap-1.5 transition-opacity duration-200',
                (showingBack || isAnimating) ? 'opacity-0 pointer-events-none' : 'opacity-100',
              )}>
                <button
                  data-glow=""
                  onClick={(e) => { e.stopPropagation(); onDownload(); }}
                  className="rounded-full bg-white/90 p-1.5 shadow-md transition-colors duration-150"
                  title="Download"
                >
                  <Download className="h-3.5 w-3.5 text-brand-forest" />
                </button>
                <button
                  data-glow=""
                  onClick={(e) => { e.stopPropagation(); onStar(); }}
                  className="rounded-full bg-white/90 p-1.5 shadow-md transition-colors duration-150"
                  title={isStarred ? 'Unstar' : 'Star'}
                >
                  <Star className={cn(
                    'h-3.5 w-3.5',
                    isStarred ? 'fill-yellow-400 text-yellow-400' : 'text-brand-forest',
                  )} />
                </button>
                {onEdit && (
                  <button
                    data-glow=""
                    onClick={(e) => { e.stopPropagation(); onEdit(); }}
                    className="rounded-full bg-white/90 p-1.5 shadow-md transition-colors duration-150"
                    title="Edit prompt & regenerate"
                  >
                    <Pencil className="h-3.5 w-3.5 text-brand-forest" />
                  </button>
                )}
                {onUpscale && (
                  <button
                    data-glow=""
                    onClick={handleUpscale}
                    disabled={upscaling}
                    className="rounded-full bg-white/90 p-1.5 shadow-md transition-colors duration-150 disabled:opacity-60 disabled:cursor-wait"
                    title={upscaling ? 'Upscaling…' : 'Upscale 2× & download HD'}
                  >
                    {upscaling
                      ? <Loader2 className="h-3.5 w-3.5 text-brand-teal animate-spin" />
                      : <Maximize2 className="h-3.5 w-3.5 text-brand-forest" />
                    }
                  </button>
                )}
                {onRegenerate && (
                  <button
                    data-glow=""
                    onClick={handleRegenerate}
                    disabled={regenerating}
                    className="rounded-full bg-white/90 p-1.5 shadow-md transition-colors duration-150 disabled:opacity-60 disabled:cursor-wait"
                    title={regenerating ? 'Regenerating at max quality…' : 'Regenerate at max quality (fresh GPT Image-2 call)'}
                  >
                    {regenerating
                      ? <Loader2 className="h-3.5 w-3.5 text-brand-teal animate-spin" />
                      : <RefreshCw className="h-3.5 w-3.5 text-brand-forest" />
                    }
                  </button>
                )}
              </div>

              {/* Bottom: View Prompt — slides in on hover (hidden when hidePrompt) */}
              {!hidePrompt && (
                <div className="absolute bottom-0 inset-x-0 overflow-hidden">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleFlip(); }}
                    data-glow=""
                    className="tae-prompt-btn w-full flex items-center justify-center gap-1.5 bg-brand-forest py-2.5 text-xs font-semibold text-white transition-colors duration-150"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    View Prompt
                  </button>
                </div>
              )}
            </div>

            {/* ── BACK ───────────────────────────────────────────────── */}
            <div className="tae-flip-face tae-flip-face-back rounded-xl bg-white flex flex-col overflow-hidden">

              {/* Header */}
              <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-brand-sage/15 shrink-0">
                <div className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-brand-forest" />
                  <span className="text-xs font-semibold text-brand-forest">Prompt</span>
                  <Badge variant="outline" className="text-[9px] px-1.5 ml-0.5">{image.aspect_ratio}</Badge>
                </div>
                <button
                  onClick={handleFlip}
                  className="rounded-lg p-1.5 text-brand-slate hover:bg-brand-cream hover:text-brand-forest transition-colors"
                  title="Back to image"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Prompt text */}
              <div className="flex-1 overflow-y-auto px-3.5 py-3 min-h-0">
                <p className="text-[11px] text-brand-forest/90 leading-relaxed">
                  {image.prompt_used}
                </p>
              </div>

              {/* Footer */}
              <div className="shrink-0 flex items-center justify-between gap-2 px-3.5 py-2.5 border-t border-brand-sage/15">
                <span className="text-[10px] text-brand-slate/50 truncate">
                  {image.model_id ?? image.api_provider ?? '—'}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-medium border border-brand-sage/30 text-brand-slate hover:bg-brand-cream hover:text-brand-forest transition-colors"
                  >
                    {copied
                      ? <><Check className="h-3 w-3 text-green-600" /><span>Copied</span></>
                      : <><Copy  className="h-3 w-3" /><span>Copy</span></>
                    }
                  </button>
                  <button
                    onClick={handleFlip}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-medium bg-brand-forest text-white hover:bg-brand-forest/90 transition-colors"
                  >
                    Hide
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Gallery-only footer: creator + product */}
        {galleryMeta && (
          <div className="px-1 pt-2 pb-0.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="h-5 w-5 shrink-0 rounded-full bg-brand-forest/12 flex items-center justify-center text-[9px] font-bold text-brand-forest">
                {galleryMeta.creatorInitials}
              </div>
              <span className="text-[10px] text-brand-slate truncate">{galleryMeta.creatorName}</span>
            </div>
            {(galleryMeta.productSubBrand ?? galleryMeta.productName) && (
              <Badge variant="secondary" className="text-[9px] px-1.5 shrink-0">
                {galleryMeta.productSubBrand ?? galleryMeta.productName}
              </Badge>
            )}
          </div>
        )}
      </div>
    </>
  );
}
