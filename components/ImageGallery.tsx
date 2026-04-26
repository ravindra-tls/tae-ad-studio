'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw } from 'lucide-react';
import { ImageCard } from '@/components/ImageCard';
import { Lightbox } from '@/components/Lightbox';
import { EditPromptModal } from '@/components/EditPromptModal';
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
  const entriesRef = useRef<EditEntry[]>([]);
  entriesRef.current = editEntries;

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

  return (
    <>
      {/* Left-to-right grid, each image at its natural aspect ratio */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-5 items-start">

        {/* Edit placeholders */}
        {editEntries.map((entry) => (
          <div
            key={entry.tempId}
            className="rounded-xl border border-brand-sage/20 bg-brand-cream/30 overflow-hidden"
            style={{ aspectRatio: entry.aspectRatio.replace(':', '/') }}
          >
            <div className="w-full h-full flex flex-col items-center justify-center gap-2.5">
              <div className="h-8 w-8 rounded-full border-2 border-brand-forest border-t-transparent animate-spin" />
              <p className="text-xs text-brand-slate/70 font-medium">Generating edit…</p>
            </div>
          </div>
        ))}

        {/* Completed */}
        {completedImages.map((image, i) => (
          <ImageCard
            key={image.id}
            image={image}
            index={i}
            isStarred={starred.has(image.id)}
            onStar={() => toggleStar(image.id)}
            onDownload={() => handleDownload(image)}
            onOpenLightbox={() => setLightboxIdx(i)}
            onEdit={sessionId && productId ? () => setEditingImage(image) : undefined}
          />
        ))}

        {/* Pending */}
        {pendingImages.map((image, i) => (
          <div
            key={image.id}
            className="stagger-item rounded-xl border border-brand-sage/20 bg-brand-cream/30"
            style={{
              aspectRatio: (image.aspect_ratio || '1:1').replace(':', '/'),
              animationDelay: `${(completedImages.length + i) * 60}ms`,
            }}
          >
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-forest border-t-transparent mx-auto mb-2" />
                <p className="text-sm text-brand-slate capitalize">{image.status}…</p>
              </div>
            </div>
          </div>
        ))}

        {/* Failed */}
        {failedImages.map((image, i) => (
          <div
            key={image.id}
            className="stagger-item rounded-xl border border-red-200 bg-red-50"
            style={{
              aspectRatio: (image.aspect_ratio || '1:1').replace(':', '/'),
              animationDelay: `${(completedImages.length + pendingImages.length + i) * 60}ms`,
            }}
          >
            <div className="w-full h-full flex items-center justify-center p-4">
              <div className="text-center">
                <Badge variant="destructive" className="mb-2">
                  {image.status === 'nsfw' ? 'Content Blocked' : 'Failed'}
                </Badge>
                <p className="text-xs text-gray-500 mb-3">{image.error_message || 'Generation failed'}</p>
                {onRegenerate && (
                  <Button size="sm" variant="outline" onClick={() => onRegenerate(image)}>
                    <RefreshCw className="mr-1 h-3 w-3" /> Retry
                  </Button>
                )}
              </div>
            </div>
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
            setEditingImage(null);
            setEditEntries((prev) => [...prev, { tempId, realId: null, aspectRatio, sourceImage: editingImage }]);
          }}
          onSubmitted={(tempId, realId) => {
            setEditEntries((prev) => prev.map((e) => e.tempId === tempId ? { ...e, realId } : e));
          }}
          onFailed={(tempId) => {
            setEditEntries((prev) => prev.filter((e) => e.tempId !== tempId));
          }}
        />
      )}
    </>
  );
}
