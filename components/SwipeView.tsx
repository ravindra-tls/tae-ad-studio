'use client';

/**
 * SwipeView — Tinder-style card stack for the Gallery.
 *
 * Right swipe → Like  (recorded to image_reactions)
 * Left  swipe → Dislike
 * Keyboard: → Like, ← Dislike
 * Buttons: ✕ Dislike  ✓ Like
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { ThumbsUp, ThumbsDown, RotateCcw, CheckCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { GalleryImage } from '@/types';

const SWIPE_THRESHOLD  = 90;   // px to commit swipe
const STACK_VISIBLE    = 3;    // cards shown in stack
const ROTATION_FACTOR  = 18;   // drag-px per degree of card tilt

interface SwipeViewProps {
  images: GalleryImage[];
}

type SwipeDir = 'left' | 'right';

interface CardAction {
  imageId:  string;
  reaction: 'like' | 'dislike';
}

async function recordReaction(imageId: string, reaction: 'like' | 'dislike') {
  try {
    const res = await fetch(`/api/images/${imageId}/react`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ reaction }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error('[SwipeView] recordReaction failed:', res.status, body);
    }
  } catch (err) {
    console.error('[SwipeView] recordReaction network error:', err);
  }
}

async function removeReaction(imageId: string) {
  try {
    const res = await fetch(`/api/images/${imageId}/react`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error('[SwipeView] removeReaction failed:', res.status, body);
    }
  } catch (err) {
    console.error('[SwipeView] removeReaction network error:', err);
  }
}

// Hint has 7 distinct phases to feel like a real human touch-and-drag
type HintPhase =
  | 'idle'       // waiting before hint starts
  | 'press-r'    // finger touches card — card micro-scales down
  | 'drag-r'     // drag right — card swings, LIKE appears
  | 'release-r'  // finger lifts — card springs back
  | 'press-l'    // finger touches again
  | 'drag-l'     // drag left — NOPE appears
  | 'release-l'  // spring back
  | 'done';      // hint complete, UI fades

// Phase-specific easing curves
const HINT_TRANSITIONS: Record<HintPhase, string> = {
  'idle':      'transform 0.3s ease, opacity 0.3s ease',
  'press-r':   'transform 0.2s cubic-bezier(0.4, 0, 1, 1), opacity 0.2s ease',      // snap down on press
  'drag-r':    'transform 0.55s cubic-bezier(0.22, 0.61, 0.36, 1), opacity 0.3s ease', // ease-out drag
  'release-r': 'transform 0.62s cubic-bezier(0.34, 1.52, 0.64, 1), opacity 0.3s ease', // spring overshoot
  'press-l':   'transform 0.2s cubic-bezier(0.4, 0, 1, 1), opacity 0.2s ease',
  'drag-l':    'transform 0.55s cubic-bezier(0.22, 0.61, 0.36, 1), opacity 0.3s ease',
  'release-l': 'transform 0.62s cubic-bezier(0.34, 1.52, 0.64, 1), opacity 0.3s ease',
  'done':      'transform 0.3s ease, opacity 0.4s ease',
};

// ─── Main component ───────────────────────────────────────────────────────────

export function SwipeView({ images }: SwipeViewProps) {
  const [topIndex,   setTopIndex]   = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragX,      setDragX]      = useState(0);
  const [dragY,      setDragY]      = useState(0);
  const [exitDir,    setExitDir]    = useState<SwipeDir | null>(null);
  const [history,    setHistory]    = useState<CardAction[]>([]);
  const [hintPhase,  setHintPhase]  = useState<HintPhase>('idle');

  const startXRef  = useRef(0);
  const startYRef  = useRef(0);
  const isDragRef  = useRef(false);

  // ── Intro hint sequence ────────────────────────────────────────────────────
  useEffect(() => {
    if (images.length === 0) { setHintPhase('done'); return; }
    const ts = [
      setTimeout(() => setHintPhase('press-r'),   500),
      setTimeout(() => setHintPhase('drag-r'),     820),
      setTimeout(() => setHintPhase('release-r'), 1550),
      setTimeout(() => setHintPhase('press-l'),   2150),
      setTimeout(() => setHintPhase('drag-l'),    2470),
      setTimeout(() => setHintPhase('release-l'), 3200),
      setTimeout(() => setHintPhase('done'),      3800),
    ];
    return () => ts.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isHinting = hintPhase !== 'done';

  const remaining = images.length - topIndex;
  const finished  = topIndex >= images.length;

  // ── Swipe commit ───────────────────────────────────────────────────────────
  const commitSwipe = useCallback((dir: SwipeDir) => {
    if (exitDir || topIndex >= images.length) return;
    const image    = images[topIndex];
    const reaction: 'like' | 'dislike' = dir === 'right' ? 'like' : 'dislike';

    setExitDir(dir);
    setHistory((h) => [...h, { imageId: image.id, reaction }]);
    recordReaction(image.id, reaction); // fire-and-forget

    setTimeout(() => {
      setTopIndex((i) => i + 1);
      setExitDir(null);
      setDragX(0);
      setDragY(0);
    }, 380);
  }, [exitDir, topIndex, images]);

  // ── Undo last swipe ────────────────────────────────────────────────────────
  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    removeReaction(last.imageId);
    setHistory((h) => h.slice(0, -1));
    setTopIndex((i) => Math.max(0, i - 1));
  }, [history]);

  // ── Keyboard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') commitSwipe('right');
      if (e.key === 'ArrowLeft')  commitSwipe('left');
      if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) handleUndo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [commitSwipe, handleUndo]);

  // ── Pointer drag ──────────────────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent) => {
    if (exitDir) return;
    isDragRef.current = true;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragRef.current) return;
    setDragX(e.clientX - startXRef.current);
    setDragY(e.clientY - startYRef.current);
  };

  const onPointerUp = () => {
    if (!isDragRef.current) return;
    isDragRef.current = false;
    setIsDragging(false);

    if      (dragX >  SWIPE_THRESHOLD) commitSwipe('right');
    else if (dragX < -SWIPE_THRESHOLD) commitSwipe('left');
    else { setDragX(0); setDragY(0); }
  };

  // ── Derived values for top card ───────────────────────────────────────────
  // During hint: phase drives card X and scale; user drag is ignored
  const hintDragX   = hintPhase === 'drag-r' ? 78 : hintPhase === 'drag-l' ? -78 : 0;
  const hintScale   = (hintPhase === 'press-r' || hintPhase === 'press-l') ? 0.97 : 1;
  const hintTrans   = HINT_TRANSITIONS[hintPhase];

  const effectiveDragX = isHinting ? hintDragX : dragX;
  const effectiveDragY = isHinting ? 0         : dragY;

  const activeDragX = exitDir === 'right' ? 600 : exitDir === 'left' ? -600 : effectiveDragX;
  const activeDragY = exitDir             ? 60  : effectiveDragY;
  const rotation    = exitDir === 'right' ? 30  : exitDir === 'left' ? -30  : activeDragX / ROTATION_FACTOR;

  const likeOpacity    = Math.min(1, Math.max(0,  activeDragX / SWIPE_THRESHOLD));
  const dislikeOpacity = Math.min(1, Math.max(0, -activeDragX / SWIPE_THRESHOLD));

  // Touch dot — appears during hint, moves in sync with card
  const dotVisible   = ['press-r', 'drag-r', 'press-l', 'drag-l'].includes(hintPhase);
  const dotPressing  = hintPhase === 'press-r' || hintPhase === 'press-l';
  // dot base sits at lower-center of card; translated by same X as the card
  const dotTransX    = activeDragX;    // follows card
  const dotTransY    = activeDragY * 0.6;

  // ── Visible cards ─────────────────────────────────────────────────────────
  const visibleCards = images.slice(topIndex, topIndex + STACK_VISIBLE).reverse(); // bottom-first render

  return (
    <div className="flex flex-col items-center gap-8 py-4 select-none">

      {/* ── Progress ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 w-full max-w-sm">
        <div className="flex-1 h-1.5 rounded-full bg-brand-sage/20 overflow-hidden">
          <div
            className="h-full rounded-full bg-brand-forest transition-all duration-300"
            style={{ width: `${images.length ? (topIndex / images.length) * 100 : 0}%` }}
          />
        </div>
        <span className="text-xs text-brand-slate/60 shrink-0 tabular-nums">
          {topIndex} / {images.length}
        </span>
      </div>

      {/* ── Card stack ───────────────────────────────────────────────── */}
      <div className="relative w-80 h-[480px] sm:w-96 sm:h-[540px]">

        {finished ? (
          /* All done */
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-brand-sage/30 bg-brand-cream/40 gap-4">
            <CheckCheck className="h-12 w-12 text-brand-forest/30" />
            <p className="text-sm font-semibold text-brand-slate">All caught up!</p>
            <p className="text-xs text-brand-slate/60">You've rated all {images.length} images.</p>
            {history.length > 0 && (
              <button
                onClick={handleUndo}
                className="mt-2 flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-medium bg-brand-forest text-white hover:bg-brand-forest/90 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Undo last
              </button>
            )}
          </div>
        ) : (
          visibleCards.map((image, stackIdx) => {
            const isTop    = image.id === images[topIndex].id;
            const depth    = visibleCards.length - 1 - stackIdx; // 0 = top, 1 = next, 2 = back

            // Stack offset for non-top cards — animate towards top position as card is dragged
            const dragProgress = Math.min(1, Math.abs(activeDragX) / SWIPE_THRESHOLD);
            const scale    = isTop ? hintScale  : 1 - (depth * 0.05)  + (depth * 0.05 * dragProgress);
            const yOffset  = isTop ? 0          : depth * 10           - (depth * 10   * dragProgress);
            const rot      = isTop ? rotation   : -(depth * 2)         + (depth * 2    * dragProgress);
            const opacity  = isTop ? 1          : 0.5 + (0.5 / STACK_VISIBLE) * (STACK_VISIBLE - depth);

            const translateX = isTop ? activeDragX : 0;
            const translateY = isTop ? activeDragY : yOffset;

            const transition = isTop
              ? (isDragging && !isHinting ? 'none' : hintTrans)
              : 'transform 0.45s cubic-bezier(0.34, 1.2, 0.64, 1), opacity 0.3s ease';

            return (
              <div
                key={image.id}
                className="absolute inset-0 rounded-3xl overflow-hidden bg-white shadow-xl cursor-grab active:cursor-grabbing"
                style={{
                  transform:  `translateX(${translateX}px) translateY(${translateY}px) rotate(${rot}deg) scale(${scale})`,
                  opacity,
                  transition,
                  zIndex: STACK_VISIBLE - depth,
                  transformOrigin: 'center 110%',
                }}
                onPointerDown={isTop && !isHinting ? onPointerDown : undefined}
                onPointerMove={isTop && !isHinting ? onPointerMove : undefined}
                onPointerUp={isTop && !isHinting ? onPointerUp : undefined}
                onPointerCancel={isTop && !isHinting ? onPointerUp : undefined}
              >
                {/* Image */}
                {image.image_url && (
                  <Image
                    src={image.image_url}
                    alt="Generated ad"
                    fill
                    className="object-cover pointer-events-none"
                    draggable={false}
                  />
                )}

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />

                {/* LIKE stamp */}
                {isTop && (
                  <div
                    className="absolute top-8 left-6 rotate-[-22deg] border-4 border-green-400 rounded-xl px-4 py-1.5 pointer-events-none"
                    style={{ opacity: likeOpacity, transition: isDragging ? 'none' : 'opacity 0.2s' }}
                  >
                    <span className="text-2xl font-black text-green-400 tracking-widest">LIKE</span>
                  </div>
                )}

                {/* NOPE stamp */}
                {isTop && (
                  <div
                    className="absolute top-8 right-6 rotate-[22deg] border-4 border-red-400 rounded-xl px-4 py-1.5 pointer-events-none"
                    style={{ opacity: dislikeOpacity, transition: isDragging ? 'none' : 'opacity 0.2s' }}
                  >
                    <span className="text-2xl font-black text-red-400 tracking-widest">NOPE</span>
                  </div>
                )}

                {/* Bottom info */}
                <div className="absolute bottom-0 inset-x-0 p-5 pointer-events-none">
                  <div className="flex items-end justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-white font-semibold text-sm leading-tight truncate">
                        {image.product_sub_brand ?? image.product_name ?? 'Unknown product'}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <div className="h-5 w-5 rounded-full bg-white/20 flex items-center justify-center text-[9px] font-bold text-white">
                          {image.creator_initials}
                        </div>
                        <span className="text-white/70 text-[11px]">{image.creator_name}</span>
                      </div>
                    </div>
                    <Badge className="bg-white/20 text-white border-white/30 text-[10px] shrink-0">
                      {image.aspect_ratio}
                    </Badge>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* ── Touch dot indicator ─────────────────────────────────── */}
        {!finished && (
          <div
            className="absolute pointer-events-none z-50"
            style={{
              /* Base position: lower-center of the card */
              left: '50%',
              top:  '68%',
              transform: `translate(calc(-50% + ${dotTransX}px), calc(-50% + ${dotTransY}px))`,
              transition: hintTrans,
              opacity:    dotVisible ? 1 : 0,
            }}
          >
            {/* Outer ripple — plays when pressing */}
            {dotPressing && (
              <span
                className="absolute inset-0 -m-2 rounded-full border border-white/50 animate-ping"
                style={{ animationDuration: '0.7s' }}
              />
            )}
            {/* Touch circle */}
            <div
              className="w-11 h-11 rounded-full border-[2.5px] border-white shadow-lg"
              style={{
                background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.45), rgba(255,255,255,0.12))',
                backdropFilter: 'blur(4px)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.25), inset 0 1px 1px rgba(255,255,255,0.4)',
                transform: dotPressing ? 'scale(1.15)' : 'scale(1)',
                transition: 'transform 0.2s ease',
              }}
            />
          </div>
        )}
      </div>

      {/* ── Hint labels — fade out when hint is done ─────────────────── */}
      <div
        className="flex items-center justify-between w-full max-w-sm pointer-events-none -mt-4"
        style={{
          opacity:    isHinting ? 1 : 0,
          transition: 'opacity 0.5s ease',
        }}
      >
        <div
          className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 border-2"
          style={{
            borderColor:     (hintPhase === 'drag-l' || hintPhase === 'release-l') ? 'rgb(248 113 113)' : 'rgb(254 202 202)',
            backgroundColor: (hintPhase === 'drag-l' || hintPhase === 'release-l') ? 'rgb(254 242 242)' : 'rgb(255 255 255 / 0.6)',
            color:           (hintPhase === 'drag-l' || hintPhase === 'release-l') ? 'rgb(239 68 68)'   : 'rgb(252 165 165)',
            transform:       (hintPhase === 'drag-l' || hintPhase === 'release-l') ? 'scale(1.1)'       : 'scale(1)',
            transition: 'all 0.35s cubic-bezier(0.34, 1.4, 0.64, 1)',
          }}
        >
          <ThumbsDown className="h-3.5 w-3.5" />
          <span className="text-xs font-bold tracking-wide">Dislike</span>
        </div>
        <div
          className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 border-2"
          style={{
            borderColor:     (hintPhase === 'drag-r' || hintPhase === 'release-r') ? 'rgb(74 222 128)'  : 'rgb(187 247 208)',
            backgroundColor: (hintPhase === 'drag-r' || hintPhase === 'release-r') ? 'rgb(240 253 244)' : 'rgb(255 255 255 / 0.6)',
            color:           (hintPhase === 'drag-r' || hintPhase === 'release-r') ? 'rgb(34 197 94)'   : 'rgb(134 239 172)',
            transform:       (hintPhase === 'drag-r' || hintPhase === 'release-r') ? 'scale(1.1)'       : 'scale(1)',
            transition: 'all 0.35s cubic-bezier(0.34, 1.4, 0.64, 1)',
          }}
        >
          <span className="text-xs font-bold tracking-wide">Like</span>
          <ThumbsUp className="h-3.5 w-3.5" />
        </div>
      </div>

      {/* ── Action buttons ───────────────────────────────────────────── */}
      {!finished && (
        <div className="flex items-center gap-5">
          {/* Dislike */}
          <button
            onClick={() => commitSwipe('left')}
            disabled={!!exitDir || isHinting}
            className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-red-300 bg-white shadow-md hover:bg-red-50 hover:border-red-400 hover:scale-110 active:scale-95 transition-all duration-150 disabled:opacity-40"
            title="Dislike (←)"
          >
            <ThumbsDown className="h-6 w-6 text-red-400" />
          </button>

          {/* Undo */}
          <button
            onClick={handleUndo}
            disabled={history.length === 0}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-brand-sage/30 bg-white shadow hover:bg-brand-cream hover:scale-110 active:scale-95 transition-all duration-150 disabled:opacity-30"
            title="Undo (Ctrl+Z)"
          >
            <RotateCcw className="h-4 w-4 text-brand-slate" />
          </button>

          {/* Like */}
          <button
            onClick={() => commitSwipe('right')}
            disabled={!!exitDir || isHinting}
            className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-green-300 bg-white shadow-md hover:bg-green-50 hover:border-green-400 hover:scale-110 active:scale-95 transition-all duration-150 disabled:opacity-40"
            title="Like (→)"
          >
            <ThumbsUp className="h-6 w-6 text-green-500" />
          </button>
        </div>
      )}

      {/* ── Keyboard hint ────────────────────────────────────────────── */}
      {!finished && (
        <p className="text-[11px] text-brand-slate/40">
          ← Dislike &nbsp;·&nbsp; → Like &nbsp;·&nbsp; Ctrl+Z Undo
        </p>
      )}
    </div>
  );
}
