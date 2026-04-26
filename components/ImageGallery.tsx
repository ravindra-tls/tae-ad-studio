'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw } from 'lucide-react';
import { ImageCard } from '@/components/ImageCard';
import { Lightbox } from '@/components/Lightbox';
import { EditPromptModal } from '@/components/EditPromptModal';
import { AnalyzingImage } from '@/components/AnalyzingImage';
import { cn, downloadImage } from '@/lib/utils';
import type { GeneratedImage } from '@/types';

// ─── Edit entry ───────────────────────────────────────────────────────────────
interface EditEntry {
  tempId:      string;   // client-side UUID, used as React key + reference
  realId:      string | null; // null = API call still in flight
  aspectRatio: string;
  sourceImage: GeneratedImage;
}

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
  const [editEntries,   setEditEntries]  = useState<EditEntry[]>([]);
  const [freshImages,   setFreshImages]  = useState<GeneratedImage[]>([]);
  const [numCols,       setNumCols]      = useState(3);
  const entriesRef = useRef<EditEntry[]>([]);
  entriesRef.current = editEntries;

  useEffect(() => {
    const update = () => setNumCols(window.innerWidth >= 1024 ? 3 : 2);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    setStarred(loadStarred(userId));
  }, [userId]);

  // ── Poll edit entries that have a real ID ─────────────────────────────────
  useEffect(() => {
    const pollable = editEntries.filter((e) => e.realId !== null);
    if (pollable.length === 0) return;

    const tick = async () => {
      const current = entriesRef.current.filter((e) => e.realId !== null);
      if (current.length === 0) return;

      const results = await Promise.all(
        current.map(async (entry) => {
          try {
            const res  = await fetch(`/api/generate/${entry.realId}/status`);
            const data = await res.json();
            return { entry, status: data.status as string, imageUrl: data.imageUrl as string | undefined };
          } catch {
            return { entry, status: 'unknown', imageUrl: undefined };
          }
        }),
      );

      const doneIds:   string[]          = [];
      const completed: GeneratedImage[]  = [];

      for (const { entry, status, imageUrl } of results) {
        if (status === 'completed' && imageUrl) {
          completed.push({
            ...entry.sourceImage,
            id:           entry.realId!,
            image_url:    imageUrl,
            aspect_ratio: entry.aspectRatio,
            status:       'completed',
            created_at:   new Date().toISOString(),
          });
          doneIds.push(entry.tempId);
        } else if (status === 'failed' || status === 'nsfw') {
          doneIds.push(entry.tempId);
        }
        // otherwise keep polling
      }

      if (completed.length > 0) setFreshImages((prev) => [...completed, ...prev]);
      if (doneIds.length > 0)   setEditEntries((prev) => prev.filter((e) => !doneIds.includes(e.tempId)));
    };

    const id = setInterval(tick, 2500);
    tick(); // fire immediately — xAI is sync so result is usually ready at once
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editEntries.filter((e) => e.realId).map((e) => e.realId).join(',')]);

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
    | { kind: 'edit';    entry: EditEntry;    key: string }
    | { kind: 'done';    image: GeneratedImage; globalIdx: number }
    | { kind: 'pending'; image: GeneratedImage; globalIdx: number }
    | { kind: 'failed';  image: GeneratedImage; globalIdx: number };

  const allItems: ColItem[] = [
    ...editEntries.map((e) => ({ kind: 'edit' as const, entry: e, key: e.tempId })),
    ...completedImages.map((img, i) => ({ kind: 'done' as const, image: img, globalIdx: editEntries.length + i })),
    ...pendingImages.map((img, i) => ({ kind: 'pending' as const, image: img, globalIdx: editEntries.length + completedImages.length + i })),
    ...failedImages.map((img, i) => ({ kind: 'failed' as const, image: img, globalIdx: editEntries.length + completedImages.length + pendingImages.length + i })),
  ];

  // Distribute left-to-right into N columns
  const masonryCols: ColItem[][] = Array.from({ length: numCols }, () => []);
  allItems.forEach((item, i) => masonryCols[i % numCols].push(item));

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
                    className="rounded-xl border border-brand-sage/20 bg-brand-cream/30 overflow-hidden animate-edit-arrive"
                    style={{ aspectRatio: item.entry.aspectRatio.replace(':', '/') }}
                  >
                    <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-brand-forest">
                      <AnalyzingImage className="size-20 opacity-80" />
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
                  <div
                    key={item.image.id}
                    className="stagger-item rounded-xl border border-brand-sage/20 bg-brand-cream/30"
                    style={{
                      aspectRatio: (item.image.aspect_ratio || '1:1').replace(':', '/'),
                      animationDelay: `${item.globalIdx * 60}ms`,
                    }}
                  >
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-forest border-t-transparent mx-auto mb-2" />
                        <p className="text-sm text-brand-slate capitalize">{item.image.status}…</p>
                      </div>
                    </div>
                  </div>
                );
              }
              // failed
              return (
                <div
                  key={item.image.id}
                  className="stagger-item rounded-xl border border-red-200 bg-red-50"
                  style={{
                    aspectRatio: (item.image.aspect_ratio || '1:1').replace(':', '/'),
                    animationDelay: `${item.globalIdx * 60}ms`,
                  }}
                >
                  <div className="w-full h-full flex items-center justify-center p-4">
                    <div className="text-center">
                      <Badge variant="destructive" className="mb-2">
                        {item.image.status === 'nsfw' ? 'Content Blocked' : 'Failed'}
                      </Badge>
                      <p className="text-xs text-gray-500 mb-3">{item.image.error_message || 'Generation failed'}</p>
                      {onRegenerate && (
                        <Button size="sm" variant="outline" onClick={() => onRegenerate(item.image)}>
                          <RefreshCw className="mr-1 h-3 w-3" /> Retry
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
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
            setEditEntries((prev) => [...prev, { tempId, realId: null, aspectRatio, sourceImage: editingImage }]);
          }}
          onSubmitted={(tempId, realId, imageUrl) => {
            if (imageUrl) {
              // imageUrl arrives directly from the submit route (xAI/OpenAI are synchronous).
              // Skip polling entirely — remove the placeholder and show the real image at once.
              const entry = entriesRef.current.find((e) => e.tempId === tempId);
              if (entry) {
                setFreshImages((prev) => [{
                  ...entry.sourceImage,
                  id:           realId,
                  image_url:    imageUrl,
                  aspect_ratio: entry.aspectRatio,
                  status:       'completed' as const,
                  created_at:   new Date().toISOString(),
                }, ...prev]);
              }
              setEditEntries((prev) => prev.filter((e) => e.tempId !== tempId));
            } else {
              // Async provider (Vertex AI etc.) — set realId and let polling handle it
              setEditEntries((prev) => prev.map((e) => e.tempId === tempId ? { ...e, realId } : e));
            }
          }}
          onFailed={(tempId) => {
            setEditEntries((prev) => prev.filter((e) => e.tempId !== tempId));
          }}
        />
      )}
    </>
  );
}
