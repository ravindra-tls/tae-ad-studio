'use client';

/**
 * EditPromptModal — multi-region lasso edit flow
 *
 * User draws freehand lasso regions on the image. Each region gets a colored
 * numbered pin. A Figma-style description bubble appears next to the pin;
 * after 2 s of inactivity the bubble collapses into the pin and its description
 * is synced to the main prompt box. Clicking a pin re-expands its bubble.
 *
 * On Generate: a composite mask covering all drawn regions is sent with the
 * combined prompt so the model edits only within the selected areas.
 *
 * Callbacks (unchanged):
 *  onPending(tempId, aspectRatio)        — animation done → parent shows placeholder
 *  onSubmitted(tempId, realId, imageUrl?) — API responds → imageUrl skips polling entirely
 *  onFailed(tempId)                       — API error → parent removes placeholder
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import {
  X, Loader2, Wand2, ImageIcon,
  Square, RectangleVertical, Smartphone, Monitor, LayoutTemplate,
  Check, Plus, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { GeneratedImage } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const ASPECT_RATIOS = [
  { value: '1:1',  label: '1:1',  hint: 'Square',   Icon: Square            },
  { value: '4:5',  label: '4:5',  hint: 'Portrait', Icon: RectangleVertical },
  { value: '9:16', label: '9:16', hint: 'Story',     Icon: Smartphone        },
  { value: '16:9', label: '16:9', hint: 'Landscape', Icon: Monitor           },
  { value: '3:4',  label: '3:4',  hint: 'Classic',   Icon: LayoutTemplate    },
];

const MAX_EXTRA_REFS = 4;
const MAX_REGIONS    = 5;

/** One color per region, cycling if somehow exceeded. */
const REGION_COLORS = [
  { stroke: '#ef4444', fill: 'rgba(239,68,68,0.18)',  pin: 'bg-red-500'    },
  { stroke: '#3b82f6', fill: 'rgba(59,130,246,0.18)', pin: 'bg-blue-500'   },
  { stroke: '#22c55e', fill: 'rgba(34,197,94,0.18)',  pin: 'bg-green-500'  },
  { stroke: '#f97316', fill: 'rgba(249,115,22,0.18)', pin: 'bg-orange-500' },
  { stroke: '#a855f7', fill: 'rgba(168,85,247,0.18)', pin: 'bg-purple-500' },
] as const;

type RegionColor = typeof REGION_COLORS[number];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Pt { x: number; y: number }

interface LassoRegion {
  id:          number;
  color:       RegionColor;
  pts:         Pt[];
  /** centroid as 0–1 fractions of canvas CSS size — used for pin/box placement */
  centroidPct: { x: number; y: number };
  prompt:      string;
  collapsed:   boolean;
}

interface ExtraRef { dataUrl: string; name: string }

