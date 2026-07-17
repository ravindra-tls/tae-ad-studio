'use client';

import { useState } from 'react';
import { ImageCard } from '@/components/ImageCard';
import { Lightbox } from '@/components/Lightbox';
import { downloadImage } from '@/lib/utils';
import { useStarred } from '@/lib/hooks/use-starred';
import type { GeneratedImage } from '@/types';

interface Props {
  images: GeneratedImage[];
  /** Enables the one-time 'tae-starred-<userId>' localStorage import inside useStarred. */
  userId?: string;
}

export function DashboardImagesGrid({ images, userId }: Props) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  // DB-backed stars (one-time localStorage import happens inside the hook).
  const { starred, toggleStar } = useStarred(userId);

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
