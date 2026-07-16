'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  X, Plus, Trash2, Loader2, Link2, ImageIcon, FileText,
  ChevronRight, ChevronLeft, ChevronDown, Check, AlertCircle,
  Upload, Globe, Eye, ArrowRight, Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { LoadingAnimations } from '@/components/loading-animations';
import type { Product, ProductContext, Ingredient, Claim, ColorEntry } from '@/types';

// Synthesis-specific rotating messages
const synthMessages = [
  "Scraping product pages for hidden gems...",
  "Teaching the AI about your ingredients list...",
  "Extracting colours from product imagery...",
  "Cross-referencing claims with sources...",
  "Building the compliance rulebook...",
  "Synthesizing the perfect product profile...",
  "Analysing label close-ups for fine print...",
  "Mapping benefits to marketing angles...",
  "Distilling 5 sources into 1 intelligence brief...",
  "The AI is reading ingredients like a formulator...",
  "Calibrating brand voice from product context...",
  "Almost there — great profiles take a moment...",
  "Structuring testimonials and social proof...",
  "Translating raw data into ad-ready intelligence...",
  "Connecting the dots between claims and copy...",
];

// ─── Types ───────────────────────────────────────────────────────────────────

type SynthesizedProduct = {
  name: string;
  brand: string;
  sub_brand: string | null;
  description: string | null;
  ingredients: Ingredient[];
  claims: Claim[];
  color_palette: ColorEntry[];
  compliance_rules: string[];
  prompt_modifier: string | null;
  context: ProductContext;
};

type ImageInput = {
  id: string;
  file: File;
  preview: string;
  base64: string;
  mediaType: string;
};

// Document attachments (PDF, DOCX, PPTX, TXT, MD) — mirror `ImageInput` except
// no object-URL preview is needed (we render a file-icon chip instead).
type DocumentInput = {
  id: string;
  file: File;
  base64: string;
  mediaType: string;
};

type Step = 'input' | 'processing' | 'review';

// Must stay in lockstep with lib/document-extractor.ts and the route handler.
const MAX_DOCUMENTS = 3;
const MAX_DOCUMENT_BYTES = 32 * 1024 * 1024;
const DOC_ACCEPT = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/markdown',
];
// For the <input accept=""> attribute: extensions are friendlier than raw MIME
// types in some browsers (esp. for .md which isn't always registered).
const DOC_ACCEPT_ATTR = '.pdf,.docx,.pptx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/markdown';

function inferDocMediaType(file: File): string {
  // Browsers are inconsistent about .md (sometimes empty, sometimes text/markdown,
  // sometimes text/x-markdown). Normalize to one of the types the server accepts.
  if (file.type && DOC_ACCEPT.includes(file.type)) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (name.endsWith('.pptx')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  if (name.endsWith('.md')) return 'text/markdown';
  if (name.endsWith('.txt')) return 'text/plain';
  return file.type || 'application/octet-stream';
}

function docLabel(mediaType: string): string {
  switch (mediaType) {
    case 'application/pdf': return 'PDF';
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': return 'DOCX';
    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation': return 'PPTX';
    case 'text/markdown': return 'MD';
    case 'text/plain': return 'TXT';
    default: return 'FILE';
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (product: SynthesizedProduct) => Promise<void>;
  existingProduct?: Product | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const inputCls =
  'w-full text-sm text-brand-navy bg-brand-cream/60 border border-brand-sage/30 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-forest/50 focus:bg-white transition-colors';
const textareaCls = inputCls + ' resize-none leading-relaxed';

function fileToBase64(file: File): Promise<{ data: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [meta, data] = result.split(',');
      const mediaType = meta.match(/:(.*?);/)?.[1] || 'image/jpeg';
      resolve({ data, mediaType });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Compress a product image before sending to the API.
 * Resizes to max 1568px on the long edge (Anthropic's recommended vision cap)
 * and re-encodes as JPEG at 0.82 quality.
 * Typical input: 3–5 MB → output: 150–400 KB.
 */
function compressImage(file: File): Promise<{ data: string; mediaType: string }> {
  const MAX_LONG_EDGE = 1568;
  const QUALITY = 0.82;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const blobUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(blobUrl);

      let { width, height } = img;
      if (Math.max(width, height) > MAX_LONG_EDGE) {
        if (width >= height) {
          height = Math.round((height / width) * MAX_LONG_EDGE);
          width = MAX_LONG_EDGE;
        } else {
          width = Math.round((width / height) * MAX_LONG_EDGE);
          height = MAX_LONG_EDGE;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas context unavailable')); return; }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error('Canvas toBlob failed')); return; }
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const [, data] = result.split(',');
          resolve({ data, mediaType: 'image/jpeg' });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      }, 'image/jpeg', QUALITY);
    };

    img.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      // Fall back to raw base64 if Canvas fails for any reason
      fileToBase64(file).then(resolve).catch(reject);
    };

    img.src = blobUrl;
  });
}

let idCounter = 0;
function uid() { return `img_${Date.now()}_${++idCounter}`; }

// ─── Diff indicator ──────────────────────────────────────────────────────────

function DiffBadge({ prev, curr, onRestore }: { prev: string | null | undefined; curr: string | null | undefined; onRestore?: () => void }) {
  const p = (prev ?? '').trim();
  const c = (curr ?? '').trim();
  if (!p && !c) return null;

  const canRestore = onRestore && p; // can restore only if there was a previous value

  if (!p && c) return <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 ml-2">NEW</span>;

  if (p && !c) return (
    <span className="inline-flex items-center gap-0.5 ml-2">
      <span className="text-[10px] font-medium text-red-700 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">REMOVED</span>
      {canRestore && <RestoreBtn onClick={onRestore} />}
    </span>
  );

  if (p !== c) return (
    <span className="inline-flex items-center gap-0.5 ml-2">
      <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">CHANGED</span>
      {canRestore && <RestoreBtn onClick={onRestore} />}
    </span>
  );

  return null;
}

function RestoreBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-0.5 text-[9px] font-medium text-brand-teal hover:text-brand-forest bg-brand-cream/80 hover:bg-brand-cream border border-brand-sage/20 rounded px-1.5 py-0.5 transition-colors"
      title="Restore previous value"
    >
      <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="1 4 1 10 7 10" />
        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
      </svg>
      Restore
    </button>
  );
}

