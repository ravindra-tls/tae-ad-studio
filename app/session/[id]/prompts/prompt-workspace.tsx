'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, Pencil, X, Check, RefreshCcw, AlertTriangle, ImagePlus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Breadcrumb } from '@/components/Breadcrumb';
import { cn } from '@/lib/utils';
import { fillTemplate } from '@/lib/prompt-assembler';
import { LoadingExperience } from '@/components/LoadingExperience';
import type { Product, PromptTemplate, ProductImage, Session } from '@/types';

interface PromptWorkspaceProps {
  session: Session;
  product: Product;
  templates: PromptTemplate[];
  referenceImages: ProductImage[];
  remainingCredits: number;
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

const ASPECT_RATIOS = [
  { value: '1:1',  label: '1:1 — Square' },
  { value: '4:5',  label: '4:5 — Portrait' },
  { value: '9:16', label: '9:16 — Story' },
  { value: '16:9', label: '16:9 — Landscape' },
  { value: '3:4',  label: '3:4 — Classic' },
];

export function PromptWorkspace({
  session,
  product,
  templates,
  referenceImages,
  remainingCredits,
}: PromptWorkspaceProps) {
  const [selectedIds, setSelectedIds]       = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [isSubmitting, setIsSubmitting]     = useState(false);
  const [generateComplete, setGenerateComplete] = useState(false);
  const [pendingNavUrl, setPendingNavUrl]   = useState<string | null>(null);

  // Per-template overrides (persisted for the session)
  const [editedPrompts, setEditedPrompts]   = useState<Record<string, string>>({});
  const [editedRatios,  setEditedRatios]    = useState<Record<string, string>>({});

  // Edit modal state
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [modalPrompt,     setModalPrompt]     = useState('');
  const [modalRatio,      setModalRatio]      = useState('');

  // Placeholder review panel state
  const [showPlaceholderReview, setShowPlaceholderReview] = useState(false);

  // Session-level uploaded reference images (from product selection step)
  const [sessionRefImages, setSessionRefImages] = useState<{ id: string; dataUrl: string; name: string }[]>([]);

  // Per-template reference images (data URLs stored client-side)
  type RefImage = { id: string; dataUrl: string; name: string };
  const [templateImages, setTemplateImages] = useState<Record<string, RefImage[]>>({});
  const modalFileRef = useRef<HTMLInputElement>(null);
  const sessionFileRef = useRef<HTMLInputElement>(null);

  const addImagesToTemplate = useCallback((templateId: string, files: FileList) => {
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img: RefImage = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          dataUrl: reader.result as string,
          name: file.name,
        };
        setTemplateImages((prev) => ({
          ...prev,
          [templateId]: [...(prev[templateId] || []), img],
        }));
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const removeImageFromTemplate = useCallback((templateId: string, imageId: string) => {
    setTemplateImages((prev) => ({
      ...prev,
      [templateId]: (prev[templateId] || []).filter((img) => img.id !== imageId),
    }));
  }, []);

  const addSessionImages = useCallback((files: FileList) => {
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setSessionRefImages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            dataUrl: reader.result as string,
            name: file.name,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const removeSessionImage = useCallback((id: string) => {
    setSessionRefImages((prev) => prev.filter((img) => img.id !== id));
  }, []);

  const router = useRouter();

  /* ── helpers ── */
  const PLACEHOLDER_RE = /\[[A-Z][A-Z0-9 _/—–\-\+\.',:!?()&]+\]/g;

  const getPrompt = (t: PromptTemplate) =>
    editedPrompts[t.id] ?? fillTemplate(t.template, product);

  /** Find unresolved placeholders in a resolved prompt string */
  const findPlaceholders = (text: string): string[] => {
    const matches = text.match(PLACEHOLDER_RE);
    return matches ? [...new Set(matches)] : [];
  };

  /** Templates with unresolved placeholders among selected templates */
  const templatesWithPlaceholders = templates
    .filter((t) => selectedIds.has(t.id))
    .map((t) => ({ template: t, placeholders: findPlaceholders(getPrompt(t)) }))
    .filter((entry) => entry.placeholders.length > 0);
  const getRatio = (t: PromptTemplate) =>
    editedRatios[t.id] ?? t.default_aspect_ratio;

  /** Effective reference images for a template: per-template overrides > session uploads */
  const getEffectiveImages = (templateId: string): RefImage[] => {
    const perTemplate = templateImages[templateId];
    if (perTemplate && perTemplate.length > 0) return perTemplate;
    return sessionRefImages;
  };

  const filtered =
    categoryFilter === 'All'
      ? templates
      : templates.filter((t) => t.category === categoryFilter);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filtered.map((t) => t.id)));
  }, [filtered]);

  const clearAll = useCallback(() => setSelectedIds(new Set()), []);

  /* ── edit modal open / save / close ── */
  const openEdit = (e: React.MouseEvent, template: PromptTemplate) => {
    e.stopPropagation();
    setModalPrompt(getPrompt(template));
    setModalRatio(getRatio(template));
    // If no per-template images yet but session images exist, seed them so user can manage individually
    if (!(templateImages[template.id]?.length > 0) && sessionRefImages.length > 0) {
      setTemplateImages((prev) => ({
        ...prev,
        [template.id]: [...sessionRefImages],
      }));
    }
    setEditingTemplate(template); // mount last — triggers entrance animation immediately
  };

  const closeModal = useCallback(() => {
    setEditingTemplate(null); // unmount directly — no exit animation needed
  }, []);

  const saveEdit = () => {
    if (!editingTemplate) return;
    setEditedPrompts((p) => ({ ...p, [editingTemplate.id]: modalPrompt }));
    setEditedRatios((r)  => ({ ...r, [editingTemplate.id]: modalRatio  }));
    closeModal();
  };

  // Load session-level reference images from sessionStorage (uploaded during product selection)
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(`ref-images-${session.id}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSessionRefImages(parsed);
        }
        sessionStorage.removeItem(`ref-images-${session.id}`);
      }
    } catch { /* ignore parse errors */ }
  }, [session.id]);

  // Lock body scroll + Escape to close for any modal
  useEffect(() => {
    const anyOpen = !!editingTemplate || showPlaceholderReview;
    if (!anyOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingTemplate) closeModal();
        if (showPlaceholderReview) setShowPlaceholderReview(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [editingTemplate, showPlaceholderReview, closeModal]);

  /* ── generate ── */
  const selectedTemplates = templates.filter((t) => selectedIds.has(t.id));

  const handleGenerate = useCallback(async () => {
    if (selectedTemplates.length === 0 || isSubmitting) return;

    // Block if any selected template has unresolved placeholders
    if (templatesWithPlaceholders.length > 0) {
      setShowPlaceholderReview(true);
      return;
    }

    setIsSubmitting(true);
    const MIN_DISPLAY_MS = 6000; // keep loading screen for at least 6 seconds
    const startedAt = Date.now();

    try {
      const jobs = selectedTemplates.map((t) => {
        // Priority: per-template images > session uploads > product-level reference images
        const perTemplateImgs = templateImages[t.id]?.map((img) => img.dataUrl) || [];
        const sessionImgUrls = sessionRefImages.map((img) => img.dataUrl);
        const productImgUrls = referenceImages.map((img) => img.url);
        const refUrls = perTemplateImgs.length > 0
          ? perTemplateImgs
          : sessionImgUrls.length > 0
            ? sessionImgUrls
            : productImgUrls;
        return {
          templateId:  t.id,
          prompt:      getPrompt(t),
          aspectRatio: getRatio(t),
          refUrls,
        };
      });

      let navigateTo = '';

      if (jobs.length === 1) {
        const res = await fetch('/api/generate/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId:          session.id,
            productId:          product.id,
            prompt:             jobs[0].prompt,
            aspectRatio:        jobs[0].aspectRatio,
            referenceImageUrls: jobs[0].refUrls,
          }),
        });
        const data = await res.json();
        if (data.generatedImageId)
          navigateTo = `/session/${session.id}/generate?imageId=${data.generatedImageId}`;
      } else {
        await Promise.all(
          jobs.map((job) =>
            fetch('/api/generate/submit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sessionId:          session.id,
                productId:          product.id,
                prompt:             job.prompt,
                aspectRatio:        job.aspectRatio,
                referenceImageUrls: job.refUrls,
              }),
            })
          )
        );
        navigateTo = `/session/${session.id}/results`;
      }

      // Ensure the loading screen stays visible for the minimum display time
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_DISPLAY_MS) {
        await new Promise((r) => setTimeout(r, MIN_DISPLAY_MS - elapsed));
      }

      // Signal completion — LoadingExperience will animate to 100% then call onExitComplete
      if (navigateTo) {
        setPendingNavUrl(navigateTo);
        setGenerateComplete(true);
      }
    } catch (err) {
      console.error('Generation failed:', err);
      // Still honour minimum display on error
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_DISPLAY_MS) {
        await new Promise((r) => setTimeout(r, MIN_DISPLAY_MS - elapsed));
      }
      setIsSubmitting(false);
      setGenerateComplete(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplates, session.id, product, referenceImages, router, isSubmitting, templatesWithPlaceholders]);

  /* ── render ── */
  return (
    // Fragment — fixed children (modal + sticky bar) must be siblings of the
    // animated div, NOT inside it. animate-fade-in uses transform in its
    // keyframe; even transform:translateY(0) in fill-mode creates a CSS
    // stacking context, which makes position:fixed children anchor to that
    // element instead of the viewport.
    <>
    <div className="animate-fade-in pb-24">

      <Breadcrumb
        crumbs={[
          { label: session.name, href: `/session/${session.id}/prompts` },
          { label: 'Select Templates' },
        ]}
        actions={
          <>
            <Link
              href="/session/new"
              className="filter-pill flex items-center gap-1.5 rounded-md border border-brand-sage/30 bg-white px-2.5 py-1 text-brand-slate hover:border-brand-forest/40 hover:text-brand-forest hover:bg-brand-cream"
            >
              <RefreshCcw className="h-3 w-3" />
              Change product
            </Link>
            <Link
              href={`/session/${session.id}/results`}
              className="filter-pill flex items-center gap-1.5 rounded-md border border-brand-sage/30 bg-white px-2.5 py-1 text-brand-slate hover:border-brand-forest/40 hover:text-brand-forest hover:bg-brand-cream"
            >
              View results
            </Link>
          </>
        }
      />

      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-brand-forest">{session.name}</h1>
        <p className="text-sm text-brand-slate mt-0.5">
          {product.name} — Select templates to generate
        </p>

        {/* Session reference images strip */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {/* Hidden file input */}
          <input
            ref={sessionFileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) addSessionImages(e.target.files);
              if (sessionFileRef.current) sessionFileRef.current.value = '';
            }}
          />

          {/* Thumbnail images */}
          {sessionRefImages.map((img) => (
            <div key={img.id} className="group/simg relative">
              <img
                src={img.dataUrl}
                alt={img.name}
                title={img.name}
                className="h-10 w-10 rounded-lg border border-brand-sage/30 object-cover shadow-sm"
              />
              <button
                type="button"
                onClick={() => removeSessionImage(img.id)}
                className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-brand-wine text-white flex items-center justify-center opacity-0 group-hover/simg:opacity-100 transition-opacity duration-150 shadow-sm"
                title="Remove image"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}

          {/* Add button */}
          <button
            type="button"
            onClick={() => sessionFileRef.current?.click()}
            className="filter-pill flex items-center gap-1.5 rounded-lg border border-dashed border-brand-sage/40 px-3 py-2 text-xs text-brand-slate hover:border-brand-forest/40 hover:text-brand-forest hover:bg-brand-cream/40 transition-colors"
          >
            <ImagePlus className="h-3.5 w-3.5" />
            {sessionRefImages.length > 0 ? 'Add more' : 'Add reference images'}
          </button>

          {sessionRefImages.length > 0 && (
            <span className="text-[10px] text-brand-slate/60">
              {sessionRefImages.length} image{sessionRefImages.length > 1 ? 's' : ''} — applied to all templates by default
            </span>
          )}
        </div>
      </div>

      {/* Category filter + select controls */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={cn(
              'filter-pill rounded-full px-3 py-1 text-xs font-medium',
              categoryFilter === cat
                ? 'bg-brand-forest text-white shadow-sm'
                : 'border border-brand-sage/40 bg-white text-brand-slate hover:border-brand-forest/50 hover:text-brand-forest hover:shadow-sm'
            )}
          >
            {cat}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-3 text-xs text-brand-slate">
          <button
            onClick={selectAll}
            className="filter-pill rounded px-2 py-1 font-medium hover:text-brand-forest hover:bg-brand-cream"
          >
            Select all
          </button>
          <span className="text-brand-sage">·</span>
          <button
            onClick={clearAll}
            className="filter-pill rounded px-2 py-1 font-medium hover:text-brand-forest hover:bg-brand-cream"
          >
            Clear
          </button>
          {selectedIds.size > 0 && (
            <span
              key={selectedIds.size}
              className="animate-badge-pop font-semibold text-brand-forest"
            >
              {selectedIds.size} selected
            </span>
          )}
        </div>
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((template) => {
          const isSelected      = selectedIds.has(template.id);
          const isEdited        = !!editedPrompts[template.id];
          const preview         = getPrompt(template);
          const hasPlaceholders = findPlaceholders(preview).length > 0;

          return (
            <div
              key={template.id}
              onClick={() => toggleSelect(template.id)}
              className={cn(
                'template-card group relative cursor-pointer rounded-xl border bg-white p-4 select-none',
                isSelected
                  ? 'border-brand-forest shadow-[0_0_0_3px_rgba(26,81,41,0.15),0_4px_16px_rgba(26,81,41,0.12)]'
                  : 'border-brand-sage/30 hover:border-brand-forest/40 hover:shadow-md'
              )}
            >
              {/* Checkbox */}
              <div
                className={cn(
                  'checkbox-box absolute right-3 top-3 h-5 w-5 rounded border-2',
                  'flex items-center justify-center flex-shrink-0',
                  isSelected
                    ? 'bg-brand-forest border-brand-forest shadow-[0_2px_8px_rgba(26,81,41,0.35)]'
                    : 'border-brand-sage/60 bg-white'
                )}
              >
                {isSelected && (
                  <svg viewBox="0 0 10 8" className="h-2.5 w-2.5" fill="none" overflow="visible">
                    <path
                      d="M1 4l3 3 5-6"
                      stroke="white"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="animate-checkmark"
                    />
                  </svg>
                )}
              </div>

              {/* Number + name */}
              <div className="pr-8 mb-2">
                <span className="text-[11px] font-bold text-brand-lime mr-1">#{template.number}</span>
                <h3 className="text-sm font-semibold text-brand-black leading-snug">
                  {template.name}
                </h3>
              </div>

              {/* Category + ratio + edited badge */}
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                  {template.category}
                </Badge>
                <span className="text-[10px] font-medium text-brand-slate bg-brand-cream px-1.5 py-0.5 rounded">
                  {getRatio(template)}
                </span>
                {hasPlaceholders && (
                  <span className="animate-badge-pop text-[10px] font-medium text-amber-700 bg-amber-100 border border-amber-300/60 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                    <AlertTriangle className="h-2.5 w-2.5" /> placeholders
                  </span>
                )}
                {isEdited && (
                  <span className="animate-badge-pop text-[10px] font-medium text-brand-green bg-brand-lime/20 px-1.5 py-0.5 rounded">
                    edited
                  </span>
                )}
              </div>

              {/* Prompt preview */}
              <p className="text-[11px] text-brand-slate font-mono leading-relaxed line-clamp-4 mb-8">
                {preview}
              </p>

              {/* Bottom row — image thumbnails + edit button, shown on hover */}
              {(() => {
                const imgs = getEffectiveImages(template.id);
                const hasImgs = imgs.length > 0;
                return (
                  <div
                    className="absolute bottom-3 left-3 right-3 flex items-center gap-1.5 opacity-0 translate-y-3 group-hover:opacity-100 group-hover:translate-y-0 transition-[opacity,transform] duration-[350ms]"
                    style={{ transitionTimingFunction: 'var(--spring-soft, cubic-bezier(0.34, 1.56, 0.64, 1))' }}
                  >
                    {/* Image thumbnails */}
                    {hasImgs && (
                      <div className="flex items-center gap-1 flex-1 min-w-0 overflow-hidden">
                        {imgs.slice(0, 3).map((img) => (
                          <img
                            key={img.id}
                            src={img.dataUrl}
                            alt={img.name}
                            title={img.name}
                            className="h-6 w-6 rounded border border-brand-sage/30 object-cover shrink-0"
                          />
                        ))}
                        {imgs.length > 3 && (
                          <span className="text-[9px] font-medium text-brand-slate bg-brand-cream rounded px-1">
                            +{imgs.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                    {/* Spacer if no images */}
                    {!hasImgs && <div className="flex-1" />}
                    {/* Edit button */}
                    <button
                      onClick={(e) => openEdit(e, template)}
                      title="Edit prompt"
                      className={cn(
                        'edit-btn shrink-0 flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium border bg-white',
                        isEdited
                          ? 'border-brand-green/50 text-brand-green bg-brand-lime/10'
                          : 'border-brand-sage/30 text-brand-slate hover:border-brand-forest/50 hover:text-brand-forest hover:bg-brand-cream'
                      )}
                    >
                      <Pencil className="h-3 w-3" />
                      Edit
                    </button>
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

    </div>{/* end animate-fade-in — fixed children must live OUTSIDE this div */}

      {/* ── Edit modal ── */}
      {editingTemplate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{
            animation: 'overlayIn 0.2s ease forwards',
            backgroundColor: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
          onClick={closeModal}
        >
          <div
            className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]"
            style={{ animation: 'modalIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-start justify-between border-b border-brand-sage/20 px-6 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-brand-lime">#{editingTemplate.number}</span>
                  <h2 className="text-base font-semibold text-brand-black">{editingTemplate.name}</h2>
                  <Badge variant="secondary" className="text-[10px]">{editingTemplate.category}</Badge>
                </div>
                <p className="text-xs text-brand-slate mt-0.5">
                  Editing prompt — changes apply to this session only
                </p>
              </div>
              <button
                onClick={closeModal}
                className="rounded-lg p-1.5 text-brand-slate hover:bg-brand-cream hover:text-brand-forest"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto scroll-spring px-6 py-4 space-y-4">
              <textarea
                value={modalPrompt}
                onChange={(e) => setModalPrompt(e.target.value)}
                rows={12}
                style={{ transition: 'border-color 150ms var(--spring), box-shadow 150ms var(--smooth)' }}
                className="w-full resize-none rounded-lg border border-brand-sage/30 bg-brand-cream/30 px-3 py-2.5 font-mono text-xs leading-relaxed text-brand-navy focus:border-brand-forest focus:outline-none focus:ring-2 focus:ring-brand-forest/20"
                placeholder="Edit your prompt…"
              />

              {/* Reference images — per-template */}
              <div className="rounded-lg border border-brand-sage/20 bg-white overflow-hidden">
                <div className="flex items-center justify-between border-b border-brand-sage/20 px-3 py-2">
                  <span className="text-xs font-medium text-brand-forest">Reference Images</span>
                  <span className="text-[10px] text-brand-slate">
                    {getEffectiveImages(editingTemplate.id).length} attached
                  </span>
                </div>
                <div className="px-3 py-3">
                  {/* Existing images */}
                  {(templateImages[editingTemplate.id] || []).length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {(templateImages[editingTemplate.id] || []).map((img) => (
                        <div key={img.id} className="group/img relative">
                          <img
                            src={img.dataUrl}
                            alt={img.name}
                            title={img.name}
                            className="h-16 w-16 rounded-lg border border-brand-sage/30 object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeImageFromTemplate(editingTemplate.id, img.id)}
                            className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-brand-wine text-white flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity duration-100 shadow-sm"
                            title="Remove image"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Upload button */}
                  <input
                    ref={modalFileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.length && editingTemplate) {
                        addImagesToTemplate(editingTemplate.id, e.target.files);
                      }
                      if (modalFileRef.current) modalFileRef.current.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => modalFileRef.current?.click()}
                    className="filter-pill flex items-center gap-1.5 rounded-lg border border-dashed border-brand-sage/40 px-3 py-2 text-xs text-brand-slate hover:border-brand-forest/40 hover:text-brand-forest hover:bg-brand-cream/40 w-full justify-center"
                  >
                    <ImagePlus className="h-3.5 w-3.5" />
                    Add reference images
                  </button>
                  <p className="text-[10px] text-brand-slate/60 mt-1.5 text-center">
                    Optional — attach product photos or inspiration for this template
                  </p>
                </div>
              </div>

              {/* Aspect ratio — inline panel (Cowork-style) */}
              <div className="rounded-lg border border-brand-sage/20 bg-white overflow-hidden">
                <div className="flex items-center justify-between border-b border-brand-sage/20 px-3 py-2">
                  <span className="text-xs font-medium text-brand-forest">Aspect Ratio</span>
                  <span className="text-[10px] font-medium text-brand-slate bg-brand-cream px-1.5 py-0.5 rounded">
                    {modalRatio}
                  </span>
                </div>
                {ASPECT_RATIOS.map((r, i) => {
                  const isSelected = modalRatio === r.value;
                  const [w, h] = r.value.split(':').map(Number);
                  const scale = 14;
                  const rw = w <= h ? Math.round((w / h) * scale) : scale;
                  const rh = h <= w ? Math.round((h / w) * scale) : scale;
                  return (
                    <button
                      key={r.value}
                      onClick={() => setModalRatio(r.value)}
                      className={cn(
                        'filter-pill active:scale-100 flex w-full items-center gap-3 px-3 py-2 text-sm',
                        'transition-colors duration-100',
                        i < ASPECT_RATIOS.length - 1 && 'border-b border-brand-sage/10',
                        isSelected
                          ? 'bg-brand-forest/5 text-brand-forest'
                          : 'text-brand-slate hover:bg-brand-cream/60 hover:text-brand-forest'
                      )}
                    >
                      {/* Visual ratio indicator */}
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                        <div
                          className={cn(
                            'rounded-[2px] border-2 transition-colors duration-100',
                            isSelected ? 'border-brand-forest' : 'border-brand-sage/50'
                          )}
                          style={{ width: rw, height: rh }}
                        />
                      </div>
                      <span className={cn('flex-1 text-left text-xs', isSelected && 'font-medium')}>
                        {r.label}
                      </span>
                      {isSelected && (
                        <Check className="h-3.5 w-3.5 shrink-0 text-brand-forest animate-badge-pop" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-between border-t border-brand-sage/20 px-6 py-4">
              <button
                onClick={() => {
                  setModalPrompt(fillTemplate(editingTemplate.template, product));
                  setModalRatio(editingTemplate.default_aspect_ratio);
                }}
                className="filter-pill rounded px-2 py-1 text-xs text-brand-slate hover:text-brand-forest hover:bg-brand-cream"
              >
                Reset to default
              </button>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={closeModal}
                  className="transition-[transform,box-shadow] duration-150 hover:scale-[1.03] active:scale-95"
                  style={{ transitionTimingFunction: 'var(--spring)' }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={saveEdit}
                  className="gap-1.5 bg-brand-forest hover:bg-brand-forest/90 hover:scale-[1.03] active:scale-95 transition-[transform,background-color,box-shadow] duration-150"
                  style={{ transitionTimingFunction: 'var(--spring)' }}
                >
                  <Check className="h-3.5 w-3.5" />
                  Save changes
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Placeholder review panel ── */}
      {showPlaceholderReview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{
            animation: 'overlayIn 0.2s ease forwards',
            backgroundColor: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowPlaceholderReview(false)}
        >
          <div
            className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[85vh]"
            style={{ animation: 'modalIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-brand-sage/20 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-brand-black">Unresolved Placeholders</h2>
                  <p className="text-xs text-brand-slate mt-0.5">
                    These templates have placeholder values that need to be filled in before generating.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPlaceholderReview(false)}
                className="rounded-lg p-1.5 text-brand-slate hover:bg-brand-cream hover:text-brand-forest"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Template list */}
            <div className="flex-1 overflow-y-auto scroll-spring px-6 py-4 space-y-4">
              {templatesWithPlaceholders.length === 0 ? (
                <div className="py-8 text-center">
                  <Check className="h-8 w-8 mx-auto text-brand-green mb-2" />
                  <p className="text-sm font-medium text-brand-forest">All placeholders resolved!</p>
                  <p className="text-xs text-brand-slate mt-1">You can now generate images.</p>
                </div>
              ) : (
                templatesWithPlaceholders.map(({ template: t, placeholders }) => (
                  <div
                    key={t.id}
                    className="rounded-xl border border-amber-200 bg-amber-50/50 overflow-hidden"
                  >
                    {/* Template header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-amber-200/60">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] font-bold text-brand-lime">#{t.number}</span>
                        <h3 className="text-sm font-semibold text-brand-black truncate">{t.name}</h3>
                        <Badge variant="secondary" className="text-[10px] shrink-0">{t.category}</Badge>
                      </div>
                      <button
                        onClick={(e) => {
                          setShowPlaceholderReview(false);
                          openEdit(e, t);
                        }}
                        className="filter-pill flex items-center gap-1 shrink-0 rounded-md border border-brand-forest/30 bg-white px-2.5 py-1 text-[11px] font-medium text-brand-forest hover:bg-brand-cream hover:border-brand-forest/50"
                      >
                        <Pencil className="h-3 w-3" />
                        Edit prompt
                      </button>
                    </div>
                    {/* Placeholder pills */}
                    <div className="px-4 py-3 flex flex-wrap gap-1.5">
                      {placeholders.map((ph, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center rounded-md bg-amber-100 border border-amber-300/60 px-2 py-0.5 text-[10px] font-mono font-medium text-amber-800"
                        >
                          {ph}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-brand-sage/20 px-6 py-4">
              <p className="text-xs text-brand-slate">
                Click <strong>Edit prompt</strong> to resolve placeholders, or remove the template from selection.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowPlaceholderReview(false)}
                className="transition-[transform,box-shadow] duration-150 hover:scale-[1.03] active:scale-95"
                style={{ transitionTimingFunction: 'var(--spring)' }}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Floating generate bar ── */}
      <div
        className={cn(
          'fixed bottom-5 left-1/2 z-40 -translate-x-1/2 w-[calc(100%-3rem)] max-w-3xl rounded-2xl border border-brand-sage/20 bg-white/95 backdrop-blur-md shadow-lg shadow-brand-forest/8',
          selectedIds.size > 0 ? 'pointer-events-auto' : 'pointer-events-none'
        )}
        style={{
          transform: selectedIds.size > 0
            ? 'translateX(-50%) translateY(0)'
            : 'translateX(-50%) translateY(calc(100% + 2rem))',
          transition: selectedIds.size > 0
            ? 'transform 420ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 300ms ease'
            : 'transform 220ms cubic-bezier(0.4, 0, 0.2, 1), opacity 150ms ease',
          opacity: selectedIds.size > 0 ? 1 : 0,
        }}
      >
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3 text-sm text-brand-slate">
            <span>
              <span
                key={selectedIds.size}
                className="animate-badge-pop inline-block font-semibold text-brand-forest"
              >
                {selectedIds.size}
              </span>
              {selectedIds.size === 1 ? ' template selected' : ' templates selected'}
            </span>
            {/* Placeholder warning button */}
            {templatesWithPlaceholders.length > 0 && (
              <button
                onClick={() => setShowPlaceholderReview(true)}
                className="filter-pill flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 hover:border-amber-400"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                {templatesWithPlaceholders.length} {templatesWithPlaceholders.length === 1 ? 'template needs' : 'templates need'} review
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-brand-slate">{remainingCredits} credits left</Badge>
            <Button
              onClick={handleGenerate}
              disabled={isSubmitting || remainingCredits < selectedIds.size}
              className={cn(
                'gap-2 bg-brand-forest hover:bg-brand-forest/90',
                'transition-[transform,background-color,box-shadow,opacity] duration-150 hover:scale-[1.03] active:scale-95',
              )}
              style={{ transitionTimingFunction: 'var(--spring)' }}
            >
              <Sparkles
                className="h-4 w-4"
                style={{
                  transition: 'transform 300ms var(--spring)',
                  transform: isSubmitting ? 'rotate(180deg) scale(0.8)' : 'rotate(0deg) scale(1)',
                }}
              />
              {isSubmitting
                ? 'Submitting…'
                : selectedIds.size <= 1
                ? 'Generate Image'
                : `Generate ${selectedIds.size} Images`}
            </Button>
          </div>
        </div>
      </div>

      {/* Full-screen generating overlay */}
      {isSubmitting && (
        <LoadingExperience
          estimatedSeconds={selectedIds.size * 25}
          templateCount={selectedIds.size}
          complete={generateComplete}
          onExitComplete={() => {
            if (pendingNavUrl) router.push(pendingNavUrl);
          }}
        />
      )}
    </>
  );
}
