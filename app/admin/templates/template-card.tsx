'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import {
  Pencil, Trash2, X, ChevronLeft, ChevronRight,
  Check, Loader2, Images,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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

interface TemplateCardProps {
  template: PromptTemplate;
  /** First 2 completed image URLs pre-fetched on the server */
  previewImages: TemplateImage[];
  /** Total count of completed images for this template */
  imageCount: number;
  animationDelay?: string;
}

const ASPECT_RATIOS = ['1:1', '4:5', '9:16', '16:9', '3:4'] as const;

// ─── Gallery Modal ────────────────────────────────────────────────────────────

function GalleryModal({
  templateId,
  templateName,
  onClose,
}: {
  templateId: string;
  templateName: string;
  onClose: () => void;
}) {
  const [images, setImages]     = useState<TemplateImage[]>([]);
  const [loading, setLoading]   = useState(true);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [mounted, setMounted]   = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    fetch(`/api/admin/templates/${templateId}/images`)
      .then((r) => r.json())
      .then((data) => { setImages(Array.isArray(data) ? data : []); })
      .finally(() => setLoading(false));
  }, [templateId]);

  const prev = useCallback(() => {
    setLightbox((i) => (i !== null && i > 0 ? i - 1 : i));
  }, []);
  const next = useCallback(() => {
    setLightbox((i) => (i !== null && i < images.length - 1 ? i + 1 : i));
  }, [images.length]);

  useEffect(() => {
    if (lightbox === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  prev();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'Escape')     setLightbox(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightbox, prev, next]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && lightbox === null) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightbox, onClose]);

  if (!mounted) return null;

  return createPortal(
    <>
      {/* ── Gallery backdrop ── */}
      <div
        className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b border-white/10 px-6 py-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div>
            <h2 className="text-lg font-semibold text-white">{templateName}</h2>
            <p className="text-sm text-white/50">
              {loading ? 'Loading…' : `${images.length} image${images.length !== 1 ? 's' : ''} generated from this template`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Image grid */}
        <div
          className="flex-1 overflow-y-auto p-6"
          onClick={(e) => e.stopPropagation()}
        >
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-white/50" />
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
                  className="group relative overflow-hidden rounded-lg bg-white/5 ring-1 ring-white/10 transition hover:ring-2 hover:ring-brand-teal/50"
                  style={{ aspectRatio: aspectToCSS(img.aspect_ratio) }}
                  onClick={() => setLightbox(idx)}
                >
                  <Image
                    src={img.image_url}
                    alt={`Generated image ${idx + 1}`}
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

      {/* ── Lightbox ── */}
      {lightbox !== null && images[lightbox] && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95"
          onClick={() => setLightbox(null)}
        >
          {/* Close */}
          <button
            className="absolute right-4 top-4 rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white"
            onClick={() => setLightbox(null)}
          >
            <X className="h-5 w-5" />
          </button>

          {/* Prev */}
          {lightbox > 0 && (
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
              onClick={(e) => { e.stopPropagation(); prev(); }}
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          {/* Image */}
          <div
            className="relative max-h-[85vh] max-w-[85vw]"
            style={{ aspectRatio: aspectToCSS(images[lightbox].aspect_ratio) }}
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={images[lightbox].image_url}
              alt="Generated image"
              fill
              className="rounded-lg object-contain"
              sizes="85vw"
            />
          </div>

          {/* Next */}
          {lightbox < images.length - 1 && (
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
              onClick={(e) => { e.stopPropagation(); next(); }}
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}

          {/* Counter */}
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white/70">
            {lightbox + 1} / {images.length}
          </p>
        </div>
      )}
    </>,
    document.body,
  );
}

function aspectToCSS(ratio: string): string {
  const map: Record<string, string> = {
    '1:1':  '1 / 1',
    '4:5':  '4 / 5',
    '9:16': '9 / 16',
    '16:9': '16 / 9',
    '3:4':  '3 / 4',
  };
  return map[ratio] ?? '1 / 1';
}

// ─── Thumbnail Strip ──────────────────────────────────────────────────────────

function ThumbnailStrip({
  previewImages,
  imageCount,
  onOpen,
}: {
  previewImages: TemplateImage[];
  imageCount: number;
  onOpen: () => void;
}) {
  const overflow = imageCount - previewImages.length;

  if (imageCount === 0) {
    return (
      <button
        onClick={onOpen}
        className="flex items-center gap-2 rounded-md border border-dashed border-brand-teal/15 px-3 py-2 text-xs text-gray-400 transition hover:border-brand-teal/30 hover:text-brand-teal"
      >
        <Images className="h-3.5 w-3.5" />
        No images generated yet
      </button>
    );
  }

  return (
    <button
      onClick={onOpen}
      className="group flex items-center gap-2 rounded-md border border-brand-teal/15 bg-brand-cream/30 px-3 py-2 transition hover:border-brand-teal/30 hover:bg-brand-cream/60"
    >
      {/* Thumbnails */}
      <div className="flex -space-x-1">
        {previewImages.map((img) => (
          <div
            key={img.id}
            className="relative h-8 w-8 overflow-hidden rounded ring-2 ring-white"
          >
            <Image
              src={img.image_url}
              alt=""
              fill
              className="object-cover"
              sizes="32px"
            />
          </div>
        ))}
      </div>

      {/* Count label */}
      <span className="text-xs font-medium text-brand-slate group-hover:text-brand-teal">
        {imageCount === 1
          ? '1 image generated'
          : overflow > 0
            ? `+${overflow} more · ${imageCount} total`
            : `${imageCount} images`}
      </span>

      {/* Chevron hint */}
      <ChevronRight className="ml-auto h-3.5 w-3.5 text-brand-teal/40 group-hover:text-brand-teal/70" />
    </button>
  );
}

// ─── Edit Form ────────────────────────────────────────────────────────────────

function EditForm({
  template,
  onSave,
  onCancel,
}: {
  template: PromptTemplate;
  onSave: (updated: PromptTemplate) => void;
  onCancel: () => void;
}) {
  const [name,          setName]          = useState(template.name);
  const [category,      setCategory]      = useState(template.category);
  const [templateText,  setTemplateText]  = useState(template.template);
  const [aspectRatio,   setAspectRatio]   = useState(template.default_aspect_ratio);
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState<string | null>(null);

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
        body: JSON.stringify({
          name: name.trim(),
          category: category.trim(),
          template: templateText.trim(),
          default_aspect_ratio: aspectRatio,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Save failed');
      }
      const updated = await res.json();
      onSave(updated);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-brand-teal/20 bg-brand-cream/30 p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-brand-slate">Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Template name"
            className="text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-brand-slate">Category</label>
          <Input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. lifestyle, product, ugc"
            className="text-sm"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-brand-slate">Default Aspect Ratio</label>
        <div className="flex gap-2">
          {ASPECT_RATIOS.map((r) => (
            <button
              key={r}
              onClick={() => setAspectRatio(r)}
              className={cn(
                'rounded-md border px-3 py-1 text-xs font-medium transition',
                aspectRatio === r
                  ? 'border-brand-teal bg-brand-teal text-white'
                  : 'border-brand-teal/20 text-brand-slate hover:border-brand-teal/40',
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-brand-slate">Template Prompt</label>
        <Textarea
          value={templateText}
          onChange={(e) => setTemplateText(e.target.value)}
          rows={6}
          className="font-mono text-xs"
          placeholder="Template text…"
        />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
          Save
        </Button>
      </div>
    </div>
  );
}

// ─── Template Card ────────────────────────────────────────────────────────────

export function TemplateCard({
  template: initialTemplate,
  previewImages,
  imageCount,
  animationDelay,
}: TemplateCardProps) {
  const router = useRouter();

  const [template,       setTemplate]       = useState(initialTemplate);
  const [editing,        setEditing]        = useState(false);
  const [confirmDelete,  setConfirmDelete]  = useState(false);
  const [deleting,       setDeleting]       = useState(false);
  const [showGallery,    setShowGallery]    = useState(false);

  const handleSave = (updated: PromptTemplate) => {
    setTemplate(updated);
    setEditing(false);
    router.refresh();
  };

  const handleDelete = async () => {
    setDeleting(true);
    await fetch(`/api/admin/templates/${template.id}`, { method: 'DELETE' });
    router.refresh();
    setDeleting(false);
    setConfirmDelete(false);
  };

  return (
    <>
      <div
        className="stagger-item rounded-xl border border-brand-teal/10 bg-white p-5 shadow-sm"
        style={animationDelay ? { animationDelay } : undefined}
      >
        {/* ── Header row ── */}
        <div className="flex items-start gap-3">
          {/* Number badge */}
          <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-teal/10 text-sm font-bold text-brand-teal">
            {template.number}
          </span>

          {/* Title + badges */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-brand-teal">{template.name}</span>
              <Badge variant="secondary" className="text-xs">{template.category}</Badge>
              <Badge variant="outline" className="text-xs">{template.default_aspect_ratio}</Badge>
              <Badge variant="outline" className="text-xs text-gray-400">v{template.version}</Badge>
            </div>

            {/* Template text preview */}
            <p className="mt-1.5 line-clamp-3 font-mono text-xs leading-relaxed text-gray-500">
              {template.template}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-shrink-0 items-center gap-1">
            {confirmDelete ? (
              <>
                <span className="mr-1 text-xs text-red-500">Delete?</span>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="h-7 px-2 text-xs"
                >
                  {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Yes, delete'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className="h-7 px-2 text-xs"
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setEditing((v) => !v); setConfirmDelete(false); }}
                  className="h-7 w-7 p-0"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setConfirmDelete(true); setEditing(false); }}
                  className="h-7 w-7 p-0 text-red-400 hover:border-red-300 hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* ── Inline edit form ── */}
        {editing && (
          <EditForm
            template={template}
            onSave={handleSave}
            onCancel={() => setEditing(false)}
          />
        )}

        {/* ── Thumbnail strip ── */}
        {!editing && (
          <div className="mt-4 border-t border-brand-teal/5 pt-3">
            <ThumbnailStrip
              previewImages={previewImages}
              imageCount={imageCount}
              onOpen={() => setShowGallery(true)}
            />
          </div>
        )}
      </div>

      {/* ── Gallery modal (portal) ── */}
      {showGallery && (
        <GalleryModal
          templateId={template.id}
          templateName={`#${template.number} · ${template.name}`}
          onClose={() => setShowGallery(false)}
        />
      )}
    </>
  );
}
