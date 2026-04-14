'use client';

/**
 * StatsDisplay — client component for the admin stats page.
 *
 * Shows two-column layout: Top Liked | Needs Improvement
 * Each card has the same flip animation as ImageCard.
 * Clicking the image opens an enlarged flip-card modal.
 */

import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import {
  ThumbsUp, ThumbsDown, FileText,
  Copy, Check, X, TrendingUp, TrendingDown, Minus, BarChart3,
  Download, Star,
} from 'lucide-react';
import { cn, downloadImage } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImageStat {
  id:                string;
  image_url:         string | null;
  prompt:            string | null;
  product_name:      string | null;
  product_sub_brand: string | null;
  creator_name:      string;
  created_at:        string;
  likes:             number;
  dislikes:          number;
  total:             number;
  like_ratio:        number;
}

interface StatsDisplayProps {
  topLiked:    ImageStat[];
  topDisliked: ImageStat[];
  allStats:    ImageStat[];
}

// ─── Shared keyframes (injected once) ────────────────────────────────────────

const FLIP_STYLES = `
  @keyframes tae-flip-to-back {
    0%  { transform: rotateY(0deg)   scale(1); }
    45% { transform: rotateY(90deg)  scale(0.92); }
    100%{ transform: rotateY(180deg) scale(1); }
  }
  @keyframes tae-flip-to-front {
    0%  { transform: rotateY(180deg) scale(1); }
    45% { transform: rotateY(90deg)  scale(0.92); }
    100%{ transform: rotateY(0deg)   scale(1); }
  }
  .tae-flip-card   { perspective: 900px; }
  .tae-flip-inner  { transform-style: preserve-3d; position: relative; width: 100%; height: 100%; }
  .tae-flip-inner.is-back       { transform: rotateY(180deg); }
  .tae-flip-inner.anim-to-back  { animation: tae-flip-to-back  0.52s ease-in-out forwards; }
  .tae-flip-inner.anim-to-front { animation: tae-flip-to-front 0.52s ease-in-out forwards; }
  .tae-flip-face {
    position: absolute; inset: 0;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
  }
  .tae-flip-face-back { transform: rotateY(180deg); }
  .stats-prompt-btn {
    transform: translateY(100%);
    transition: transform 0.24s ease-out;
  }
  .stats-card-hover:hover .stats-prompt-btn { transform: translateY(0); }

  /* Download / Star — fade + slide in from right on hover (modal only) */
  .stats-action-1 {
    opacity: 0;
    transform: translateX(10px);
    transition: opacity 0.18s ease-out, transform 0.18s ease-out;
    pointer-events: none;
  }
  .stats-action-2 {
    opacity: 0;
    transform: translateX(10px);
    transition: opacity 0.18s ease-out 0.06s, transform 0.18s ease-out 0.06s;
    pointer-events: none;
  }
  .stats-card-hover:hover .stats-action-1,
  .stats-card-hover:hover .stats-action-2 {
    opacity: 1;
    transform: translateX(0);
    pointer-events: auto;
  }
`;

// ─── Ratio bar ────────────────────────────────────────────────────────────────

function RatioBar({ ratio }: { ratio: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-brand-sage/15 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            ratio >= 70 ? 'bg-green-400' : ratio >= 40 ? 'bg-amber-400' : 'bg-red-400',
          )}
          style={{ width: `${ratio}%` }}
        />
      </div>
      <span className="text-[11px] tabular-nums text-brand-slate/60 w-7 text-right">{ratio}%</span>
    </div>
  );
}

// ─── Flip card (used both inline and in modal) ────────────────────────────────

