'use client';

/**
 * EditPromptModal
 *
 * Image-to-image edit flow:
 *  - The original generated image is sent as a reference to xAI /edits.
 *  - User can add up to 4 additional reference images (base64).
 *  - User describes ONLY the change they want — empty = creative variation.
 *  - Modal closes 20 ms after clicking Generate Edit (optimistic UX).
 *    The API call continues in the background; the parent tracks its result.
 *
 * Callbacks:
 *  onPending(tempId, aspectRatio)   — fired at 20 ms → parent shows placeholder card
 *  onSubmitted(tempId, realId)      — fired when API responds  → parent starts polling
 *  onFailed(tempId)                 — fired on API error       → parent removes placeholder
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import {
  X, Loader2, AlertCircle, Wand2, ImageIcon,
  Square, RectangleVertical, Smartphone, Monitor, LayoutTemplate,
  Check, Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { GeneratedImage } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const ASPECT_RATIOS = [
  { value: '1:1',  label: '1:1',  hint: 'Square',    Icon: Square            },
  { value: '4:5',  label: '4:5',  hint: 'Portrait',  Icon: RectangleVertical },
  { value: '9:16', label: '9:16', hint: 'Story',      Icon: Smartphone        },
  { value: '16:9', label: '16:9', hint: 'Landscape',  Icon: Monitor           },
  { value: '3:4',  label: '3:4',  hint: 'Classic',    Icon: LayoutTemplate    },
];

/** xAI /edits supports max 5 reference images; 1 is the original → 4 extras. */
const MAX_EXTRA_REFS = 4;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExtraRef { dataUrl: string; name: string }

interface EditPromptModalProps {
  image:       GeneratedImage;
  sessionId:   string;
  productId:   string;
  onClose:     () => void;
  /** Fired at 20 ms — parent shows placeholder card immediately. */
  onPending:   (tempId: string, aspectRatio: string) => void;
  /** Fired when API responds with the real image ID — parent starts polling. */
  onSubmitted: (tempId: string, realId: string) => void;
  /** Fired on API error — parent removes the placeholder. */
  onFailed:    (tempId: string) => void;
}

// ─── Prompt builder ──────────────────────────────────────────────────────────