function PrevValue({ value, onRestore }: { value: string | null | undefined; onRestore?: () => void }) {
  const v = (value ?? '').trim();
  if (!v) return null;
  return (
    <div className="text-[10px] text-brand-slate/60 mt-0.5 truncate flex items-center gap-1">
      <span className="line-through">was: {v}</span>
    </div>
  );
}

// ─── Step indicators ─────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const steps: { key: Step; label: string; num: number }[] = [
    { key: 'input', label: 'Add Sources', num: 1 },
    { key: 'processing', label: 'Synthesizing', num: 2 },
    { key: 'review', label: 'Review & Save', num: 3 },
  ];

  const idx = steps.findIndex((s) => s.key === current);

  return (
    <div className="flex items-center gap-2 px-6 py-3 border-b border-brand-sage/15 bg-brand-cream/30">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          {i > 0 && <ChevronRight className="h-3 w-3 text-brand-sage/40" />}
          <div className={cn(
            'flex items-center gap-1.5 text-xs font-medium transition-colors',
            i < idx && 'text-brand-teal',
            i === idx && 'text-brand-forest',
            i > idx && 'text-brand-sage/50',
          )}>
            <span className={cn(
              'flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold transition-colors',
              i < idx && 'bg-brand-teal text-white',
              i === idx && 'bg-brand-forest text-white',
              i > idx && 'bg-brand-sage/20 text-brand-sage/50',
            )}>
              {i < idx ? <Check className="h-3 w-3" /> : s.num}
            </span>
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function ProductSynthesizeModal({ open, onClose, onSave, existingProduct }: Props) {
  const [step, setStep] = useState<Step>('input');

  // Step 1 state — input sources
  const [textInput, setTextInput] = useState('');
  const [urls, setUrls] = useState<string[]>(['']);
  const [images, setImages] = useState<ImageInput[]>([]);
  const [documents, setDocuments] = useState<DocumentInput[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const docFileRef = useRef<HTMLInputElement>(null);

  // Step 2/3 state — synthesized result
  const [synthesized, setSynthesized] = useState<SynthesizedProduct | null>(null);
  const [draft, setDraft] = useState<SynthesizedProduct | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep('input');
      setTextInput('');
      setUrls(['']);
      setImages([]);
      setDocuments([]);
      setSynthesized(null);
      setDraft(null);
      setError(null);
      setSaving(false);
    }
  }, [open]);

  // ── URL management ──────────────────────────────────────────────────────────

  const addUrl = () => setUrls((prev) => [...prev, '']);
  const removeUrl = (i: number) => setUrls((prev) => prev.filter((_, idx) => idx !== i));
  const updateUrl = (i: number, v: string) =>
    setUrls((prev) => prev.map((u, idx) => (idx === i ? v : u)));

  // ── Image management ────────────────────────────────────────────────────────

  const handleImageAdd = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const newImages: ImageInput[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      // Compress before encoding — avoids Anthropic 413 on large product photos
      const { data, mediaType } = await compressImage(file);
      newImages.push({
        id: uid(),
        file,
        preview: URL.createObjectURL(file),
        base64: data,
        mediaType,
      });
    }
    setImages((prev) => [...prev, ...newImages]);
  }, []);

  const removeImage = (id: string) => {
    setImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img) URL.revokeObjectURL(img.preview);
      return prev.filter((i) => i.id !== id);
    });
  };

  // ── Document management ────────────────────────────────────────────────────

  const handleDocumentAdd = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const rejected: string[] = [];
    const newDocs: DocumentInput[] = [];

    // Count remaining slots; reject anything past the cap so the user sees a
    // clear message instead of a silent drop.
    setDocuments((prev) => {
      const availableSlots = Math.max(0, MAX_DOCUMENTS - prev.length);
      const incoming = Array.from(files);
      if (incoming.length > availableSlots) {
        rejected.push(`Only ${availableSlots} more document slot${availableSlots === 1 ? '' : 's'} available — dropped ${incoming.length - availableSlots}.`);
      }
      // return prev unchanged for now — actual insert happens below after async base64
      return prev;
    });

    const availableAtStart = MAX_DOCUMENTS - documents.length;
    const incoming = Array.from(files).slice(0, Math.max(0, availableAtStart));

    for (const file of incoming) {
      const mediaType = inferDocMediaType(file);
      if (!DOC_ACCEPT.includes(mediaType)) {
        rejected.push(`${file.name}: unsupported type (use PDF, DOCX, PPTX, TXT, or MD).`);
        continue;
      }
      if (file.size > MAX_DOCUMENT_BYTES) {
        rejected.push(`${file.name}: ${formatBytes(file.size)} exceeds 32 MB limit.`);
        continue;
      }
      const { data } = await fileToBase64(file);
      newDocs.push({
        id: uid(),
        file,
        base64: data,
        mediaType,
      });
    }

    if (newDocs.length > 0) setDocuments((prev) => [...prev, ...newDocs]);
    if (rejected.length > 0) setError(rejected.join(' '));

    // Clear the input so selecting the same file twice re-fires onChange.
    if (docFileRef.current) docFileRef.current.value = '';
  }, [documents.length]);

  const removeDocument = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  // ── Synthesize ──────────────────────────────────────────────────────────────

  const canSynthesize =
    textInput.trim() ||
    urls.some((u) => u.trim()) ||
    images.length > 0 ||
    documents.length > 0;

  const handleSynthesize = async () => {
    setStep('processing');
    setError(null);

    try {
      const cleanUrls = urls.map((u) => u.trim()).filter(Boolean);
      const imagePayload = images.map((img) => ({
        data: img.base64,
        mediaType: img.mediaType,
      }));
      const docPayload = documents.map((d) => ({
        name: d.file.name,
        data: d.base64,
        mediaType: d.mediaType,
      }));

      const res = await fetch('/api/products/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textInput.trim() || undefined,
          urls: cleanUrls.length > 0 ? cleanUrls : undefined,
          images: imagePayload.length > 0 ? imagePayload : undefined,
          documents: docPayload.length > 0 ? docPayload : undefined,
          existingProductId: existingProduct?.id,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Synthesis failed');
      }

      const { synthesized: result } = await res.json();
      setSynthesized(result);
      setDraft(JSON.parse(JSON.stringify(result)));
      setStep('review');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      setStep('input');
    }
  };

  // ── Draft editing helpers ───────────────────────────────────────────────────

  const updateDraftField = (field: keyof SynthesizedProduct, value: any) => {
    setDraft((prev) => prev ? { ...prev, [field]: value } : prev);
  };

  const updateDraftContext = (field: keyof ProductContext, value: any) => {
    setDraft((prev) =>
      prev ? { ...prev, context: { ...prev.context, [field]: value } } : prev,
    );
  };

  // ── Save ────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await onSave(draft);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Modal
      open={open}
      onClose={onClose}
      maxWidth="max-w-2xl"
      className="max-h-[85vh] overflow-hidden"
      title={existingProduct ? `Enrich: ${existingProduct.name}` : 'Add New Product'}
    >
        <StepIndicator current={step} />

        {/* Error banner */}
        {error && (
          <div className="mx-6 mt-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Synthesis failed</p>
              <p className="text-xs mt-0.5 text-red-600">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="ml-auto p-0.5">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Step content */}
        <div className="flex-1 overflow-y-auto scroll-spring">
          {step === 'input' && (
            <InputStep
              textInput={textInput}
              setTextInput={setTextInput}
              urls={urls}
              addUrl={addUrl}
              removeUrl={removeUrl}
              updateUrl={updateUrl}
              images={images}
              handleImageAdd={handleImageAdd}
              removeImage={removeImage}
              fileRef={fileRef}
              documents={documents}
              handleDocumentAdd={handleDocumentAdd}
              removeDocument={removeDocument}
              docFileRef={docFileRef}
              existingProduct={existingProduct}
            />
          )}

          {step === 'processing' && <ProcessingStep />}

          {step === 'review' && draft && (
            <ReviewStep
              draft={draft}
              existingProduct={existingProduct}
              updateDraftField={updateDraftField}
              updateDraftContext={updateDraftContext}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-brand-sage/15 bg-brand-cream/20">
          {step === 'input' && (
            <>
              <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
              <Button
                size="sm"
                disabled={!canSynthesize}
                onClick={handleSynthesize}
              >
                Synthesize <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </>
          )}

          {step === 'processing' && (
            <>
              <div />
              <Button variant="outline" size="sm" onClick={() => setStep('input')}>
                Cancel
              </Button>
            </>
          )}

          {step === 'review' && (
            <>
              <Button variant="outline" size="sm" onClick={() => setStep('input')}>
                <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Back
              </Button>
              <Button size="sm" disabled={saving} onClick={handleSave}>
                {saving ? (
                  <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving…</>
                ) : (
                  <><Check className="mr-1.5 h-3.5 w-3.5" /> {existingProduct ? 'Update Product' : 'Create Product'}</>
                )}
              </Button>
            </>
          )}
        </div>
    </Modal>
  );
}

// ─── Step 1: Input ───────────────────────────────────────────────────────────

function InputStep({
  textInput, setTextInput, urls, addUrl, removeUrl, updateUrl,
  images, handleImageAdd, removeImage, fileRef,
  documents, handleDocumentAdd, removeDocument, docFileRef,
  existingProduct,
}: {
  textInput: string;
  setTextInput: (v: string) => void;
  urls: string[];
  addUrl: () => void;
  removeUrl: (i: number) => void;
  updateUrl: (i: number, v: string) => void;
  images: ImageInput[];
  handleImageAdd: (files: FileList | null) => void;
  removeImage: (id: string) => void;
  fileRef: React.RefObject<HTMLInputElement>;
  documents: DocumentInput[];
  handleDocumentAdd: (files: FileList | null) => void;
  removeDocument: (id: string) => void;
  docFileRef: React.RefObject<HTMLInputElement>;
  existingProduct?: Product | null;
}) {
  return (
    <div className="p-6 space-y-6">
      {existingProduct && (
        <div className="flex items-start gap-3 bg-brand-cream/50 border border-brand-sage/20 rounded-lg p-3">
          <Info className="h-4 w-4 text-brand-teal mt-0.5 shrink-0" />
          <p className="text-xs text-brand-slate leading-relaxed">
            You&apos;re enriching <strong className="text-brand-forest">{existingProduct.name}</strong>.
            New data will be merged with existing fields. You&apos;ll review changes before saving.
          </p>
        </div>
      )}

      {/* Text description */}
      <div>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-brand-forest mb-2">
          <FileText className="h-3.5 w-3.5" /> Text Description
        </label>
        <textarea
          className={textareaCls}
          rows={4}
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="Paste product description, ingredients, claims, pricing info…"
        />
      </div>

      {/* URLs */}
      <div>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-brand-forest mb-2">
          <Globe className="h-3.5 w-3.5" /> Product URLs
        </label>
        <p className="text-[10px] text-brand-slate/60 mb-2">
          Add product page URLs — we&apos;ll scrape and extract relevant information.
        </p>
        <div className="space-y-2">
          {urls.map((url, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="relative flex-1">
                <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-brand-sage/50" />
                <input
                  className={cn(inputCls, 'pl-8')}
                  value={url}
                  onChange={(e) => updateUrl(i, e.target.value)}
                  placeholder="https://example.com/product"
                />
              </div>
              {urls.length > 1 && (
                <button
                  onClick={() => removeUrl(i)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-brand-slate/40 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          {urls.length < 5 && (
            <button
              onClick={addUrl}
              className="flex items-center gap-1 text-xs text-brand-teal hover:text-brand-forest transition-colors"
            >
              <Plus className="h-3 w-3" /> Add another URL
            </button>
          )}
        </div>
      </div>

      {/* Images */}
      <div>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-brand-forest mb-2">
          <ImageIcon className="h-3.5 w-3.5" /> Product Images
        </label>
        <p className="text-[10px] text-brand-slate/60 mb-2">
          Upload product photos, packaging shots, label close-ups — the AI will extract colors, text, and details.
        </p>

        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => handleImageAdd(e.target.files)}
        />

        <div className="flex flex-wrap gap-3">
          {images.map((img) => (
            <div key={img.id} className="relative group">
              <img
                src={img.preview}
                alt={img.file.name}
                className="w-20 h-20 object-cover rounded-lg border border-brand-sage/20"
              />
              <button
                onClick={() => removeImage(img.id)}
                className="absolute -top-1.5 -right-1.5 bg-white border border-red-200 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
              >
                <X className="h-3 w-3 text-red-500" />
              </button>
              <span className="block text-[9px] text-brand-slate/50 mt-1 truncate max-w-[80px]">
                {img.file.name}
              </span>
            </div>
          ))}

          <button
            onClick={() => fileRef.current?.click()}
            className="w-20 h-20 flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-brand-sage/30 hover:border-brand-teal/50 hover:bg-brand-cream/50 transition-colors"
          >
            <Upload className="h-4 w-4 text-brand-sage/50" />
            <span className="text-[9px] text-brand-sage/50">Upload</span>
          </button>
        </div>
      </div>

      {/* Documents — PDF, DOCX, PPTX, TXT, MD. Same one-shot pattern as URLs/images. */}
      <div>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-brand-forest mb-2">
          <FileText className="h-3.5 w-3.5" /> Reference Documents
          <span className="text-[9px] font-normal text-brand-slate/50">
            ({documents.length}/{MAX_DOCUMENTS})
          </span>
        </label>
        <p className="text-[10px] text-brand-slate/60 mb-2">
          Upload brand guides, spec sheets, one-pagers, or briefs — PDF, DOCX, PPTX, TXT, or MD up to 32 MB each.
        </p>

        <input
          ref={docFileRef}
          type="file"
          multiple
          accept={DOC_ACCEPT_ATTR}
          className="hidden"
          onChange={(e) => handleDocumentAdd(e.target.files)}
        />

        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-2.5 p-2 rounded-lg bg-brand-cream/40 border border-brand-sage/15"
            >
              <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-brand-teal/10 text-brand-teal">
                {docLabel(doc.mediaType)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-brand-navy truncate" title={doc.file.name}>
                  {doc.file.name}
                </p>
                <p className="text-[10px] text-brand-slate/50">{formatBytes(doc.file.size)}</p>
              </div>
              <button
                onClick={() => removeDocument(doc.id)}
                className="p-1 rounded hover:bg-red-50 text-brand-slate/40 hover:text-red-500 transition-colors shrink-0"
                aria-label={`Remove ${doc.file.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {documents.length < MAX_DOCUMENTS && (
            <button
              onClick={() => docFileRef.current?.click()}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border-2 border-dashed border-brand-sage/30 hover:border-brand-teal/50 hover:bg-brand-cream/50 transition-colors text-xs text-brand-sage/70 hover:text-brand-teal"
            >
              <Upload className="h-3.5 w-3.5" />
              {documents.length === 0 ? 'Upload documents' : 'Add another document'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: Processing (animated) ───────────────────────────────────────────

function ProcessingStep() {
  const [msgIdx, setMsgIdx] = useState(() => Math.floor(Math.random() * synthMessages.length));
  const [animIdx, setAnimIdx] = useState(() => Math.floor(Math.random() * LoadingAnimations.length));
  const [textFading, setTextFading] = useState(false);
  const [animFading, setAnimFading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const AnimComponent = LoadingAnimations[animIdx];

  // Elapsed timer
  useEffect(() => {
    const iv = setInterval(() => setElapsed((p) => p + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  // Fake progress curve (estimatedSeconds ~45)
  useEffect(() => {
    setProgress(Math.min(92, (1 - Math.exp(-elapsed / 27)) * 100));
  }, [elapsed]);

  // Rotate messages every 4s
  useEffect(() => {
    const iv = setInterval(() => {
      setTextFading(true);
      setTimeout(() => {
        setMsgIdx((p) => (p + 1) % synthMessages.length);
        setTextFading(false);
      }, 300);
    }, 4000);
    return () => clearInterval(iv);
  }, []);

  // Cycle animations every 9s
  useEffect(() => {
    const iv = setInterval(() => {
      setAnimFading(true);
      setTimeout(() => {
        setAnimIdx((p) => (p + 1) % LoadingAnimations.length);
        setAnimFading(false);
      }, 500);
    }, 9000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-10 px-6">
      {/* Animated SVG illustration */}
      <div
        className="mb-5 relative transition-[opacity,transform] duration-500 ease-out"
        style={{
          width: 180,
          height: 180,
          animation: 'floatBob 4s ease-in-out infinite',
          opacity: animFading ? 0 : 1,
          transform: animFading ? 'scale(0.9) translateY(10px)' : 'scale(1) translateY(0)',
        }}
      >
        <AnimComponent key={animIdx} />
      </div>

      {/* Rotating message */}
      <div className="h-12 flex items-center justify-center mb-4">
        <p
          className="text-center text-sm font-medium text-brand-forest/80 transition-[opacity,transform] duration-300 ease-out max-w-sm"
          style={{
            opacity: textFading ? 0 : 1,
            transform: textFading ? 'translateY(6px)' : 'translateY(0)',
          }}
        >
          {synthMessages[msgIdx]}
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-xs">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-sage/15">
          <div
            className="h-full rounded-full"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #2D644E, #4A9E7A, #D4A853)',
              boxShadow: '0 0 10px rgba(45,100,78,0.25)',
              transition: 'width 1000ms ease-out',
            }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] text-brand-slate/50">
          <span>Synthesizing product intelligence...</span>
          <span>{Math.round(progress)}%</span>
        </div>
      </div>

      <p className="mt-5 text-[10px] text-brand-slate/35 text-center">
        The AI is analyzing all your sources — this takes 30–60 seconds
      </p>
    </div>
  );
}

// ─── Step 3: Review ──────────────────────────────────────────────────────────

function ReviewStep({
  draft,
  existingProduct,
  updateDraftField,
  updateDraftContext,
}: {
  draft: SynthesizedProduct;
  existingProduct?: Product | null;
  updateDraftField: (field: keyof SynthesizedProduct, value: any) => void;
  updateDraftContext: (field: keyof ProductContext, value: any) => void;
}) {
  const ex = existingProduct;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start gap-2 bg-brand-cream/50 border border-brand-sage/20 rounded-lg p-3">
        <Eye className="h-4 w-4 text-brand-teal mt-0.5 shrink-0" />
        <p className="text-xs text-brand-slate leading-relaxed">
          Review the synthesized data below. Edit any field before saving.
          {ex && <> Fields marked <span className="text-amber-700 font-medium">CHANGED</span> differ from existing data.</>}
        </p>
      </div>

      {/* Basic fields */}
      <ReviewSection title="Identity">
        <ReviewField
          label="Name"
          value={draft.name}
          prev={ex?.name}
          onChange={(v) => updateDraftField('name', v)}
        />
        <ReviewField
          label="Brand"
          value={draft.brand}
          prev={ex?.brand}
          onChange={(v) => updateDraftField('brand', v)}
        />
        <ReviewField
          label="Sub-brand"
          value={draft.sub_brand || ''}
          prev={ex?.sub_brand}
          onChange={(v) => updateDraftField('sub_brand', v || null)}
        />
        <ReviewField
          label="Description"
          value={draft.description || ''}
          prev={ex?.description}
          onChange={(v) => updateDraftField('description', v || null)}
          multiline
        />
      </ReviewSection>

      {/* Prompt modifier */}
      <ReviewSection title="AI Prompt Modifier">
        <ReviewField
          label="Prompt Modifier"
          value={draft.prompt_modifier || ''}
          prev={ex?.prompt_modifier}
          onChange={(v) => updateDraftField('prompt_modifier', v || null)}
          multiline
        />
      </ReviewSection>

      {/* Ingredients */}
      <ReviewSection title={`Ingredients (${draft.ingredients.length})`}>
        {draft.ingredients.map((ing, i) => (
          <div key={i} className="flex items-start gap-2 py-1.5 border-b border-brand-sage/10 last:border-0">
            <span className={cn(
              'text-[10px] font-bold px-1 py-0.5 rounded mt-0.5 shrink-0',
              ing.key ? 'bg-brand-teal/10 text-brand-teal' : 'bg-gray-100 text-gray-400',
            )}>
              {ing.key ? 'KEY' : 'SEC'}
            </span>
            <div className="flex-1 min-w-0">
              <input
                className={cn(inputCls, 'text-xs font-medium')}
                value={ing.name}
                onChange={(e) => {
                  const updated = [...draft.ingredients];
                  updated[i] = { ...updated[i], name: e.target.value };
                  updateDraftField('ingredients', updated);
                }}
              />
              {ing.description && (
                <input
                  className={cn(inputCls, 'text-[11px] mt-1 text-brand-slate/70')}
                  value={ing.description}
                  onChange={(e) => {
                    const updated = [...draft.ingredients];
                    updated[i] = { ...updated[i], description: e.target.value };
                    updateDraftField('ingredients', updated);
                  }}
                />
              )}
            </div>
            <button
              onClick={() => {
                updateDraftField('ingredients', draft.ingredients.filter((_, idx) => idx !== i));
              }}
              className="p-1 rounded hover:bg-red-50 text-brand-slate/30 hover:text-red-500 transition-colors mt-0.5"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </ReviewSection>

      {/* Claims */}
      <ReviewSection title={`Claims (${draft.claims.length})`}>
        {draft.claims.map((claim, i) => (
          <div key={i} className="py-1.5 border-b border-brand-sage/10 last:border-0">
            <input
              className={cn(inputCls, 'text-xs')}
              value={claim.text}
              onChange={(e) => {
                const updated = [...draft.claims];
                updated[i] = { ...updated[i], text: e.target.value };
                updateDraftField('claims', updated);
              }}
            />
            <div className="flex gap-2 mt-1">
              {claim.source && (
                <input
                  className={cn(inputCls, 'text-[10px] flex-1')}
                  value={claim.source}
                  placeholder="Source"
                  onChange={(e) => {
                    const updated = [...draft.claims];
                    updated[i] = { ...updated[i], source: e.target.value };
                    updateDraftField('claims', updated);
                  }}
                />
              )}
              {claim.stat && (
                <input
                  className={cn(inputCls, 'text-[10px] flex-1')}
                  value={claim.stat}
                  placeholder="Stat"
                  onChange={(e) => {
                    const updated = [...draft.claims];
                    updated[i] = { ...updated[i], stat: e.target.value };
                    updateDraftField('claims', updated);
                  }}
                />
              )}
            </div>
          </div>
        ))}
      </ReviewSection>

      {/* Compliance Rules */}
      <ReviewSection title={`Compliance Rules (${draft.compliance_rules.length})`}>
        {draft.compliance_rules.map((rule, i) => (
          <div key={i} className="flex items-center gap-2 py-1 border-b border-brand-sage/10 last:border-0">
            <AlertCircle className="h-3 w-3 text-amber-500 shrink-0" />
            <input
              className={cn(inputCls, 'text-xs')}
              value={rule}
              onChange={(e) => {
                const updated = [...draft.compliance_rules];
                updated[i] = e.target.value;
                updateDraftField('compliance_rules', updated);
              }}
            />
            <button
              onClick={() => updateDraftField('compliance_rules', draft.compliance_rules.filter((_, idx) => idx !== i))}
              className="p-1 rounded hover:bg-red-50 text-brand-slate/30 hover:text-red-500 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </ReviewSection>

      {/* Color Palette */}
      <ReviewSection title={`Color Palette (${draft.color_palette.length})`}>
        <ColorPaletteEditor
          palette={draft.color_palette}
          onChange={(v) => updateDraftField('color_palette', v)}
        />
      </ReviewSection>

      {/* Context fields */}
      <ReviewSection title="Product Context">
        <div className="grid grid-cols-2 gap-3">
          <ReviewField
            label="Tagline"
            value={draft.context?.tagline || ''}
            prev={ex?.context?.tagline}
            onChange={(v) => updateDraftContext('tagline', v || undefined)}
          />
          <ReviewField
            label="Category"
            value={draft.context?.product_category || ''}
            prev={ex?.context?.product_category}
            onChange={(v) => updateDraftContext('product_category', v || undefined)}
          />
          <ReviewField
            label="Price"
            value={draft.context?.price || ''}
            prev={ex?.context?.price}
            onChange={(v) => updateDraftContext('price', v || undefined)}
          />
          <ReviewField
            label="Target Audience"
            value={draft.context?.target_audience || ''}
            prev={ex?.context?.target_audience}
            onChange={(v) => updateDraftContext('target_audience', v || undefined)}
          />
          <ReviewField
            label="Website"
            value={draft.context?.website || ''}
            prev={ex?.context?.website}
            onChange={(v) => updateDraftContext('website', v || undefined)}
          />
          <ReviewField
            label="Market Flag"
            value={draft.context?.market_flag || ''}
            prev={ex?.context?.market_flag}
            onChange={(v) => updateDraftContext('market_flag', v || undefined)}
          />
        </div>
      </ReviewSection>

      {/* Benefits */}
      {draft.context?.benefits && draft.context.benefits.length > 0 && (
        <ReviewSection title={`Benefits (${draft.context.benefits.length})`}>
          {draft.context.benefits.map((b, i) => (
            <div key={i} className="flex items-center gap-2 py-1 border-b border-brand-sage/10 last:border-0">
              <span className="text-[10px] font-bold text-brand-teal/60 shrink-0 w-4">{i + 1}</span>
              <input
                className={cn(inputCls, 'text-xs')}
                value={b}
                onChange={(e) => {
                  const updated = [...(draft.context?.benefits || [])];
                  updated[i] = e.target.value;
                  updateDraftContext('benefits', updated);
                }}
              />
              <button
                onClick={() => {
                  const updated = (draft.context?.benefits || []).filter((_, idx) => idx !== i);
                  updateDraftContext('benefits', updated);
                }}
                className="p-1 rounded hover:bg-red-50 text-brand-slate/30 hover:text-red-500 transition-colors"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </ReviewSection>
      )}

      {/* Scene / Mood */}
      <ReviewSection title="Scene & Mood">
        <div className="grid grid-cols-2 gap-3">
          <ReviewField
            label="Surface"
            value={draft.context?.surface || ''}
            prev={ex?.context?.surface}
            onChange={(v) => updateDraftContext('surface', v || undefined)}
          />
          <ReviewField
            label="Setting"
            value={draft.context?.setting || ''}
            prev={ex?.context?.setting}
            onChange={(v) => updateDraftContext('setting', v || undefined)}
          />
          <ReviewField
            label="Mood"
            value={draft.context?.mood || ''}
            prev={ex?.context?.mood}
            onChange={(v) => updateDraftContext('mood', v || undefined)}
          />
          <ReviewField
            label="Timeframe"
            value={draft.context?.timeframe || ''}
            prev={ex?.context?.timeframe}
            onChange={(v) => updateDraftContext('timeframe', v || undefined)}
          />
        </div>
      </ReviewSection>

      {/* Copy */}
      <ReviewSection title="Copy & Headlines">
        <ReviewField
          label="Hero Headline"
          value={draft.context?.hero_headline || ''}
          prev={ex?.context?.hero_headline}
          onChange={(v) => updateDraftContext('hero_headline', v || undefined)}
        />
        <ReviewField
          label="Short Headline"
          value={draft.context?.short_headline || ''}
          prev={ex?.context?.short_headline}
          onChange={(v) => updateDraftContext('short_headline', v || undefined)}
        />
        <ReviewField
          label="CTA"
          value={draft.context?.cta || ''}
          prev={ex?.context?.cta}
          onChange={(v) => updateDraftContext('cta', v || undefined)}
        />
        <ReviewField
          label="Educational Hook"
          value={draft.context?.educational_hook || ''}
          prev={ex?.context?.educational_hook}
          onChange={(v) => updateDraftContext('educational_hook', v || undefined)}
          multiline
        />
      </ReviewSection>

      {/* Social Proof */}
      <ReviewSection title="Social Proof">
        <div className="grid grid-cols-2 gap-3">
          <ReviewField
            label="Review Count"
            value={draft.context?.review_count || ''}
            prev={ex?.context?.review_count}
            onChange={(v) => updateDraftContext('review_count', v || undefined)}
          />
          <ReviewField
            label="Social Proof"
            value={draft.context?.social_proof || ''}
            prev={ex?.context?.social_proof}
            onChange={(v) => updateDraftContext('social_proof', v || undefined)}
          />
        </div>
      </ReviewSection>

      {/* Testimonials */}
      {draft.context?.testimonials && draft.context.testimonials.length > 0 && (
        <ReviewSection title={`Testimonials (${draft.context.testimonials.length})`}>
          {draft.context.testimonials.map((t, i) => (
            <div key={i} className="py-2 border-b border-brand-sage/10 last:border-0 space-y-1.5">
              <div className="flex items-center gap-2">
                <input
                  className={cn(inputCls, 'text-xs font-medium flex-1')}
                  value={t.name}
                  placeholder="Name"
                  onChange={(e) => {
                    const updated = [...(draft.context?.testimonials || [])];
                    updated[i] = { ...updated[i], name: e.target.value };
                    updateDraftContext('testimonials', updated);
                  }}
                />
                <input
                  className={cn(inputCls, 'text-xs w-16')}
                  value={t.age || ''}
                  placeholder="Age"
                  onChange={(e) => {
                    const updated = [...(draft.context?.testimonials || [])];
                    updated[i] = { ...updated[i], age: e.target.value };
                    updateDraftContext('testimonials', updated);
                  }}
                />
                {t.verified && (
                  <span className="text-[9px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                    Verified
                  </span>
                )}
              </div>
              <textarea
                className={cn(textareaCls, 'text-xs')}
                rows={2}
                value={t.quote}
                onChange={(e) => {
                  const updated = [...(draft.context?.testimonials || [])];
                  updated[i] = { ...updated[i], quote: e.target.value };
                  updateDraftContext('testimonials', updated);
                }}
              />
              {t.pull_quote && (
                <input
                  className={cn(inputCls, 'text-[10px] italic')}
                  value={t.pull_quote}
                  placeholder="Pull quote"
                  onChange={(e) => {
                    const updated = [...(draft.context?.testimonials || [])];
                    updated[i] = { ...updated[i], pull_quote: e.target.value };
                    updateDraftContext('testimonials', updated);
                  }}
                />
              )}
            </div>
          ))}
        </ReviewSection>
      )}
    </div>
  );
}

// ─── Shared review primitives ────────────────────────────────────────────────

// ─── Color Palette Editor ────────────────────────────────────────────────────

const USAGE_OPTIONS = ['primary', 'accent', 'contrast', 'tint', 'dark', 'background', 'other'];

function ColorPaletteEditor({
  palette,
  onChange,
}: {
  palette: ColorEntry[];
  onChange: (v: ColorEntry[]) => void;
}) {
  const update = (i: number, patch: Partial<ColorEntry>) => {
    const updated = palette.map((c, idx) => idx === i ? { ...c, ...patch } : c);
    onChange(updated);
  };
  const remove = (i: number) => onChange(palette.filter((_, idx) => idx !== i));
  const add = () => onChange([...palette, { name: '', hex: '#888888', usage: 'accent' }]);

  return (
    <div className="space-y-2">
      {palette.length === 0 && (
        <p className="text-[11px] text-brand-slate/50 italic px-1">No colors extracted — add manually below.</p>
      )}

      {palette.map((color, i) => (
        <div key={i} className="flex items-center gap-2 p-2 bg-brand-cream/40 rounded-lg border border-brand-sage/15">
          {/* Color picker swatch */}
          <div className="relative shrink-0">
            <div
              className="w-9 h-9 rounded-lg border-2 border-white shadow-sm cursor-pointer overflow-hidden"
              style={{ backgroundColor: color.hex }}
            >
              <input
                type="color"
                value={color.hex}
                onChange={(e) => update(i, { hex: e.target.value })}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                title="Pick color"
              />
            </div>
          </div>

          <div className="flex-1 min-w-0 grid grid-cols-3 gap-1.5">
            {/* Name */}
            <input
              className={cn(inputCls, 'text-xs col-span-1')}
              value={color.name}
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder="Color name"
            />
            {/* Hex */}
            <input
              className={cn(inputCls, 'text-xs font-mono col-span-1')}
              value={color.hex}
              onChange={(e) => {
                const v = e.target.value;
                if (/^#[0-9a-fA-F]{0,6}$/.test(v)) update(i, { hex: v });
              }}
              placeholder="#000000"
              maxLength={7}
            />
            {/* Usage */}
            <select
              className={cn(inputCls, 'text-xs col-span-1 cursor-pointer')}
              value={color.usage || 'other'}
              onChange={(e) => update(i, { usage: e.target.value })}
            >
              {USAGE_OPTIONS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => remove(i)}
            className="p-1.5 rounded-lg hover:bg-red-50 text-brand-slate/30 hover:text-red-500 transition-colors shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      {/* Add color */}
      <button
        onClick={add}
        className="flex items-center gap-1.5 text-xs text-brand-teal hover:text-brand-forest transition-colors mt-1"
      >
        <Plus className="h-3 w-3" /> Add color
      </button>
    </div>
  );
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-brand-sage/15 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-brand-cream/40 hover:bg-brand-cream/60 transition-colors"
      >
        <span className="text-xs font-semibold text-brand-forest">{title}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 text-brand-sage/50 transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="px-4 py-3 space-y-2">{children}</div>}
    </div>
  );
}

function ReviewField({
  label, value, prev, onChange, multiline,
}: {
  label: string;
  value: string;
  prev?: string | null;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  const Tag = multiline ? 'textarea' : 'input';
  const p = (prev ?? '').trim();
  const c = (value ?? '').trim();
  const canRestore = prev !== undefined && p && p !== c;

  return (
    <div>
      <div className="flex items-center mb-1">
        <span className="text-[10px] font-medium text-brand-sage/70">{label}</span>
        {prev !== undefined && (
          <DiffBadge
            prev={prev}
            curr={value}
            onRestore={canRestore ? () => onChange(prev || '') : undefined}
          />
        )}
      </div>
      {prev !== undefined && <PrevValue value={prev} />}
      <Tag
        className={cn(multiline ? textareaCls : inputCls, 'text-xs')}
        value={value}
        onChange={(e: any) => onChange(e.target.value)}
        {...(multiline ? { rows: 3 } : {})}
      />
    </div>
  );
}

