'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, RefreshCw, Heart, Maximize2, X } from 'lucide-react';
import type { GeneratedImage } from '@/types';

interface ImageGalleryProps {
  images: GeneratedImage[];
  onRegenerate?: (image: GeneratedImage) => void;
  onDownload?: (image: GeneratedImage) => void;
}

export function ImageGallery({ images, onRegenerate, onDownload }: ImageGalleryProps) {
  const [lightboxImage, setLightboxImage] = useState<GeneratedImage | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDownload = async (image: GeneratedImage) => {
    if (onDownload) {
      onDownload(image);
      return;
    }
    if (!image.image_url) return;
    const a = document.createElement('a');
    a.href = image.image_url;
    a.download = `tae-ad-${image.id.slice(0, 8)}.png`;
    a.click();
  };

  const completedImages = images.filter((img) => img.status === 'completed' && img.image_url);
  const pendingImages = images.filter((img) => img.status === 'queued' || img.status === 'in_progress');
  const failedImages = images.filter((img) => img.status === 'failed' || img.status === 'nsfw');

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {completedImages.map((image) => (
          <div key={image.id} className="group relative rounded-lg border border-brand-teal/10 bg-white overflow-hidden">
            <div className="relative aspect-square">
              <Image
                src={image.image_url!}
                alt="Generated ad image"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
              <button
                onClick={() => setLightboxImage(image)}
                className="absolute top-2 right-2 rounded-full bg-white/80 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
              >
                <Maximize2 className="h-4 w-4 text-brand-teal" />
              </button>
            </div>
            <div className="p-3">
              <p className="text-xs text-gray-500 line-clamp-2 mb-2">{image.prompt_used.slice(0, 100)}...</p>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="outline" onClick={() => handleDownload(image)}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
                {onRegenerate && (
                  <Button size="sm" variant="outline" onClick={() => onRegenerate(image)}>
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={favorites.has(image.id) ? 'wine' : 'outline'}
                  onClick={() => toggleFavorite(image.id)}
                >
                  <Heart className={`h-3.5 w-3.5 ${favorites.has(image.id) ? 'fill-white' : ''}`} />
                </Button>
                <Badge variant="outline" className="ml-auto text-[10px]">
                  {image.aspect_ratio}
                </Badge>
              </div>
            </div>
          </div>
        ))}

        {pendingImages.map((image) => (
          <div key={image.id} className="rounded-lg border border-brand-teal/10 bg-brand-cream/30 p-4">
            <div className="aspect-square flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-teal border-t-transparent mx-auto mb-2" />
                <p className="text-sm text-brand-slate capitalize">{image.status}...</p>
              </div>
            </div>
          </div>
        ))}

        {failedImages.map((image) => (
          <div key={image.id} className="rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="aspect-square flex items-center justify-center">
              <div className="text-center">
                <Badge variant="destructive" className="mb-2">
                  {image.status === 'nsfw' ? 'Content Blocked' : 'Failed'}
                </Badge>
                <p className="text-xs text-gray-500 mb-2">{image.error_message || 'Generation failed'}</p>
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
      {lightboxImage && lightboxImage.image_url && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setLightboxImage(null)}>
          <button className="absolute top-4 right-4 text-white hover:text-gray-300" onClick={() => setLightboxImage(null)}>
            <X className="h-8 w-8" />
          </button>
          <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <Image
              src={lightboxImage.image_url}
              alt="Generated image"
              width={1024}
              height={1024}
              className="max-h-[90vh] w-auto rounded-lg object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}