function buildEditPrompt(change: string, aspectRatio: string): string {
  const ratioNote = `Render the output in ${aspectRatio} aspect ratio.`;
  if (!change) {
    return `Create a fresh creative variation of this image. You may freely vary the lighting mood, color grading, background texture, atmospheric quality, or visual energy — but keep the product, its placement, and the overall composition intact. ${ratioNote}`;
  }
  return `Make only this change: ${change}. Everything else must stay exactly the same — the product, background, lighting, composition, colors, and all graphic or text elements not mentioned. ${ratioNote}`;
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
  const [extraRefs,   setExtraRefs]   = useState<ExtraRef[]>([]);
  const textareaRef  = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    setTimeout(() => textareaRef.current?.focus(), 80);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !submitting) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, submitting]);

  // ── Extra reference image handling ────────────────────────────────────────

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
    // reset so the same file can be re-selected
    e.target.value = '';
  }, [extraRefs.length]);

  const removeExtraRef = useCallback((idx: number) => {
    setExtraRefs((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);

    const tempId = crypto.randomUUID();

    // Close modal optimistically after 20 ms — placeholder appears immediately
    const closeTimer = setTimeout(() => {
      onPending(tempId, aspectRatio);
      onClose();
    }, 20);

    try {
      const allRefs = [
        ...(image.image_url ? [image.image_url] : []),
        ...extraRefs.map((r) => r.dataUrl),
      ].slice(0, 5); // xAI hard cap

      const res = await fetch('/api/generate/submit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          productId,
          skipAssembly:      true,
          prompt:            buildEditPrompt(change.trim(), aspectRatio),
          aspectRatio,
          referenceImageUrls: allRefs.length ? allRefs : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Generation failed');
      }

      const { generatedImageId } = await res.json();
      onSubmitted(tempId, generatedImageId);
    } catch {
      clearTimeout(closeTimer);
      onFailed(tempId);
    }
  };

  if (!mounted) return null;

  const canAddMore = extraRefs.length < MAX_EXTRA_REFS;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={!submitting ? onClose : undefined}
      />

      {/* Modal panel */}
      <div
        className="relative w-full sm:max-w-xl bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: '82vh' }}
        onClick={(e) => e.stopPropagation()}
      >

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 shrink-0">
          <div className="flex-1 min-w-0 pr-3">
            <div className="flex items-center gap-2 mb-0.5">
              <h2 className="text-sm font-semibold text-brand-navy">Edit Image</h2>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-brand-sage/40 text-brand-slate bg-brand-cream/60 font-medium">
                Image-to-Image
              </Badge>
            </div>
            <p className="text-xs text-brand-slate/55">
              Describe your change — leave empty for a clean variation
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="shrink-0 p-1.5 rounded-lg hover:bg-brand-cream transition-colors text-brand-slate/50 hover:text-brand-slate disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Scrollable body ─────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto min-h-0 px-5 pb-5 space-y-4">

          {/* Original reference image */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-brand-navy">Reference Image</span>
              {image.aspect_ratio && (
                <span className="text-[10px] text-brand-slate/50 bg-brand-cream px-1.5 py-0.5 rounded font-medium">
                  {image.aspect_ratio}
                </span>
              )}
            </div>

            {image.image_url ? (
              <div className="relative w-full h-52 rounded-xl overflow-hidden border border-brand-sage/20 bg-brand-forest/10">
                <Image src={image.image_url} alt="Reference image" fill className="object-contain" sizes="576px" />
              </div>
            ) : (
              <div className="w-full rounded-xl border border-dashed border-brand-sage/30 bg-brand-cream/40 flex items-center justify-center py-8">
                <div className="text-center">
                  <ImageIcon className="h-6 w-6 text-brand-sage mx-auto mb-1" />
                  <p className="text-xs text-brand-slate/40">No reference image</p>
                </div>
              </div>
            )}
          </div>

          {/* Extra reference images */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-brand-navy">Additional References</span>
              <span className="text-[10px] text-brand-slate/40">
                {extraRefs.length}/{MAX_EXTRA_REFS} · Optional
              </span>
            </div>

            <div className="flex gap-2 flex-wrap">
              {extraRefs.map((ref, idx) => (
                <div key={idx} className="relative h-16 w-16 rounded-lg overflow-hidden border border-brand-sage/20 bg-brand-cream/40 shrink-0 group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ref.dataUrl} alt={ref.name} className="h-full w-full object-cover" />
                  <button
                    onClick={() => removeExtraRef(idx)}
                    className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center"
                  >
                    <X className="h-3.5 w-3.5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </div>
              ))}

              {canAddMore && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={submitting}
                  className={cn(
                    'h-16 w-16 rounded-lg border border-dashed border-brand-sage/35 bg-brand-cream/30',
                    'flex flex-col items-center justify-center gap-1 shrink-0',
                    'hover:border-brand-forest/40 hover:bg-brand-cream/60 transition-colors',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                  )}
                >
                  <Plus className="h-4 w-4 text-brand-slate/40" />
                  <span className="text-[9px] text-brand-slate/40 font-medium">Add</span>
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
            <p className="mt-1.5 text-[10px] text-brand-slate/40">
              Attach images to guide the style, background, or composition of the edit
            </p>
          </div>

          {/* Change description */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-brand-navy">Describe your change</span>
              {change.length > 0 && (
                <span className="text-[10px] text-brand-slate/40">{change.length} chars</span>
              )}
            </div>
            <textarea
              ref={textareaRef}
              value={change}
              onChange={(e) => setChange(e.target.value)}
              disabled={submitting}
              rows={3}
              className={cn(
                'w-full resize-none rounded-xl border border-brand-sage/25 bg-brand-cream/40 px-4 py-3',
                'text-sm text-brand-navy leading-relaxed placeholder:text-brand-slate/35',
                'focus:outline-none focus:border-brand-forest/40 focus:bg-white',
                'transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
              )}
              placeholder="Describe the change you want… e.g. warmer background, add soft bokeh, change surface to wood, make it more dramatic"
            />
            <p className="mt-1.5 text-[10px] text-brand-slate/40">
              Leave empty to generate a creative variation of this image
            </p>
          </div>

          {/* Output format */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-brand-navy">Output Format</span>
              <span className="text-[10px] text-brand-slate/50 bg-brand-cream px-1.5 py-0.5 rounded font-medium">
                {aspectRatio}
              </span>
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
                      'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                      'disabled:opacity-40 disabled:cursor-not-allowed',
                      active ? 'bg-brand-forest/5' : 'bg-white hover:bg-brand-cream/50',
                    )}
                  >
                    <span className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                      active ? 'border-brand-forest bg-brand-forest' : 'border-brand-sage/40 bg-white',
                    )}>
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
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Starting…</>
              : <><Wand2   className="h-3.5 w-3.5" />Generate Edit</>
            }
          </Button>
        </div>

      </div>
    </div>,
    document.body,
  );
}
