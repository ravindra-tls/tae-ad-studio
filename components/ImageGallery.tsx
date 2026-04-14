'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw } from 'lucide-react';
import { ImageCard } from '@/components/ImageCard';
import { Lightbox } from '@/components/Lightbox';
import { cn, downloadImage } from '@/lib/utils';
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
  onRegenerate?: (image: GeneratedImage) => void;
  onDownload?:   (image: GeneratedImage) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function ImageGallery({ images, userId, onRegenerate, onDownload }: ImageGalleryProps) {
  const [starred,      setStarred]      = useState<Set<string>>(() => loadStarred(userId));
  const [lightboxIdx,  setLightboxIdx]  = useState<number | null>(null);

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

  const completedImages = images.filter((img) => img.status === 'completed' && img.image_url);
  const pendingImages   = images.filter((img) => img.status === 'queued' || img.status === 'in_progress');
  const failedImages    = images.filter((img) => img.status === 'failed'  || img.status === 'nsfw');

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">

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
          />
        ))}

        {/* Pending */}
        {pendingImages.map((image, i) => (
          <div
            key={image.id}
            className="stagger-item rounded-xl border border-brand-sage/20 bg-brand-cream/30"
            style={{ animationDelay: `${(completedImages.length + i) * 60}ms` }}
          >
            <div className="aspect-square flex items-center justify-center">
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
            style={{ animationDelay: `${(completedImages.length + pendingImages.length + i) * 60}ms` }}
          >
            <div className="aspect-square flex items-center justify-center p-4">
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
        />
      )}
    </>
  );
}
