'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import {
  Pencil, Trash2, X, ChevronLeft, ChevronRight,
  Check, Loader2, Images, AlertTriangle,
  Sparkles, ImagePlus, FlaskConical, ExternalLink, Camera,
  Archive, Globe,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useSnackbar } from '@/components/ui/snackbar';
import { cn } from '@/lib/utils';
import { LoadingAnimations } from '@/components/loading-animations';
import { loadingMessages } from '@/lib/loading-messages';
import type { PromptTemplate } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TemplateImage {
  id: string;
  image_url: string;
  aspect_ratio: string;
  prompt_used: string;
  created_at: string;
}

interface AdminTemplateGridProps {
  templates:        PromptTemplate[];
  imagesByTemplate: Record<string, TemplateImage[]>;
  countByTemplate:  Record<string, number>;
  /** Devs manage everything and can promote workspace templates to universal. */
  isDev:            boolean;
  /** The caller's acting workspace — scopes which templates an admin may manage. */
  workspaceId:      string | null;
}

const CATEGORIES = [
  'All',
  'Hero/Product',
  'Social Proof',
  'UGC',
  'Comparison',
  'Educational',
  'Native/Editorial',
  'Lifestyle',
  'Press/Authority',
  'Offer/Promotion',
];

const ASPECT_RATIOS = ['1:1', '4:5', '9:16', '16:9', '3:4'] as const;

