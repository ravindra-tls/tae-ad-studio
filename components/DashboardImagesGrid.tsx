'use client';

import { useState } from 'react';
import { ImageCard } from '@/components/ImageCard';
import { Lightbox } from '@/components/Lightbox';
import { downloadImage } from '@/lib/utils';
import type { GeneratedImage } from '@/types';

interface Props {
  images: GeneratedImage[];
}

const LS_KEY = 'tae-dashboard-starred';

function loadStarred(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(LS_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

export function DashboardImagesGrid({ images }: Props) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [starred,     setStarred]     = useState<Set<string>>(loadStarred);

  function toggleStar(id: string) {
    setStarred(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem(LS_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  function handleDownload(img: GeneratedImage) {
    if (!img.image_url) return;
    downloadImage(img.image_url, `tae-${img.id.slice(0, 8)}.jpg`);
  }

  return (
    <>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-4">
        {images.map((img, i) => (
          <ImageCard
            key={img.id}
            image={img}
            index={i}
            isStarred={starred.has(img.id)}
            onStar={() => toggleStar(img.id)}
            onDownload={() => handleDownload(img)}
            onOpenLightbox={() => setLightboxIdx(i)}
            hidePrompt
          />
        ))}
      </div>

      {lightboxIdx !== null && (
        <Lightbox
          images={images}
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
