'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import {
  Pencil, Trash2, X, ChevronLeft, ChevronRight,
  Check, Loader2, Images, AlertTriangle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
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
  const [mounted,      setMounted]      = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

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

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ animation: 'overlayIn 0.2s ease forwards', backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]"
        style={{ animation: 'modalIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-brand-sage/20 px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-brand-lime">#{template.number}</span>
              <h2 className="text-base font-semibold text-brand-black">{template.name}</h2>
              <Badge variant="secondary" className="text-[10px]">{template.category}</Badge>
            </div>
            <p className="text-xs text-brand-slate mt-0.5">System-level edit — changes apply to all future generations</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-brand-slate hover:bg-brand-cream hover:text-brand-forest">
            <X className="h-4 w-4" />
          </button>
        </div>

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

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-brand-sage/20 px-6 py-4">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="bg-brand-forest hover:bg-brand-forest/90">
            {saving
              ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Saving…</>
              : <><Check className="mr-1.5 h-3.5 w-3.5" />Save changes</>
            }
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Main grid ────────────────────────────────────────────────────────────────

export function AdminTemplateGrid({
  templates:        initialTemplates,
  imagesByTemplate: initialImagesByTemplate,
  countByTemplate,
}: AdminTemplateGridProps) {
  const router = useRouter();

  const [templates,        setTemplates]        = useState(initialTemplates);
  const [imagesByTemplate, setImagesByTemplate] = useState(initialImagesByTemplate);
  const [categoryFilter,   setCategoryFilter]   = useState('All');
  const [editingId,        setEditingId]        = useState<string | null>(null);
  const [confirmDeleteId,  setConfirmDeleteId]  = useState<string | null>(null);
  const [deleting,         setDeleting]         = useState(false);
  const [galleryId,        setGalleryId]        = useState<string | null>(null);

  const filtered = categoryFilter === 'All'
    ? templates
    : templates.filter((t) => t.category === categoryFilter);

  const handleSave = (updated: PromptTemplate) => {
    setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setEditingId(null);
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    await fetch(`/api/admin/templates/${id}`, { method: 'DELETE' });
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    setConfirmDeleteId(null);
    setDeleting(false);
    router.refresh();
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
        <span className="ml-auto text-xs text-brand-slate">
          {filtered.length} template{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((template) => {
          const previewImages   = (imagesByTemplate[template.id] || []).slice(0, 2);
          const imageCount      = countByTemplate[template.id] ?? 0;
          const overflow        = imageCount - previewImages.length;
          const isConfirmDelete = confirmDeleteId === template.id;
          const showPlaceholder = hasPlaceholders(template.template);

          return (
            <div
              key={template.id}
              className="template-card group relative rounded-xl border border-brand-sage/30 bg-white p-4 hover:border-brand-forest/40 hover:shadow-md transition-[border-color,box-shadow]"
            >
              {/* Admin action buttons — top right */}
              <div className="absolute right-3 top-3 flex items-center gap-1">
                {isConfirmDelete ? (
                  <>
                    <span className="mr-1 text-[10px] text-red-500 font-medium">Delete?</span>
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
                      title="Delete template"
                      className="rounded-md p-1 text-brand-slate opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition-opacity"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>

              {/* Number + Name */}
              <div className="pr-16 mb-2">
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

              {/* Generated images strip */}
              <div className="border-t border-brand-sage/20 pt-3">
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
                    {/* Thumbnails */}
                    <div className="flex -space-x-1.5">
                      {previewImages.map((img) => (
                        <div key={img.id} className="relative h-7 w-7 overflow-hidden rounded-md ring-2 ring-white shrink-0">
                          <Image src={img.image_url} alt="" fill className="object-cover" sizes="28px" />
                        </div>
                      ))}
                    </div>
                    {/* Count label */}
                    <span className="text-[10px] font-medium text-brand-slate group-hover/strip:text-brand-forest transition-colors">
                      {overflow > 0
                        ? `+${overflow} more · ${imageCount} total`
                        : `${imageCount} image${imageCount !== 1 ? 's' : ''} generated`}
                    </span>
                    <ChevronRight className="h-3 w-3 text-brand-slate/40 group-hover/strip:text-brand-forest/60 ml-auto transition-colors" />
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
    </>
  );
}