interface EditPromptModalProps {
  image:       GeneratedImage;
  sessionId:   string;
  productId:   string;
  onClose:     () => void;
  onPending:   (tempId: string, aspectRatio: string) => void;
  onSubmitted: (tempId: string, realId: string, imageUrl?: string) => void;
  onFailed:    (tempId: string) => void;
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildEditPrompt(change: string, aspectRatio: string, hasMask: boolean): string {
  const ratioNote  = `Render the output in ${aspectRatio} aspect ratio.`;
  const trimmed    = change.trim();

  if (hasMask) {
    if (!trimmed) {
      return (
        `<IMAGE_0> is the original product image. ` +
        `<IMAGE_1> shows the regions to edit — areas filled in red may be changed. ` +
        `Apply a subtle creative variation only within the highlighted areas. ` +
        `Keep everything outside the highlighted regions exactly as in <IMAGE_0>. ${ratioNote}`
      );
    }
    return (
      `<IMAGE_0> is the original product image. ` +
      `<IMAGE_1> shows the regions to edit — areas filled in red may be changed. ` +
      `Make these targeted changes: ${trimmed}. ` +
      `Apply changes ONLY within the areas marked red in <IMAGE_1>. ` +
      `Everything outside the highlighted regions must stay exactly as in <IMAGE_0>. ${ratioNote}`
    );
  }

  if (!trimmed) {
    return (
      `Create a fresh creative variation of this image. You may freely vary the lighting mood, ` +
      `color grading, background texture, or atmospheric quality — but keep the product, its ` +
      `placement, and the overall composition intact. ${ratioNote}`
    );
  }
  return (
    `Make only this change: ${trimmed}. Everything else must stay exactly the same — the product, ` +
    `background, lighting, composition, colors, and all graphic or text elements not mentioned. ${ratioNote}`
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EditPromptModal({
  image, sessionId, productId,
  onClose, onPending, onSubmitted, onFailed,
}: EditPromptModalProps) {
  const [mounted,     setMounted]     = useState(false);
  const [change,      setChange]      = useState('');
  const [aspectRatio, setAspectRatio] = useState(image.aspect_ratio || '1:1');
  const [submitting,  setSubmitting]  = useState(false);
  const [launching,   setLaunching]   = useState(false);   // morph-out animation
  const [extraRefs,   setExtraRefs]   = useState<ExtraRef[]>([]);
  const [regions,     setRegions]     = useState<LassoRegion[]>([]);
  // Track canvas bounding rect for bubble portals (avoids overflow clipping)
  const [canvasRect,  setCanvasRect]  = useState<DOMRect | null>(null);

  // Refs that don't need renders
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const panelRef       = useRef<HTMLDivElement>(null);   // animation shell
  const innerPanelRef  = useRef<HTMLDivElement>(null);   // card face (flip)
  const backdropRef    = useRef<HTMLDivElement>(null);   // dim overlay
  const regionsRef     = useRef<LassoRegion[]>([]);
  const activePtsRef   = useRef<Pt[]>([]);
  const isDrawingRef   = useRef(false);
  const debounceTimers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const textareaRef    = useRef<HTMLTextAreaElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);

  regionsRef.current = regions; // keep in sync without stale closure

  useEffect(() => {
    setMounted(true);
    setTimeout(() => textareaRef.current?.focus(), 80);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !submitting) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, submitting]);

  // Track canvas bounding rect so bubbles can be portalled to body (avoids overflow clipping)
  useEffect(() => {
    const update = () => {
      if (canvasRef.current) setCanvasRect(canvasRef.current.getBoundingClientRect());
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, []);

  // ── Canvas ────────────────────────────────────────────────────────────────

  function ensureCanvasSize() {
    const c = canvasRef.current;
    if (!c) return;
    if (c.width !== c.offsetWidth || c.height !== c.offsetHeight) {
      c.width  = c.offsetWidth;
      c.height = c.offsetHeight;
    }
  }

  function getCanvasPoint(e: React.MouseEvent<HTMLCanvasElement>): Pt {
    const c    = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (c.width  / rect.width),
      y: (e.clientY - rect.top)  * (c.height / rect.height),
    };
  }

  /** Redraws all locked region fills + the active dashed stroke. */
  const redrawCanvas = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);

    for (const region of regionsRef.current) {
      if (region.pts.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(region.pts[0].x, region.pts[0].y);
      for (let i = 1; i < region.pts.length; i++) ctx.lineTo(region.pts[i].x, region.pts[i].y);
      ctx.closePath();
      ctx.fillStyle   = region.color.fill;
      ctx.fill();
      ctx.strokeStyle = region.color.stroke;
      ctx.lineWidth   = 2;
      ctx.setLineDash([]);
      ctx.stroke();
    }

    const activePts = activePtsRef.current;
    if (activePts.length > 1) {
      const nextColor = REGION_COLORS[regionsRef.current.length % REGION_COLORS.length];
      ctx.beginPath();
      ctx.moveTo(activePts[0].x, activePts[0].y);
      for (let i = 1; i < activePts.length; i++) ctx.lineTo(activePts[i].x, activePts[i].y);
      ctx.strokeStyle = nextColor.stroke;
      ctx.lineWidth   = 2;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, []);

  // Re-render canvas whenever regions array changes (e.g. one removed → renumber)
  useEffect(() => { redrawCanvas(); }, [regions, redrawCanvas]);

  const handleCanvasDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (submitting || regions.length >= MAX_REGIONS) return;
    ensureCanvasSize();
    isDrawingRef.current  = true;
    activePtsRef.current  = [getCanvasPoint(e)];
    redrawCanvas();
  };

  const handleCanvasMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    activePtsRef.current = [...activePtsRef.current, getCanvasPoint(e)];
    redrawCanvas();
  };