const PLACEHOLDER_RE = /\[[A-Z][A-Z0-9 _/—–\-\+\.',:!?()&]+\]/g;

function hasPlaceholders(text: string) {
  return PLACEHOLDER_RE.test(text);
}

function aspectToCSS(ratio: string) {
  const map: Record<string, string> = {
    '1:1': '1/1', '4:5': '4/5', '9:16': '9/16', '16:9': '16/9', '3:4': '3/4',
  };
  return map[ratio] ?? '1/1';
}

// ─── Gallery Modal ────────────────────────────────────────────────────────────

function GalleryModal({
  templateId,
  templateName,
  initialImages,
  initialCount,
  onClose,
}: {
  templateId:    string;
  templateName:  string;
  initialImages: TemplateImage[];
  initialCount:  number;
  onClose:       () => void;
}) {
  const [images,   setImages]   = useState<TemplateImage[]>(initialImages);
  const [loading,  setLoading]  = useState(initialImages.length < initialCount);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [mounted,  setMounted]  = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (initialImages.length >= initialCount) return; // already have all
    fetch(`/api/admin/templates/${templateId}/images`)
      .then((r) => r.json())
      .then((data) => setImages(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [templateId, initialImages.length, initialCount]);

  const prev = useCallback(() => setLightbox((i) => (i !== null && i > 0 ? i - 1 : i)), []);
  const next = useCallback(() => setLightbox((i) => (i !== null && i < images.length - 1 ? i + 1 : i)), [images.length]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  prev();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'Escape')     lightbox !== null ? setLightbox(null) : onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [lightbox, prev, next, onClose]);

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Gallery backdrop */}
      <div
        className="fixed inset-0 z-50 flex flex-col"
        style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)' }}
        onClick={onClose}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b border-white/10 px-6 py-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div>
            <h2 className="text-base font-semibold text-white">{templateName}</h2>
            <p className="text-xs text-white/50 mt-0.5">
              {loading ? 'Loading…' : `${images.length} image${images.length !== 1 ? 's' : ''} generated from this template`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-white/40" />
            </div>
          ) : images.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2">
              <Images className="h-10 w-10 text-white/20" />
              <p className="text-sm text-white/40">No images generated from this template yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {images.map((img, idx) => (
                <button
                  key={img.id}
                  className="group relative overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10 transition hover:ring-2 hover:ring-brand-teal/60"
                  style={{ aspectRatio: aspectToCSS(img.aspect_ratio) }}
                  onClick={() => setLightbox(idx)}
                >
                  <Image
                    src={img.image_url}
                    alt=""
                    fill
                    className="object-cover transition group-hover:scale-105"
                    sizes="200px"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox !== null && images[lightbox] && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.96)' }}
          onClick={() => setLightbox(null)}
        >
          <button className="absolute right-4 top-4 rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white" onClick={() => setLightbox(null)}>
            <X className="h-5 w-5" />
          </button>
          {lightbox > 0 && (
            <button className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" onClick={(e) => { e.stopPropagation(); prev(); }}>
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          <div
            className="relative max-h-[85vh] max-w-[85vw]"
            style={{ aspectRatio: aspectToCSS(images[lightbox].aspect_ratio) }}
            onClick={(e) => e.stopPropagation()}
          >
            <Image src={images[lightbox].image_url} alt="" fill className="rounded-xl object-contain" sizes="85vw" />
          </div>
          {lightbox < images.length - 1 && (
            <button className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" onClick={(e) => { e.stopPropagation(); next(); }}>
              <ChevronRight className="h-6 w-6" />
            </button>
          )}
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white/60">
            {lightbox + 1} / {images.length}
          </p>
        </div>
      )}
    </>,
    document.body,
  );
}

// ─── Create Template Modal ────────────────────────────────────────────────────

type CreateStep = 'input' | 'generating' | 'preview' | 'testing' | 'results';

type TestResult =
  | { imageId: string; imageUrl: string; productName: string; aspectRatio: string }
  | { error: string; productName: string };

function CreateTemplateModal({
  onClose,
  onCreated,
  onViewInGallery,
}: {
  onClose:         () => void;
  onCreated:       (template: PromptTemplate) => void;
  onViewInGallery: (templateId: string) => void;
}) {
  const [step,         setStep]         = useState<CreateStep>('input');
  const [description,  setDescription]  = useState('');
  const [imageBase64,  setImageBase64]  = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [mimeType,     setMimeType]     = useState('image/jpeg');
  const [error,        setError]        = useState<string | null>(null);
  const [template,     setTemplate]     = useState<PromptTemplate | null>(null);
  const [testResults,  setTestResults]  = useState<TestResult[]>([]);
  const [isDragging,   setIsDragging]   = useState(false);

  // ── Inline loading state (mirrors LoadingExperience internals) ──
  const [loadingProgress,   setLoadingProgress]   = useState(0);
  const [loadingElapsed,    setLoadingElapsed]     = useState(0);
  const [loadingMsgIdx,     setLoadingMsgIdx]      = useState(0);
  const [loadingAnimIdx,    setLoadingAnimIdx]     = useState(0);
  const [loadingTextFading, setLoadingTextFading]  = useState(false);
  const [loadingAnimFading, setLoadingAnimFading]  = useState(false);
  const [loadingEstSecs,    setLoadingEstSecs]     = useState(15);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLoading = step === 'generating' || step === 'testing';

  // Reset + seed loading state when a loading step begins
  useEffect(() => {
    if (!isLoading) return;
    setLoadingProgress(0);
    setLoadingElapsed(0);
    setLoadingMsgIdx(Math.floor(Math.random() * loadingMessages.length));
    setLoadingAnimIdx(Math.floor(Math.random() * LoadingAnimations.length));
    setLoadingTextFading(false);
    setLoadingAnimFading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Elapsed timer
  useEffect(() => {
    if (!isLoading) return;
    const id = setInterval(() => setLoadingElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [isLoading]);

  // Fake progress curve (matches LoadingExperience formula)
  useEffect(() => {
    if (!isLoading) return;
    setLoadingProgress(Math.min(92, (1 - Math.exp(-loadingElapsed / (loadingEstSecs * 0.6))) * 100));
  }, [loadingElapsed, loadingEstSecs, isLoading]);

  // Rotate messages every 4.5s
  useEffect(() => {
    if (!isLoading) return;
    const id = setInterval(() => {
      setLoadingTextFading(true);
      setTimeout(() => {
        setLoadingMsgIdx((i) => (i + 1) % loadingMessages.length);
        setLoadingTextFading(false);
      }, 300);
    }, 4500);
    return () => clearInterval(id);
  }, [isLoading]);

  // Cycle SVG animations every 10s
  useEffect(() => {
    if (!isLoading) return;
    const id = setInterval(() => {
      setLoadingAnimFading(true);
      setTimeout(() => {
        setLoadingAnimIdx((i) => (i + 1) % LoadingAnimations.length);
        setLoadingAnimFading(false);
      }, 500);
    }, 10000);
    return () => clearInterval(id);
  }, [isLoading]);

  const loadFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setMimeType(file.type);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setImageBase64(result);
      setImagePreview(result);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  };

  const handleGenerate = async () => {
    if (!imageBase64 && !description.trim()) {
      setError('Upload an image or describe the ad layout you want.');
      return;
    }
    setError(null);
    setLoadingEstSecs(15);
    setStep('generating');

    try {
      const res = await fetch('/api/admin/templates/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          description: description.trim() || undefined,
          imageBase64:  imageBase64        || undefined,
          mimeType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setTemplate(data as PromptTemplate);
      onCreated(data as PromptTemplate);
      // Fill bar to 100%, then transition
      setLoadingProgress(100);
      setTimeout(() => setStep('preview'), 700);
    } catch (err: any) {
      setError(err.message);
      setStep('input');
    }
  };

  const handleTest = async () => {
    if (!template) return;
    setLoadingEstSecs(60);
    setStep('testing');
    try {
      const res = await fetch('/api/admin/templates/test', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ templateId: template.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Test failed');
      setTestResults(data.results ?? []);
      setLoadingProgress(100);
      setTimeout(() => setStep('results'), 700);
    } catch (err: any) {
      setError(err.message);
      setStep('preview');
    }
  };

  const LoadingAnimComponent = LoadingAnimations[loadingAnimIdx];

  return (
    <Modal open onClose={onClose} disableClose={isLoading} maxWidth="max-w-2xl">

        {/* ── STEP: input ── */}
        {step === 'input' && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between border-b border-brand-sage/20 px-6 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-brand-lime" />
                  <h2 className="text-base font-semibold text-brand-black">Create Template with AI</h2>
                </div>
                <p className="text-xs text-brand-slate mt-0.5">
                  Upload a reference ad and Claude will reverse-engineer it into a reusable prompt template
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-brand-slate hover:bg-brand-cream hover:text-brand-forest"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {/* Drop zone */}
              <div
                className={cn(
                  'relative rounded-xl border-2 border-dashed transition-colors cursor-pointer',
                  isDragging
                    ? 'border-brand-forest bg-brand-forest/5'
                    : 'border-brand-sage/40 hover:border-brand-forest/50 hover:bg-brand-cream/30',
                )}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleFileChange}
                />

                {imagePreview ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreview}
                      alt="Reference ad"
                      className="w-full max-h-72 object-contain rounded-xl"
                    />
                    <button
                      className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                      onClick={(e) => {
                        e.stopPropagation();
                        setImageBase64(null);
                        setImagePreview(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <p className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-[10px] text-white/80">
                      Click or drop to replace
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 py-10">
                    <div className="rounded-xl bg-brand-cream p-3">
                      <ImagePlus className="h-7 w-7 text-brand-slate" />
                    </div>
                    <p className="text-sm font-medium text-brand-slate">
                      Drop an ad image here
                    </p>
                    <p className="text-xs text-brand-slate/60">or click to browse · JPG, PNG, WEBP</p>
                  </div>
                )}
              </div>

              {/* Optional description */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-brand-slate">
                  Additional context <span className="text-brand-slate/50">(optional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the ad format, target audience, or layout notes…"
                  rows={3}
                  className="w-full resize-none rounded-lg border border-brand-sage/30 bg-brand-cream/30 px-3 py-2.5 text-sm leading-relaxed text-brand-navy placeholder:text-brand-slate/40 focus:border-brand-forest focus:outline-none focus:ring-2 focus:ring-brand-forest/20"
                />
              </div>

              {error && (
                <p className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {error}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 border-t border-brand-sage/20 px-6 py-4">
              <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
              <Button
                size="sm"
                onClick={handleGenerate}
                disabled={!imageBase64 && !description.trim()}
                className="bg-brand-forest hover:bg-brand-forest/90"
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Generate Template
              </Button>
            </div>
          </>
        )}

        {/* ── STEP: generating / testing — inline loading ── */}
        {isLoading && (
          <>
            <div className="flex items-center justify-between border-b border-brand-sage/20 px-6 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-brand-lime animate-pulse" />
                  <h2 className="text-base font-semibold text-brand-black">
                    {step === 'generating' ? 'Building your template…' : 'Testing with 3 products…'}
                  </h2>
                </div>
                <p className="text-xs text-brand-slate mt-0.5">This usually takes 15–30 seconds</p>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center gap-4 px-6 py-8">
              {/* Animated SVG — same as LoadingExperience */}
              <div
                style={{
                  width: 180, height: 180,
                  animation: 'floatBob 4s ease-in-out infinite',
                  opacity:   loadingAnimFading ? 0 : 1,
                  transform: loadingAnimFading ? 'scale(0.9) translateY(10px)' : 'scale(1) translateY(0)',
                  transition: 'opacity 500ms ease, transform 500ms ease',
                }}
              >
                <LoadingAnimComponent key={loadingAnimIdx} />
              </div>

              {/* Rotating message */}
              <p
                className="text-center text-sm font-medium text-brand-forest/80 max-w-xs"
                style={{
                  opacity:   loadingTextFading ? 0 : 1,
                  transform: loadingTextFading ? 'translateY(6px)' : 'translateY(0)',
                  transition: 'opacity 300ms ease, transform 300ms ease',
                }}
              >
                {loadingMessages[loadingMsgIdx]}
              </p>

              {/* Progress bar */}
              <div className="w-full max-w-xs">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-sage/15">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${loadingProgress}%`,
                      background: 'linear-gradient(90deg, #2D644E, #4A9E7A, #D4A853)',
                      boxShadow:  '0 0 10px rgba(45,100,78,0.25)',
                      transition: loadingProgress === 100
                        ? 'width 700ms cubic-bezier(0.4,0,0.2,1)'
                        : 'width 1000ms ease-out',
                    }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-brand-slate/50">
                  <span>{step === 'generating' ? 'Crafting your template…' : 'Generating 3 ad images…'}</span>
                  <span>{Math.round(loadingProgress)}%</span>
                </div>
              </div>

              <p className="text-[10px] text-brand-slate/35 text-center">
                {step === 'generating'
                  ? 'Claude is analysing layout, tokens, and composition'
                  : 'Good things take time — about 15–30s per image'}
              </p>
            </div>
          </>
        )}

        {/* ── STEP: preview ── */}
        {step === 'preview' && template && (
          <>
            <div className="flex items-start justify-between border-b border-brand-sage/20 px-6 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <h2 className="text-base font-semibold text-brand-black">Template Created</h2>
                </div>
                <p className="text-xs text-brand-slate mt-0.5">
                  Saved to library · Test it against 3 random products
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-brand-slate hover:bg-brand-cream hover:text-brand-forest"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                  {template.category}
                </Badge>
                <span className="text-[10px] font-medium text-brand-slate bg-brand-cream px-1.5 py-0.5 rounded">
                  {template.default_aspect_ratio}
                </span>
                <span className="text-[11px] font-semibold text-brand-black ml-1">
                  {template.name}
                </span>
              </div>

              {/* Prompt preview */}
              <div className="rounded-lg bg-brand-cream/40 border border-brand-sage/20 p-3">
                <p className="font-mono text-[11px] leading-relaxed text-brand-navy whitespace-pre-wrap">
                  {template.template}
                </p>
              </div>

              {error && (
                <p className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {error}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-brand-sage/20 px-6 py-4">
              <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
              <Button
                size="sm"
                onClick={handleTest}
                className="bg-brand-forest hover:bg-brand-forest/90"
              >
                <FlaskConical className="mr-1.5 h-3.5 w-3.5" />
                Test Template
              </Button>
            </div>
          </>
        )}

        {/* ── STEP: results ── */}
        {step === 'results' && template && (
          <>
            <div className="flex items-start justify-between border-b border-brand-sage/20 px-6 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <Images className="h-4 w-4 text-brand-lime" />
                  <h2 className="text-base font-semibold text-brand-black">Test Results</h2>
                </div>
                <p className="text-xs text-brand-slate mt-0.5">
                  {testResults.filter((r) => !('error' in r)).length} of {testResults.length} images generated
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-brand-slate hover:bg-brand-cream hover:text-brand-forest"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-3 gap-3">
                {testResults.map((result, idx) => {
                  if ('error' in result) {
                    return (
                      <div
                        key={idx}
                        className="flex flex-col items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4"
                        style={{ aspectRatio: aspectToCSS(template.default_aspect_ratio) }}
                      >
                        <AlertTriangle className="h-5 w-5 text-red-400" />
                        <p className="text-[10px] text-red-500 text-center">{result.error}</p>
                        <p className="text-[10px] text-brand-slate/60 text-center">{result.productName}</p>
                      </div>
                    );
                  }
                  return (
                    <div key={result.imageId} className="flex flex-col gap-1.5">
                      <div
                        className="relative overflow-hidden rounded-xl ring-1 ring-brand-sage/30"
                        style={{ aspectRatio: aspectToCSS(result.aspectRatio) }}
                      >
                        <Image
                          src={result.imageUrl}
                          alt={result.productName}
                          fill
                          className="object-cover"
                          sizes="200px"
                        />
                      </div>
                      <p className="text-[10px] text-brand-slate text-center leading-tight line-clamp-2">
                        {result.productName}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-brand-sage/20 px-6 py-4">
              <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
              {template && (
                <Button
                  size="sm"
                  onClick={() => onViewInGallery(template.id)}
                  className="bg-brand-forest hover:bg-brand-forest/90"
                >
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  View in Gallery
                </Button>
              )}
            </div>
          </>
        )}
    </Modal>
  );
}

// ─── Create Template Card ─────────────────────────────────────────────────────

function CreateTemplateCard({ onClick }: { onClick: () => void }) {
  return (
    <div
      className={cn(
        'group relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed',
        'border-brand-sage/40 bg-white p-8 text-center transition-shadow',
        'hover:shadow-md',
      )}
      style={{ minHeight: 180 }}
    >
      <div className={cn(
        'flex h-11 w-11 items-center justify-center rounded-xl bg-brand-cream transition-colors',
        'group-hover:bg-brand-forest/10',
      )}>
        <Sparkles className="h-5 w-5 text-brand-slate group-hover:text-brand-forest transition-colors" />
      </div>
      <div>
        <p className="text-sm font-semibold text-brand-black">
          Copy Competitor's Top Ad
        </p>
        <p className="mt-0.5 text-[11px] text-brand-slate/60 leading-snug">
          Upload any ad and Claude reverse-engineers it into a reusable template
        </p>
      </div>
      <button
        onClick={onClick}
        className="mt-1 rounded-lg bg-brand-forest px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-brand-forest/90 transition-colors"
      >
        Create Template
      </button>
    </div>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditModal({
  template,
  onSave,
  onClose,
}: {
  template: PromptTemplate;
  onSave:   (updated: PromptTemplate) => void;
  onClose:  () => void;
}) {
  const [name,         setName]         = useState(template.name);
  const [category,     setCategory]     = useState(template.category);
  const [templateText, setTemplateText] = useState(template.template);
  const [aspectRatio,  setAspectRatio]  = useState(template.default_aspect_ratio);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim() || !category.trim() || !templateText.trim()) {
      setError('All fields are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/templates/${template.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), category: category.trim(), template: templateText.trim(), default_aspect_ratio: aspectRatio }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Save failed'); }
      onSave(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      maxWidth="max-w-2xl"
      title={
        <span className="flex items-center gap-2">
          <span className="text-xs font-bold text-brand-lime">#{template.number}</span>
          {template.name}
          <Badge variant="secondary" className="font-sans text-[10px]">{template.category}</Badge>
        </span>
      }
      subtitle="System-level edit — changes apply to all future generations"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="bg-brand-forest hover:bg-brand-forest/90">
            {saving
              ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Saving…</>
              : <><Check className="mr-1.5 h-3.5 w-3.5" />Save changes</>
            }
          </Button>
        </div>
      }
    >
        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Name + Category row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-brand-slate">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-brand-slate">Category</label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} className="text-sm" placeholder="e.g. Social Proof" />
            </div>
          </div>

          {/* Aspect ratio pills */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-brand-slate">Default Aspect Ratio</label>
            <div className="flex gap-2">
              {ASPECT_RATIOS.map((r) => (
                <button
                  key={r}
                  onClick={() => setAspectRatio(r)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium border transition',
                    aspectRatio === r
                      ? 'bg-brand-forest text-white border-brand-forest shadow-sm'
                      : 'border-brand-sage/40 text-brand-slate hover:border-brand-forest/50 hover:text-brand-forest',
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Template text */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-brand-slate">Template Prompt</label>
            <textarea
              value={templateText}
              onChange={(e) => setTemplateText(e.target.value)}
              rows={12}
              className="w-full resize-none rounded-lg border border-brand-sage/30 bg-brand-cream/30 px-3 py-2.5 font-mono text-xs leading-relaxed text-brand-navy focus:border-brand-forest focus:outline-none focus:ring-2 focus:ring-brand-forest/20"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
    </Modal>
  );
}

// ─── Main grid ────────────────────────────────────────────────────────────────

export function AdminTemplateGrid({
  templates:        initialTemplates,
  imagesByTemplate: initialImagesByTemplate,
  countByTemplate,
  isDev,
  workspaceId,
}: AdminTemplateGridProps) {
  const router = useRouter();
  const snackbar = useSnackbar();

  const [templates,           setTemplates]           = useState(initialTemplates);
  const [imagesByTemplate,    setImagesByTemplate]    = useState(initialImagesByTemplate);
  const [categoryFilter,      setCategoryFilter]      = useState('All');
  const [editingId,           setEditingId]           = useState<string | null>(null);
  const [confirmDeleteId,     setConfirmDeleteId]     = useState<string | null>(null);
  const [deleting,            setDeleting]            = useState(false);
  const [galleryId,           setGalleryId]           = useState<string | null>(null);
  const [showCreate,          setShowCreate]          = useState(false);
  const [generatingPreviewId, setGeneratingPreviewId] = useState<string | null>(null);
  const [promotingId,         setPromotingId]         = useState<string | null>(null);

  const handleGeneratePreview = async (templateId: string, force = false) => {
    setGeneratingPreviewId(templateId);
    try {
      const res = await fetch(`/api/admin/templates/${templateId}/preview`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ force }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Preview generation failed');
      setTemplates((prev) =>
        prev.map((t) => t.id === templateId ? { ...t, preview_image_url: data.preview_image_url } : t)
      );
    } catch (err: any) {
      snackbar.show({ message: `Preview failed: ${err.message}`, tone: 'error' });
    } finally {
      setGeneratingPreviewId(null);
    }
  };

  // Generate previews for all templates that don't have one yet
  const [generatingAllPreviews, setGeneratingAllPreviews] = useState(false);
  const handleGenerateAllPreviews = async () => {
    const missing = templates.filter((t) => !t.preview_image_url);
    if (missing.length === 0) return;
    setGeneratingAllPreviews(true);
    for (const t of missing) {
      await handleGeneratePreview(t.id, false);
    }
    setGeneratingAllPreviews(false);
  };
  const missingPreviewCount = templates.filter((t) => !t.preview_image_url).length;

  const filtered = categoryFilter === 'All'
    ? templates
    : templates.filter((t) => t.category === categoryFilter);

  const handleCreated = (newTemplate: PromptTemplate) => {
    // Optimistically prepend — page refresh will reorder by number
    setTemplates((prev) => [newTemplate, ...prev]);
  };

  const handleSave = (updated: PromptTemplate) => {
    setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setEditingId(null);
    router.refresh();
  };

  // Devs hard-delete; admins soft-archive (server decides — same endpoint).
  // Either way the row leaves this active-only grid.
  const handleDelete = async (id: string) => {
    setDeleting(true);
    const res = await fetch(`/api/admin/templates/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } else {
      const d = await res.json().catch(() => ({}));
      snackbar.show({ message: d.error || `${isDev ? 'Delete' : 'Archive'} failed`, tone: 'error' });
    }
    setConfirmDeleteId(null);
    setDeleting(false);
    router.refresh();
  };

  // Dev-only: promote a workspace-local template into the universal catalog.
  const handlePromote = async (id: string) => {
    setPromotingId(id);
    try {
      const res = await fetch(`/api/dev/templates/${id}/promote`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Promote failed');
      setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, workspace_id: null } : t)));
      router.refresh();
    } catch (err: any) {
      snackbar.show({ message: `Promote failed: ${err.message}`, tone: 'error' });
    } finally {
      setPromotingId(null);
    }
  };

  const editingTemplate = editingId ? templates.find((t) => t.id === editingId) ?? null : null;
  const galleryTemplate = galleryId ? templates.find((t) => t.id === galleryId) ?? null : null;

  return (
    <>
      {/* Category filter + count */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={cn(
              'filter-pill rounded-full px-3 py-1 text-xs font-medium transition',
              categoryFilter === cat
                ? 'bg-brand-forest text-white shadow-sm'
                : 'border border-brand-sage/40 bg-white text-brand-slate hover:border-brand-forest/50 hover:text-brand-forest hover:shadow-sm',
            )}
          >
            {cat}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-3">
          {missingPreviewCount > 0 && (
            <button
              onClick={handleGenerateAllPreviews}
              disabled={generatingAllPreviews || !!generatingPreviewId}
              className="flex items-center gap-1.5 rounded-lg border border-brand-sage/40 bg-white px-3 py-1.5 text-xs font-medium text-brand-slate hover:border-brand-forest/50 hover:text-brand-forest hover:bg-brand-cream transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generatingAllPreviews ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Camera className="h-3 w-3" />
              )}
              {generatingAllPreviews
                ? 'Generating previews…'
                : `Generate ${missingPreviewCount} missing preview${missingPreviewCount !== 1 ? 's' : ''}`}
            </button>
          )}
          <span className="text-xs text-brand-slate">
            {filtered.length} template{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Create card — always first */}
        <CreateTemplateCard onClick={() => setShowCreate(true)} />

        {filtered.map((template) => {
          const previewImages   = (imagesByTemplate[template.id] || []).slice(0, 2);
          const imageCount      = countByTemplate[template.id] ?? 0;
          const overflow        = imageCount - previewImages.length;
          const isConfirmDelete = confirmDeleteId === template.id;
          const showPlaceholder = hasPlaceholders(template.template);

          // Scope gating: devs manage everything; admins only their own
          // workspace's templates (universal ones are read-only for them).
          const isWorkspaceScoped = template.workspace_id != null;
          const canManage = isDev || (isWorkspaceScoped && template.workspace_id === workspaceId);
          const DeleteIcon = isDev ? Trash2 : Archive;
          const deleteVerb = isDev ? 'Delete' : 'Archive';

          return (
            <div
              key={template.id}
              className="template-card group relative rounded-xl border border-brand-sage/30 bg-white p-4 hover:border-brand-forest/40 hover:shadow-md transition-[border-color,box-shadow]"
            >
              {/* Admin action buttons — top right (hidden on read-only templates) */}
              {canManage && (
                <div className="absolute right-3 top-3 flex items-center gap-1">
                  {isConfirmDelete ? (
                    <>
                      <span className="mr-1 text-[10px] text-red-500 font-medium">{deleteVerb}?</span>
                      <button
                        onClick={() => handleDelete(template.id)}
                        disabled={deleting}
                        className="rounded-md bg-red-500 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-red-600 disabled:opacity-60"
                      >
                        {deleting ? '…' : 'Yes'}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded-md border border-brand-sage/40 px-2 py-0.5 text-[10px] font-medium text-brand-slate hover:text-brand-forest"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => { setEditingId(template.id); setConfirmDeleteId(null); }}
                        title="Edit template"
                        className="rounded-md p-1 text-brand-slate opacity-0 group-hover:opacity-100 hover:bg-brand-cream hover:text-brand-forest transition-opacity"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => { setConfirmDeleteId(template.id); setEditingId(null); }}
                        title={`${deleteVerb} template`}
                        className="rounded-md p-1 text-brand-slate opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition-opacity"
                      >
                        <DeleteIcon className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Number + Name */}
              <div className={cn('mb-2', isConfirmDelete ? 'pr-36' : canManage ? 'pr-16' : '')}>
                <span className="text-[11px] font-bold text-brand-lime mr-1">#{template.number}</span>
                <h3 className="inline text-sm font-semibold text-brand-black leading-snug">
                  {template.name}
                </h3>
              </div>

              {/* Badges row */}
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                  {template.category}
                </Badge>
                {isWorkspaceScoped ? (
                  <span
                    className="rounded-full bg-brand-lime/30 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brand-forest"
                    title="Local to this workspace"
                  >
                    Workspace
                  </span>
                ) : (
                  <span
                    className="rounded-full border border-brand-sage/40 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brand-slate/60"
                    title="Universal — available to every workspace"
                  >
                    Universal
                  </span>
                )}
                <span className="text-[10px] font-medium text-brand-slate bg-brand-cream px-1.5 py-0.5 rounded">
                  {template.default_aspect_ratio}
                </span>
                <span className="text-[10px] font-medium text-brand-slate/60 bg-transparent px-1 py-0.5 rounded">
                  v{template.version}
                </span>
                {showPlaceholder && (
                  <span className="text-[10px] font-medium text-amber-700 bg-amber-100 border border-amber-300/60 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                    <AlertTriangle className="h-2.5 w-2.5" /> placeholders
                  </span>
                )}
              </div>

              {/* Prompt preview */}
              <p className="text-[11px] text-brand-slate font-mono leading-relaxed line-clamp-4 mb-3">
                {template.template}
              </p>

              {/* Preview image (demo product Sulwhasoo) */}
              {template.preview_image_url && (
                <div className="mb-3 overflow-hidden rounded-lg border border-brand-sage/20 bg-brand-cream/30">
                  <Image
                    src={template.preview_image_url}
                    alt={`${template.name} preview`}
                    width={480}
                    height={0}
                    style={{ width: '100%', height: 'auto' }}
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, 360px"
                  />
                  <p className="px-2 py-1 text-[9px] text-brand-slate/40 text-right">
                    Demo: Sulwhasoo Ginseng Cream
                  </p>
                </div>
              )}

              {/* Generated images strip + preview button */}
              <div className="border-t border-brand-sage/20 pt-3 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  {imageCount === 0 ? (
                    <button
                      onClick={() => setGalleryId(template.id)}
                      className="flex items-center gap-1.5 text-[10px] text-brand-slate/50 hover:text-brand-slate transition-colors"
                    >
                      <Images className="h-3 w-3" />
                      No images generated yet
                    </button>
                  ) : (
                    <button
                      onClick={() => setGalleryId(template.id)}
                      className="group/strip flex items-center gap-2 hover:opacity-80 transition-opacity"
                    >
                      <div className="flex -space-x-1.5">
                        {previewImages.map((img) => (
                          <div key={img.id} className="relative h-7 w-7 overflow-hidden rounded-md ring-2 ring-white shrink-0">
                            <Image src={img.image_url} alt="" fill className="object-cover" sizes="28px" />
                          </div>
                        ))}
                      </div>
                      <span className="text-[10px] font-medium text-brand-slate group-hover/strip:text-brand-forest transition-colors">
                        {overflow > 0
                          ? `+${overflow} more · ${imageCount} total`
                          : `${imageCount} image${imageCount !== 1 ? 's' : ''} generated`}
                      </span>
                      <ChevronRight className="h-3 w-3 text-brand-slate/40 group-hover/strip:text-brand-forest/60 ml-auto transition-colors" />
                    </button>
                  )}
                </div>

                {/* Dev-only: promote a workspace template into the universal catalog */}
                {isDev && isWorkspaceScoped && (
                  <button
                    onClick={() => handlePromote(template.id)}
                    disabled={promotingId === template.id}
                    title="Make this template available to every workspace"
                    className="shrink-0 flex items-center gap-1 rounded-md border border-brand-sage/30 px-2 py-1 text-[10px] font-medium text-brand-slate hover:border-brand-forest/50 hover:text-brand-forest hover:bg-brand-cream transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {promotingId === template.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Globe className="h-3 w-3" />
                    )}
                    {promotingId === template.id ? 'Promoting…' : 'Promote to universal'}
                  </button>
                )}

                {/* Generate preview — only shown when no preview exists yet */}
                {!template.preview_image_url && (
                  <button
                    onClick={() => handleGeneratePreview(template.id, false)}
                    disabled={generatingPreviewId === template.id}
                    title="Generate preview image using Sulwhasoo demo product"
                    className="shrink-0 flex items-center gap-1 rounded-md border border-brand-sage/30 px-2 py-1 text-[10px] font-medium text-brand-slate hover:border-brand-forest/50 hover:text-brand-forest hover:bg-brand-cream transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generatingPreviewId === template.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Camera className="h-3 w-3" />
                    )}
                    {generatingPreviewId === template.id ? 'Generating…' : 'Preview'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit modal */}
      {editingTemplate && (
        <EditModal
          template={editingTemplate}
          onSave={handleSave}
          onClose={() => setEditingId(null)}
        />
      )}

      {/* Gallery modal */}
      {galleryTemplate && (
        <GalleryModal
          templateId={galleryTemplate.id}
          templateName={`#${galleryTemplate.number} · ${galleryTemplate.name}`}
          initialImages={imagesByTemplate[galleryTemplate.id] || []}
          initialCount={countByTemplate[galleryTemplate.id] ?? 0}
          onClose={() => setGalleryId(null)}
        />
      )}

      {/* Create template modal */}
      {showCreate && (
        <CreateTemplateModal
          onClose={() => {
            setShowCreate(false);
            router.refresh(); // sync DB order after creation
          }}
          onCreated={handleCreated}
          onViewInGallery={(templateId) => {
            setShowCreate(false);
            setGalleryId(templateId);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
