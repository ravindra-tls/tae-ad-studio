'use client';

import { useState, useCallback, useEffect } from 'react';
import { ImageCard } from '@/components/ImageCard';
import { Lightbox } from '@/components/Lightbox';
import { EditPromptModal } from '@/components/EditPromptModal';
import { AnalyzingImage } from '@/components/AnalyzingImage';
import { downloadImage } from '@/lib/utils';
import { useMasonryColumns } from '@/lib/hooks/use-masonry-columns';
import { useEditEntries, type EditEntry } from '@/lib/hooks/use-edit-entries';
import type { GeneratedImage } from '@/types';

// ─── User-scoped starred persistence ─────────────────────────────────────────
function starredKey(userId: string) { return `tae-starred-${userId}`; }

function loadStarred(userId: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(starredKey(userId));
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch { return new Set(); }
}

function persistStarred(userId: string, set: Set<string>) {
  try { localStorage.setItem(starredKey(userId), JSON.stringify([...set])); } catch { /* noop */ }
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface ImageGalleryProps {
  images:        GeneratedImage[];
  userId:        string;
  sessionId?:    string;
  productId?:    string;
  onRegenerate?: (image: GeneratedImage) => void;
  onDownload?:   (image: GeneratedImage) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function ImageGallery({ images, userId, sessionId, productId, onRegenerate, onDownload }: ImageGalleryProps) {
  // Start with empty set — populate from localStorage after mount to avoid
  // server/client HTML mismatch during hydration.
  const [starred,       setStarred]      = useState<Set<string>>(new Set());
  const [lightboxIdx,   setLightboxIdx]  = useState<number | null>(null);
  const [editingImage,  setEditingImage] = useState<GeneratedImage | null>(null);

  // ── Edit placeholders: add → poll → promote into freshImages ─────────────
  const { editEntries, freshImages, addPending, resolveSubmitted, removeEntry } =
    useEditEntries<GeneratedImage>();

  useEffect(() => {
    setStarred(loadStarred(userId));
  }, [userId]);

  const toggleStar = useCallback((id: string) => {
    setStarred((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      persistStarred(userId, next);
      return next;
    });
  }, [userId]);

  const handleDownload = useCallback((image: GeneratedImage) => {
    if (onDownload) { onDownload(image); return; }
    if (!image.image_url) return;
    downloadImage(image.image_url, `tae-ad-${image.id.slice(0, 8)}.png`);
  }, [onDownload]);

  const completedImages = [...freshImages, ...images.filter((img) => img.status === 'completed' && img.image_url)];
  const pendingImages   = images.filter((img) => img.status === 'queued' || img.status === 'in_progress');
  const failedImages    = images.filter((img) => img.status === 'failed'  || img.status === 'nsfw');

  // Build a flat ordered list of all items to display
  type ColItem =
    | { kind: 'edit';    entry: EditEntry<GeneratedImage>; key: string }
    | { kind: 'done';    image: GeneratedImage; globalIdx: number }
    | { kind: 'pending'; image: GeneratedImage; globalIdx: number }
    | { kind: 'failed';  image: GeneratedImage; globalIdx: number };

  const allItems: ColItem[] = [
    ...editEntries.map((e) => ({ kind: 'edit' as const, entry: e, key: e.tempId })),
    ...completedImages.map((img, i) => ({ kind: 'done' as const, image: img, globalIdx: editEntries.length + i })),
    ...pendingImages.map((img, i) => ({ kind: 'pending' as const, image: img, globalIdx: editEntries.length + completedImages.length + i })),
    ...failedImages.map((img, i) => ({ kind: 'failed' as const, image: img, globalIdx: editEntries.length + completedImages.length + pendingImages.length + i })),
  ];

  // Distribute left-to-right into N responsive columns
  const { columns: masonryCols } = useMasonryColumns(allItems);

  return (
    <>
      {/* Left-to-right masonry: each image at its natural aspect ratio, no row gaps */}
      <div className="flex gap-5 items-start">
        {masonryCols.map((col, ci) => (
          <div key={ci} className="flex-1 flex flex-col gap-5">
            {col.map((item) => {
              if (item.kind === 'edit') {
                return (
                  <div
                    key={item.key}
                    data-edit-arrival=""
                    className="rounded-xl border border-brand-sage/20 bg-brand-cream/30 overflow-hidden animate-edit-arrive"
                    style={{ aspectRatio: item.entry.aspectRatio.replace(':', '/') }}
                  >
                    <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-brand-forest">
                      <AnalyzingImage />
                      <p className="text-xs text-brand-slate/60 font-medium tracking-wide">Generating edit…</p>
                    </div>
                  </div>
                );
              }
              if (item.kind === 'done') {
                return (
                  <ImageCard
                    key={item.image.id}
                    image={item.image}
                    index={item.globalIdx}
                    isStarred={starred.has(item.image.id)}
                    onStar={() => toggleStar(item.image.id)}
                    onDownload={() => handleDownload(item.image)}
                    onOpenLightbox={() => setLightboxIdx(item.globalIdx - editEntries.length)}
                    onEdit={sessionId && productId ? () => setEditingImage(item.image) : undefined}
                  />
                );
              }
              if (item.kind === 'pending') {
                return (
                  <ImageCard
                    key={item.image.id}
                    image={item.image}
                    index={item.globalIdx}
                    status={item.image.status}
                  />
                );
              }
              // failed / nsfw — ImageCard renders the wine tile (retry hidden for nsfw)
              return (
                <ImageCard
                  key={item.image.id}
                  image={item.image}
                  index={item.globalIdx}
                  status={item.image.status}
                  onRetry={onRegenerate ? () => onRegenerate(item.image) : undefined}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <Lightbox
          images={completedImages}
          startIndex={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
          onDownload={(img) => handleDownload(img)}
          onStar={(id) => toggleStar(id)}
          isStarred={(id) => starred.has(id)}
          onEdit={sessionId && productId ? (img) => {
            setLightboxIdx(null);
            setEditingImage(img);
          } : undefined}
        />
      )}

      {/* Edit prompt modal */}
      {editingImage && sessionId && productId && (
        <EditPromptModal
          image={editingImage}
          sessionId={sessionId}
          productId={productId}
          onClose={() => setEditingImage(null)}
          onPending={(tempId, aspectRatio) => {
            // Note: do NOT window.scrollTo here — it triggers Next.js scroll restoration
            // which blanks the gallery for several seconds. The placeholder renders at
            // the top of the masonry naturally (editEntries always render first).
            setEditingImage(null);
            addPending(tempId, aspectRatio, editingImage);
          }}
          onSubmitted={resolveSubmitted}
          onFailed={removeEntry}
        />
      )}
    </>
  );
}