function StatFlipCard({
  stat,
  size = 'normal',
  showPromptBtn = false,
  onImageClick,
}: {
  stat:            ImageStat;
  size?:           'normal' | 'large';
  showPromptBtn?:  boolean;    // only true inside the modal
  onImageClick?:   () => void;
}) {
  const [isBack,   setIsBack]   = useState(false);
  const [animDir,  setAnimDir]  = useState<'to-back' | 'to-front' | null>(null);
  const [copied,   setCopied]   = useState(false);

  const handleFlip = useCallback(() => {
    const dir = isBack ? 'to-front' : 'to-back';
    setAnimDir(dir);
    setTimeout(() => { setIsBack((p) => !p); setAnimDir(null); }, 520);
  }, [isBack]);

  const handleCopy = useCallback(() => {
    if (!stat.prompt) return;
    navigator.clipboard.writeText(stat.prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [stat.prompt]);

  const isAnimating = animDir !== null;
  const showingBack = isBack && !isAnimating;

  const innerClass = cn(
    'tae-flip-inner',
    !animDir && isBack  && 'is-back',
    animDir === 'to-back'   && 'anim-to-back',
    animDir === 'to-front'  && 'anim-to-front',
  );

  const ratioBg = stat.like_ratio >= 70
    ? 'bg-green-500/80'
    : stat.like_ratio >= 40
    ? 'bg-amber-500/80'
    : 'bg-red-500/80';

  return (
    <div className={cn('tae-flip-card stats-card-hover w-full', size === 'large' && 'h-full')}>
      <div className={cn(
        'relative rounded-2xl overflow-hidden border border-brand-sage/20 shadow-sm',
        size === 'large' ? 'h-full' : 'aspect-square',
      )}>
        <div className={innerClass}>

          {/* ── FRONT ─────────────────────────────────────────────── */}
          <div className="tae-flip-face rounded-2xl overflow-hidden bg-brand-cream">

            {/* Image */}
            <button
              className="absolute inset-0 w-full h-full"
              onClick={onImageClick}
              tabIndex={-1}
              aria-label="Enlarge"
            >
              {stat.image_url
                ? <Image src={stat.image_url} alt="Ad" fill className="object-cover" />
                : <div className="absolute inset-0 flex items-center justify-center text-brand-sage/40 text-xs">No image</div>
              }
            </button>

            {/* Gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent pointer-events-none" />

            {/* Like ratio badge — top right */}
            <div className={cn(
              'absolute top-2.5 right-2.5 rounded-lg px-2 py-0.5 text-[10px] font-bold text-white pointer-events-none',
              ratioBg,
            )}>
              {stat.like_ratio}%
            </div>

            {/* Like / Dislike counts — bottom left/right */}
            <div className={cn(
              'absolute inset-x-0 px-3 flex items-center justify-between pointer-events-none',
              showPromptBtn ? 'bottom-10' : 'bottom-3',
            )}>
              <span className="flex items-center gap-1 text-white text-xs font-bold drop-shadow">
                <ThumbsUp className="h-3.5 w-3.5 text-green-400" /> {stat.likes}
              </span>
              <span className="flex items-center gap-1 text-white text-xs font-bold drop-shadow">
                <ThumbsDown className="h-3.5 w-3.5 text-red-400" /> {stat.dislikes}
              </span>
            </div>

            {/* View Prompt — only visible in modal (showPromptBtn=true), slides in on hover */}
            {showPromptBtn && (
              <div className="absolute bottom-0 inset-x-0 overflow-hidden">
                <button
                  onClick={(e) => { e.stopPropagation(); handleFlip(); }}
                  className={cn(
                    'stats-prompt-btn w-full flex items-center justify-center gap-1.5 bg-brand-forest py-2.5 text-xs font-semibold text-white hover:bg-brand-forest/90 transition-colors',
                    (showingBack || isAnimating) && 'pointer-events-none',
                  )}
                >
                  <FileText className="h-3.5 w-3.5" />
                  View Prompt
                </button>
              </div>
            )}
          </div>

          {/* ── BACK ──────────────────────────────────────────────── */}
          <div className="tae-flip-face tae-flip-face-back rounded-2xl bg-white flex flex-col overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-brand-sage/15 shrink-0">
              <div className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-brand-forest" />
                <span className="text-xs font-semibold text-brand-forest">Prompt</span>
              </div>
              <button onClick={handleFlip} className="rounded-lg p-1.5 text-brand-slate hover:bg-brand-cream transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Prompt text */}
            <div className="flex-1 overflow-y-auto px-3.5 py-3 min-h-0">
              <p className="text-[11px] text-brand-forest/90 leading-relaxed">
                {stat.prompt ?? 'No prompt available.'}
              </p>
            </div>

            {/* Reaction summary */}
            <div className="shrink-0 px-3.5 pb-2 pt-1.5">
              <RatioBar ratio={stat.like_ratio} />
            </div>

            {/* Footer actions */}
            <div className="shrink-0 flex items-center justify-between gap-2 px-3.5 py-2.5 border-t border-brand-sage/15">
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1 font-semibold text-green-600">
                  <ThumbsUp className="h-3 w-3" /> {stat.likes}
                </span>
                <span className="flex items-center gap-1 font-semibold text-red-400">
                  <ThumbsDown className="h-3 w-3" /> {stat.dislikes}
                </span>
              </div>
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
    </div>
  );
}

// ─── Enlarged modal — portalled to document.body ─────────────────────────────

function StatModal({
  stat,
  onClose,
  onDownload,
  onStar,
  isStarred,
}: {
  stat:        ImageStat;
  onClose:     () => void;
  onDownload:  (stat: ImageStat) => void;
  onStar:      (id: string) => void;
  isStarred:   (id: string) => boolean;
}) {
  if (typeof document === 'undefined') return null;

  const starred = isStarred(stat.id);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 rounded-full bg-white/15 p-2.5 text-white hover:bg-white/25 transition-colors"
        onClick={onClose}
      >
        <X className="h-5 w-5" />
      </button>

      {/* Card + action buttons — stop propagation so clicks inside don't close modal */}
      <div
        className="stats-card-hover relative w-full max-w-sm h-[540px]"
        onClick={(e) => e.stopPropagation()}
      >
        <StatFlipCard stat={stat} size="large" showPromptBtn={true} />

        {/* Download + Star — fade+slide in from right on hover, below the ratio badge */}
        <div className="absolute top-14 right-3 flex flex-col gap-2" style={{ paddingRight: '1px' }}>
          <button
            className="stats-action-1 rounded-full bg-white/90 p-2 shadow-md hover:bg-white transition-colors duration-150"
            onClick={() => onDownload(stat)}
            title="Download"
          >
            <Download className="h-4 w-4 text-brand-forest" />
          </button>
          <button
            className="stats-action-2 rounded-full bg-white/90 p-2 shadow-md hover:bg-white transition-colors duration-150"
            onClick={() => onStar(stat.id)}
            title={starred ? 'Unstar' : 'Star'}
          >
            <Star className={cn(
              'h-4 w-4',
              starred ? 'fill-yellow-400 text-yellow-400' : 'text-brand-forest',
            )} />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

const STATS_STARRED_KEY = 'tae-stats-starred';

function loadStatsStarred(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STATS_STARRED_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch { return new Set(); }
}

export function StatsDisplay({ topLiked, topDisliked, allStats }: StatsDisplayProps) {
  const [modal,         setModal]         = useState<ImageStat | null>(null);
  const [starredStats,  setStarredStats]  = useState<Set<string>>(() => loadStatsStarred());

  const toggleStar = useCallback((id: string) => {
    setStarredStats((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      try { localStorage.setItem(STATS_STARRED_KEY, JSON.stringify([...next])); } catch { /* noop */ }
      return next;
    });
  }, []);

  const handleDownload = useCallback((stat: ImageStat) => {
    if (!stat.image_url) return;
    downloadImage(stat.image_url, `tae-ad-${stat.id.slice(0, 8)}.png`);
  }, []);

  const totalLikes    = allStats.reduce((s, x) => s + x.likes,    0);
  const totalDislikes = allStats.reduce((s, x) => s + x.dislikes, 0);
  const totalVotes    = totalLikes + totalDislikes;
  const overallRatio  = totalVotes > 0 ? Math.round((totalLikes / totalVotes) * 100) : 0;

  return (
    <>
      <style>{FLIP_STYLES}</style>
      <div className="flex flex-col gap-8">

      {/* ── Summary row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Votes', value: totalVotes,    color: 'text-brand-forest' },
          { label: 'Likes',       value: totalLikes,    color: 'text-green-600'    },
          { label: 'Dislikes',    value: totalDislikes, color: 'text-red-500'      },
          {
            label: 'Like Rate',
            value: `${overallRatio}%`,
            color: overallRatio >= 60 ? 'text-green-600' : 'text-amber-600',
          },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-brand-sage/20 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs text-brand-slate/60 mb-2">{c.label}</p>
            <p className={cn('text-3xl font-bold tabular-nums', c.color)}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* ── Two-column: Top Liked | Needs Improvement ───────────────── */}
      {(topLiked.length > 0 || topDisliked.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Left — Top Liked */}
          <section className="rounded-2xl border border-brand-sage/15 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-brand-forest mb-4 flex items-center gap-2">
              <ThumbsUp className="h-4 w-4 text-green-500" /> Top Liked
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {topLiked.map((stat) => (
                <StatFlipCard
                  key={stat.id}
                  stat={stat}
                  onImageClick={() => setModal(stat)}
                />
              ))}
            </div>
          </section>

          {/* Right — Needs Improvement */}
          <section className="rounded-2xl border border-brand-sage/15 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-brand-forest mb-4 flex items-center gap-2">
              <ThumbsDown className="h-4 w-4 text-red-400" /> Needs Improvement
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {topDisliked.map((stat) => (
                <StatFlipCard
                  key={stat.id}
                  stat={stat}
                  onImageClick={() => setModal(stat)}
                />
              ))}
            </div>
          </section>

        </div>
      )}

      {/* ── Full table ──────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-brand-forest mb-3">All Rated Images</h2>

        {allStats.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-brand-sage/30 bg-brand-cream/30 py-16">
            <BarChart3 className="h-10 w-10 text-brand-forest/20 mb-3" />
            <p className="text-sm font-medium text-brand-slate">No reactions yet</p>
            <p className="text-xs text-brand-slate/60 mt-1">Users haven&apos;t swiped any images yet.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-brand-sage/15 bg-white overflow-hidden shadow-sm">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-brand-sage/10 bg-brand-cream/50">
                  <th className="text-left px-4 py-3 font-semibold text-brand-slate/70 w-16">Image</th>
                  <th className="text-left px-4 py-3 font-semibold text-brand-slate/70">Details</th>
                  <th className="text-right px-4 py-3 font-semibold text-brand-slate/70 w-14">
                    <span className="flex items-center justify-end gap-1"><ThumbsUp className="h-3 w-3 text-green-500" /></span>
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-brand-slate/70 w-14">
                    <span className="flex items-center justify-end gap-1"><ThumbsDown className="h-3 w-3 text-red-400" /></span>
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-brand-slate/70 w-40">Like Rate</th>
                  <th className="text-left px-4 py-3 font-semibold text-brand-slate/70 w-20">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-sage/[0.07]">
                {allStats.map((stat, i) => (
                  <tr
                    key={stat.id}
                    className={cn(
                      'transition-colors hover:bg-brand-cream/40 cursor-pointer',
                      i % 2 === 0 ? 'bg-white' : 'bg-brand-cream/15',
                    )}
                    onClick={() => setModal(stat)}
                  >
                    <td className="px-4 py-3">
                      {stat.image_url ? (
                        <div className="relative h-11 w-11 rounded-lg overflow-hidden border border-brand-sage/20">
                          <Image src={stat.image_url} alt="Ad" fill className="object-cover" />
                        </div>
                      ) : (
                        <div className="h-11 w-11 rounded-lg bg-brand-sage/10 flex items-center justify-center text-[10px] text-brand-slate/40">N/A</div>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="font-semibold text-brand-forest leading-tight truncate">
                        {stat.product_sub_brand ?? stat.product_name ?? 'Unknown product'}
                      </p>
                      <p className="text-[11px] text-brand-slate/60 mt-0.5 truncate">{stat.creator_name}</p>
                      {stat.prompt && (
                        <p className="text-[10px] text-brand-slate/40 mt-1 line-clamp-1 leading-snug">{stat.prompt}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600 tabular-nums">{stat.likes}</td>
                    <td className="px-4 py-3 text-right font-semibold text-red-400 tabular-nums">{stat.dislikes}</td>
                    <td className="px-4 py-3"><RatioBar ratio={stat.like_ratio} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {stat.like_ratio >= 70
                          ? <TrendingUp   className="h-3.5 w-3.5 text-green-500" />
                          : stat.like_ratio >= 40
                          ? <Minus        className="h-3.5 w-3.5 text-amber-500" />
                          : <TrendingDown className="h-3.5 w-3.5 text-red-400"   />
                        }
                        <span className="text-[11px] text-brand-slate/50">{stat.total}v</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      </div>{/* end flex flex-col gap-8 */}

      {/* ── Modal ───────────────────────────────────────────────────── */}
      {modal && (
        <StatModal
          stat={modal}
          onClose={() => setModal(null)}
          onDownload={handleDownload}
          onStar={toggleStar}
          isStarred={(id) => starredStats.has(id)}
        />
      )}
    </>
  );
}