  const handleCanvasUp = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const pts = activePtsRef.current;
    activePtsRef.current = [];

    if (pts.length < 6) { redrawCanvas(); return; }

    const c  = canvasRef.current!;
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;

    const newRegion: LassoRegion = {
      id:          regionsRef.current.length + 1,
      color:       REGION_COLORS[regionsRef.current.length % REGION_COLORS.length],
      pts,
      centroidPct: { x: cx / c.width, y: cy / c.height },
      prompt:      '',
      collapsed:   false,
    };

    setRegions((prev) => [...prev, newRegion]);
  }, [redrawCanvas]);

  // ── Region prompt + debounced collapse ────────────────────────────────────

  const syncMainPrompt = useCallback((updatedRegions: LassoRegion[]) => {
    const parts = updatedRegions
      .filter((r) => r.prompt.trim())
      .map((r)   => `Region ${r.id}: ${r.prompt.trim()}`);
    setChange(parts.join('. '));
  }, []);

  const handleRegionPromptChange = useCallback((id: number, text: string) => {
    setRegions((prev) => prev.map((r) => r.id === id ? { ...r, prompt: text } : r));

    const existing = debounceTimers.current.get(id);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      setRegions((prev) => {
        const next = prev.map((r) => r.id === id ? { ...r, collapsed: true } : r);
        syncMainPrompt(next);
        return next;
      });
      debounceTimers.current.delete(id);
    }, 2000);

    debounceTimers.current.set(id, timer);
  }, [syncMainPrompt]);

  const expandRegion = useCallback((id: number) => {
    setRegions((prev) => prev.map((r) => r.id === id ? { ...r, collapsed: false } : r));
  }, []);

  const removeRegion = useCallback((id: number) => {
    const t = debounceTimers.current.get(id);
    if (t) { clearTimeout(t); debounceTimers.current.delete(id); }
    setRegions((prev) => {
      // Remove and renumber
      const next = prev
        .filter((r) => r.id !== id)
        .map((r, i) => ({ ...r, id: i + 1, color: REGION_COLORS[i % REGION_COLORS.length] }));
      syncMainPrompt(next);
      return next;
    });
  }, [syncMainPrompt]);

  const clearAllRegions = useCallback(() => {
    debounceTimers.current.forEach(clearTimeout);
    debounceTimers.current.clear();
    activePtsRef.current = [];
    setRegions([]);
    setChange('');
    const c = canvasRef.current;
    if (c) c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
  }, []);

  // ── Extra references ──────────────────────────────────────────────────────

  const canAddMore = extraRefs.length < MAX_EXTRA_REFS;

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, MAX_EXTRA_REFS - extraRefs.length);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setExtraRefs((prev) => {
          if (prev.length >= MAX_EXTRA_REFS) return prev;
          return [...prev, { dataUrl: reader.result as string, name: file.name }];
        });
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  }, [extraRefs.length]);

  const removeExtraRef = useCallback((idx: number) => {
    setExtraRefs((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // ── Composite mask ────────────────────────────────────────────────────────

  /**
   * Merges all region paths into one red-fill PNG for the server's mask converter.
   *
   * IMPORTANT: OpenAI requires the mask to be the SAME pixel dimensions as the
   * reference image. The canvas is sized to its CSS display size (~530×208px),
   * but the stored image was generated by OpenAI at a fixed size (e.g. 1024×1024).
   * We scale every lasso point up so the mask matches the reference image exactly.
   *
   * The size is derived from the image's aspect_ratio using the same table as the
   * OpenAI provider. For xAI-generated images the dimensions may differ, but those
   * requests also route through redMaskToOpenAIMask on the server which handles any
   * size — so worst-case the mask is slightly off, never an API 400.
   */
  function buildCompositeMask(): string | null {
    const c = canvasRef.current;
    if (!c || regions.length === 0) return null;

    // Known OpenAI output sizes — must match lib/image-providers/openai.ts ASPECT_SIZE_MAP
    const OPENAI_SIZES: Record<string, { w: number; h: number }> = {
      '1:1':  { w: 1024, h: 1024 },
      '4:5':  { w: 1024, h: 1536 },
      '9:16': { w: 1024, h: 1536 },
      '16:9': { w: 1536, h: 1024 },
      '3:4':  { w: 1024, h: 1536 },
    };

    // Use the SOURCE image's aspect ratio (not the user's chosen output ratio)
    const imgAr  = image.aspect_ratio || '1:1';
    const size   = OPENAI_SIZES[imgAr] ?? { w: 1024, h: 1024 };
    const scaleX = size.w / c.width;
    const scaleY = size.h / c.height;

    const offscreen = document.createElement('canvas');
    offscreen.width  = size.w;
    offscreen.height = size.h;
    const ctx = offscreen.getContext('2d')!;

    for (const region of regions) {
      if (region.pts.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(region.pts[0].x * scaleX, region.pts[0].y * scaleY);
      for (let i = 1; i < region.pts.length; i++) {
        ctx.lineTo(region.pts[i].x * scaleX, region.pts[i].y * scaleY);
      }
      ctx.closePath();
      ctx.fillStyle = '#ef4444';
      ctx.fill();
    }

    return offscreen.toDataURL('image/png');
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (submitting || launching) return;

    const tempId        = crypto.randomUUID();
    const compositeMask = buildCompositeMask();

    setLaunching(true);
    setSubmitting(true);

    // ─── WAAPI animation — bypasses CSS @keyframe lookup entirely ──────────
    // CSS keyframes applied via inline `animation:` on portalled elements are
    // silently dropped in Next.js. WAAPI is guaranteed to fire on the element.
    //
    // We use getBoundingClientRect() so the translate targets real pixels —
    // vw/vh values were wrong because the modal is flex-centered, making
    // "translate(-40vw)" move relative to center, not to the corner.
    const ANIM_MS = 1000;
    const shell    = panelRef.current;
    const face     = innerPanelRef.current;
    const backdrop = backdropRef.current;

    if (shell) {
      const r  = shell.getBoundingClientRect();
      const cx = r.left + r.width  / 2;   // modal center X
      const cy = r.top  + r.height / 2;   // modal center Y

      // Target: top-left of the gallery content area
      // (280px = sidebar width + some padding; 80px = header + padding)
      const tx = 310 - cx;
      const ty =  90 - cy;

      // Shell: flies to corner, shrinks, rotates
      shell.animate(
        [
          { transform: 'scale(1) translate(0px, 0px) rotate(0deg)',                                   opacity: 1   },
          { transform: `scale(0.88) translate(${tx*0.06}px,${ty*0.06}px) rotate(-5deg)`,              opacity: 1,   offset: 0.10 },
          { transform: `scale(0.42) translate(${tx*0.38}px,${ty*0.38}px) rotate(-18deg)`,             opacity: 0.9, offset: 0.38 },
          { transform: `scale(0.14) translate(${tx*0.72}px,${ty*0.72}px) rotate(-36deg)`,             opacity: 0.5, offset: 0.68 },
          { transform: `scale(0.05) translate(${tx}px,${ty}px) rotate(-52deg)`,                       opacity: 0   },
        ],
        { duration: ANIM_MS, easing: 'cubic-bezier(0.55, 0.02, 0.9, 0.4)', fill: 'forwards' },
      );

      // Inner face: flip on Y axis (pure rotation, no translate — so overflow:hidden stays fine)
      face?.animate(
        [
          { transform: 'rotateY(0deg)   scaleX(1)'   },
          { transform: 'rotateY(-30deg) scaleX(0.94)', offset: 0.15 },
          { transform: 'rotateY(-90deg) scaleX(0.02)', offset: 0.40 },  // card goes edge-on
          { transform: 'rotateY(-180deg) scaleX(0.02)', offset: 0.55 },
          { transform: 'rotateY(-290deg) scaleX(0.6)',  offset: 0.80 },
          { transform: 'rotateY(-360deg) scaleX(0.05)' },
        ],
        { duration: ANIM_MS, easing: 'cubic-bezier(0.55, 0.02, 0.9, 0.4)', fill: 'forwards' },
      );

      // Backdrop: fades out gently
      backdrop?.animate(
        [{ opacity: 1 }, { opacity: 0 }],
        { duration: ANIM_MS * 0.7, easing: 'ease-out', fill: 'forwards' },
      );
    }

    // ── After animation completes → hand off to gallery ───────────────────
    const morphTimer = setTimeout(() => {
      onPending(tempId, aspectRatio);   // parent adds placeholder
      onClose();                         // unmount modal
    }, ANIM_MS);

    // ── API call runs in parallel ─────────────────────────────────────────
    try {
      const allRefs = [
        ...(image.image_url ? [image.image_url] : []),
        ...extraRefs.map((r) => r.dataUrl),
      ].slice(0, 5);

      const res = await fetch('/api/generate/submit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          productId,
          skipAssembly:       true,
          prompt:             buildEditPrompt(change, aspectRatio, !!compositeMask),
          aspectRatio,
          referenceImageUrls: allRefs.length ? allRefs : undefined,
          maskDataUrl:        compositeMask ?? undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Generation failed');
      }

      const { generatedImageId, imageUrl } = await res.json();
      onSubmitted(tempId, generatedImageId, imageUrl);
    } catch {
      // API failed — cancel animation + morph timer, restore normal state
      clearTimeout(morphTimer);
      panelRef.current?.getAnimations().forEach((a) => a.cancel());
      innerPanelRef.current?.getAnimations().forEach((a) => a.cancel());
      backdropRef.current?.getAnimations().forEach((a) => a.cancel());
      setLaunching(false);
      setSubmitting(false);
      onFailed(tempId);
    }
  };

  if (!mounted) return null;

  const hasRegions  = regions.length > 0;
  const canDraw     = regions.length < MAX_REGIONS && !submitting;
  // Layout branches: 16:9 → wide image + narrow refs col; everything else → image | refs+describe
  const isLandscape = (image.aspect_ratio || '1:1') === '16:9';
  // Image container height: portrait images need more vertical room; landscape stays compact
  const imgH = isLandscape ? 'h-56' : 'h-[420px]';

  // ── Reusable sub-sections ─────────────────────────────────────────────────

  /** The image + canvas + pins + chips block (goes in the image column) */
  const imageBlock = (
    <div>
      {/* Column header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-brand-navy">Reference Image</span>
        <div className="flex items-center gap-2.5">
          {image.aspect_ratio && (
            <span className="text-[10px] text-brand-slate/50 bg-brand-cream px-1.5 py-0.5 rounded font-medium">
              {image.aspect_ratio}
            </span>
          )}
          {hasRegions && (
            <button
              onClick={clearAllRegions}
              disabled={submitting}
              className="flex items-center gap-1 text-[10px] text-brand-slate/40 hover:text-red-500 transition-colors disabled:opacity-40"
            >
              <Trash2 className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {image.image_url ? (
        <>
          {/* Outer relative wrapper — overflow-visible so pins/bubbles can float out */}
          <div className="relative w-full select-none">

            {/* Image + canvas — overflow-hidden for rounded corners */}
            <div className={cn('relative w-full rounded-xl overflow-hidden border border-brand-sage/20 bg-brand-forest/10', imgH)}>
              <Image
                src={image.image_url}
                alt="Reference"
                fill
                className="object-contain"
                sizes="(min-width: 640px) 400px, 100vw"
                draggable={false}
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full rounded-xl"
                style={{ cursor: canDraw ? 'crosshair' : 'default' }}
                onMouseDown={handleCanvasDown}
                onMouseMove={handleCanvasMove}
                onMouseUp={handleCanvasUp}
                onMouseLeave={handleCanvasUp}
              />
              {!hasRegions && (
                <div className="absolute inset-x-0 bottom-0 pb-3 flex justify-center pointer-events-none">
                  <span className="text-[10px] bg-black/60 text-white px-2.5 py-1 rounded-full font-medium">
                    Click and drag to mark an area to edit
                  </span>
                </div>
              )}
            </div>

            {/* Region pins — always rendered here (small, don't overflow) */}
            {regions.map((region) => {
              const lx = `${region.centroidPct.x * 100}%`;
              const ty = `${region.centroidPct.y * 100}%`;
              return (
                <button
                  key={region.id}
                  style={{ position: 'absolute', left: lx, top: ty, transform: 'translate(-50%, -50%)', zIndex: 20 }}
                  onClick={() => region.collapsed ? expandRegion(region.id) : removeRegion(region.id)}
                  title={`Region ${region.id}${region.prompt ? `: ${region.prompt}` : ' — click to edit'}`}
                  className={cn(
                    'w-6 h-6 rounded-full text-white text-[10px] font-bold',
                    'flex items-center justify-center shadow-lg ring-2 ring-white hover:scale-110 transition-transform',
                    region.color.pin,
                    !region.collapsed && 'ring-offset-1',
                  )}
                >
                  {region.id}
                </button>
              );
            })}
          </div>

          {/* Expanded region bubbles — portalled to body so overflow clipping never applies */}
          {mounted && canvasRect && createPortal(
            <>
              {regions.filter((r) => !r.collapsed).map((region) => {
                const pinX       = canvasRect.left + region.centroidPct.x * canvasRect.width;
                const pinY       = canvasRect.top  + region.centroidPct.y * canvasRect.height;
                const below      = region.centroidPct.y < 0.55;
                // Clamp horizontally so bubble never leaves the viewport
                const bubbleW    = 192; // w-48
                const rawLeft    = pinX - bubbleW / 2;
                const clampedLeft = Math.max(8, Math.min(rawLeft, window.innerWidth - bubbleW - 8));
                return (
                  <div
                    key={region.id}
                    style={{
                      position: 'fixed',
                      left:     `${clampedLeft}px`,
                      top:      below ? `${pinY + 8}px` : 'auto',
                      bottom:   below ? 'auto' : `${window.innerHeight - pinY + 8}px`,
                      zIndex:   9999,
                    }}
                    className="w-48 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden"
                  >
                    <div className="flex items-center gap-1.5 px-2.5 pt-2.5 pb-2 border-b border-gray-100">
                      <span className={cn('w-4 h-4 min-w-[1rem] rounded-full text-white text-[9px] font-bold flex items-center justify-center shrink-0', region.color.pin)}>
                        {region.id}
                      </span>
                      <span className="flex-1 text-[10px] font-semibold text-gray-700">Region {region.id}</span>
                      <button onClick={() => removeRegion(region.id)} className="text-gray-300 hover:text-red-400 transition-colors" title="Remove">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    <textarea
                      value={region.prompt}
                      onChange={(e) => handleRegionPromptChange(region.id, e.target.value)}
                      placeholder="Describe the edit here…"
                      rows={3}
                      // eslint-disable-next-line jsx-a11y/no-autofocus
                      autoFocus
                      className="w-full text-[11px] leading-relaxed resize-none px-2.5 py-2 text-gray-800 placeholder:text-gray-400 focus:outline-none"
                    />
                    <p className="px-2.5 pb-2 text-[9px] text-gray-400">Collapses 2 s after you stop typing</p>
                  </div>
                );
              })}
            </>,
            document.body,
          )}

          {/* Region chips */}
          {hasRegions && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {regions.map((region) => (
                <button
                  key={region.id}
                  onClick={() => expandRegion(region.id)}
                  className={cn(
                    'flex items-center gap-1.5 text-[10px] font-medium rounded-full px-2.5 py-1 border transition-colors',
                    region.collapsed
                      ? 'bg-gray-100 text-gray-600 border-transparent hover:border-gray-200'
                      : 'bg-brand-cream text-brand-forest border-brand-sage/30',
                  )}
                >
                  <span className={cn('w-3.5 h-3.5 min-w-[0.875rem] rounded-full text-white text-[7px] font-bold flex items-center justify-center shrink-0', region.color.pin)}>
                    {region.id}
                  </span>
                  {region.prompt
                    ? <span className="truncate max-w-[100px]">{region.prompt}</span>
                    : <span className="text-gray-400 italic">tap to describe</span>
                  }
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className={cn('w-full rounded-xl border border-dashed border-brand-sage/30 bg-brand-cream/40 flex items-center justify-center', imgH)}>
          <div className="text-center">
            <ImageIcon className="h-6 w-6 text-brand-sage mx-auto mb-1" />
            <p className="text-xs text-brand-slate/40">No reference image</p>
          </div>
        </div>
      )}
    </div>
  );

  /** Additional references block */
  const refsBlock = (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-brand-navy">Additional References</span>
        <span className="text-[10px] text-brand-slate/40">{extraRefs.length}/{MAX_EXTRA_REFS}</span>
      </div>
      <div className="flex gap-2 flex-wrap">
        {extraRefs.map((ref, idx) => (
          <div key={idx} className="relative h-14 w-14 rounded-lg overflow-hidden border border-brand-sage/20 bg-brand-cream/40 shrink-0 group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ref.dataUrl} alt={ref.name} className="h-full w-full object-cover" />
            <button
              onClick={() => removeExtraRef(idx)}
              className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center"
            >
              <X className="h-3 w-3 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>
        ))}
        {canAddMore && (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={submitting}
            className={cn(
              'h-14 w-14 rounded-lg border border-dashed border-brand-sage/35 bg-brand-cream/30',
              'flex flex-col items-center justify-center gap-1 shrink-0',
              'hover:border-brand-forest/40 hover:bg-brand-cream/60 transition-colors',
              'disabled:opacity-40 disabled:cursor-not-allowed',
            )}
          >
            <Plus className="h-4 w-4 text-brand-slate/40" />
            <span className="text-[9px] text-brand-slate/40 font-medium">Add</span>
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
      </div>
      <p className="mt-1.5 text-[10px] text-brand-slate/40">Guide the style or composition</p>
    </div>
  );

  /** Describe your change textarea block */
  const describeBlock = (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-brand-navy">Describe your change</span>
        {change.length > 0 && <span className="text-[10px] text-brand-slate/40">{change.length} chars</span>}
      </div>
      <textarea
        ref={textareaRef}
        value={change}
        onChange={(e) => setChange(e.target.value)}
        disabled={submitting}
        rows={isLandscape ? 3 : 4}
        className={cn(
          'w-full resize-none rounded-xl border border-brand-sage/25 bg-brand-cream/40 px-4 py-3',
          'text-sm text-brand-navy leading-relaxed placeholder:text-brand-slate/35',
          'focus:outline-none focus:border-brand-forest/40 focus:bg-white',
          'transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
        )}
        placeholder={
          hasRegions
            ? 'Region descriptions appear here automatically…'
            : 'e.g. warmer background, add soft bokeh, change surface to wood'
        }
      />
      <p className="mt-1.5 text-[10px] text-brand-slate/40">
        {hasRegions ? 'Auto-filled from regions — edits apply only within selected areas' : 'Leave empty for a creative variation'}
      </p>
    </div>
  );

  /** Output format selector */
  const outputBlock = (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-brand-navy">Output Format</span>
        <span className="text-[10px] text-brand-slate/50 bg-brand-cream px-1.5 py-0.5 rounded font-medium">{aspectRatio}</span>
      </div>
      <div className="rounded-xl border border-brand-sage/20 overflow-hidden divide-y divide-brand-sage/15">
        {ASPECT_RATIOS.map(({ value, label, hint, Icon }) => {
          const active = aspectRatio === value;
          return (
            <button
              key={value}
              onClick={() => setAspectRatio(value)}
              disabled={submitting}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-2 text-left transition-colors',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                active ? 'bg-brand-forest/5' : 'bg-white hover:bg-brand-cream/50',
              )}
            >
              <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors', active ? 'border-brand-forest bg-brand-forest' : 'border-brand-sage/40 bg-white')}>
                {active && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
              </span>
              <Icon className={cn('h-4 w-4 shrink-0 transition-colors', active ? 'text-brand-forest' : 'text-brand-slate/40')} />
              <span className={cn('flex-1 text-xs font-medium transition-colors', active ? 'text-brand-forest' : 'text-brand-navy')}>
                {label} — {hint}
              </span>
              {active && <Check className="h-3.5 w-3.5 text-brand-forest shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop — WAAPI fades it; pointer-events off once launching */}
      <div
        ref={backdropRef}
        className={cn(
          'absolute inset-0 bg-black/50 backdrop-blur-sm',
          launching && 'pointer-events-none',
        )}
        onClick={!submitting ? onClose : undefined}
      />

      {/*
        Animation shell — no overflow:hidden so transforms are never clipped.
        WAAPI animates this: scale + translate to top-left corner + rotate.
        Inner panel gets the Y-axis flip separately via innerPanelRef.
      */}
      <div
        ref={panelRef}
        className="relative w-full sm:max-w-2xl"
        style={{ transformOrigin: 'center center', willChange: 'transform, opacity' }}
        onClick={(e) => e.stopPropagation()}
      >
      {/* Inner card face — WAAPI rotates on Y axis for flip effect */}
      <div
        ref={innerPanelRef}
        className="relative w-full bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: '88vh', transformOrigin: 'center center' }}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 shrink-0">
          <div className="flex-1 min-w-0 pr-3">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <h2 className="text-sm font-semibold text-brand-navy">Edit Image</h2>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-brand-sage/40 text-brand-slate bg-brand-cream/60 font-medium">
                Image-to-Image
              </Badge>
              {hasRegions && (
                <Badge className="text-[10px] px-1.5 py-0 bg-brand-forest/10 text-brand-forest border-brand-sage/30 font-medium">
                  {regions.length} region{regions.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            <p className="text-xs text-brand-slate/55">
              {canDraw
                ? 'Draw on the image to mark areas — each gets its own description'
                : regions.length >= MAX_REGIONS
                  ? 'Maximum regions reached — remove one to add more'
                  : 'Describe your change below'}
            </p>
          </div>
          <button onClick={onClose} disabled={submitting} className="shrink-0 p-1.5 rounded-lg hover:bg-brand-cream transition-colors text-brand-slate/50 hover:text-brand-slate disabled:opacity-40">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Scrollable body ──────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto min-h-0 px-5 pb-5 space-y-4">

          {isLandscape ? (
            /* ── Landscape: image (wide) + refs (narrow) side by side ── */
            <>
              <div className="flex gap-4 items-start">
                {/* Image col — takes 3/4 of space */}
                <div className="flex-[3] min-w-0">
                  {imageBlock}
                </div>
                {/* Refs col — takes 1/4 */}
                <div className="flex-[1] min-w-[150px]">
                  {refsBlock}
                </div>
              </div>
              {describeBlock}
            </>
          ) : (
            /* ── Portrait / Square: image (left) | refs + describe (right) ── */
            <div className="flex gap-4 items-start">
              {/* Image col */}
              <div className="flex-1 min-w-0">
                {imageBlock}
              </div>
              {/* Controls col */}
              <div className="w-[210px] shrink-0 flex flex-col gap-4">
                {refsBlock}
                {describeBlock}
              </div>
            </div>
          )}

          {/* Output format — always full-width at the bottom */}
          {outputBlock}

        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-brand-sage/15 px-5 py-3.5 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-xs text-brand-slate/60 hover:text-brand-slate transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <Button
            size="sm"
            disabled={submitting}
            onClick={handleSubmit}
            className="gap-1.5 bg-brand-forest hover:bg-brand-forest/90 text-xs h-8 px-4"
          >
            {submitting
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Starting…</>
              : <><Wand2   className="h-3.5 w-3.5" /> Generate Edit</>
            }
          </Button>
        </div>
      </div>  {/* end inner panel */}
      </div>  {/* end animation shell */}
    </div>,
    document.body,
  );
}
