'use client';

/**
 * Reference images for image-to-image. Default = the product's reference
 * images (resolved server-side, shown as "Using N product images"). The user
 * can upload up to 4 replacements (client-compressed, stored durably via
 * POST /api/forge/references — they survive refresh and REPLACE the product
 * fallback at generation time). Hover-X removes an upload (DELETE).
 */

import { useRef, useState } from 'react';
import { BadgeCheck, ImagePlus, Info, Loader2, TriangleAlert, X } from 'lucide-react';
import Link from 'next/link';
import { compressImageToDataUrl } from '@/lib/client/compress';
import { forgeFetch } from '../state/api';
import { useForgeStore } from '../state/forge-store';
import type { ProductRefImage, ReferencesResponse, ForgeSession } from '../state/types';

const MAX_REFS = 4;

export function ReferenceImagePicker({ productImages }: { productImages: ProductRefImage[] }) {
  const { sessionId, state, mutate, notifyError, showSnack } = useForgeStore();
  const [uploading, setUploading] = useState(false);
  const [removingPath, setRemovingPath] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const userRefs = state.session?.userRefs || [];
  const hasAnyRef = userRefs.length > 0 || productImages.length > 0;

  const handleFiles = async (files: File[]) => {
    const remaining = MAX_REFS - userRefs.length;
    const toAdd = files.slice(0, Math.max(0, remaining));
    if (!toAdd.length || uploading) return;
    setUploading(true);
    try {
      const references = await Promise.all(
        toAdd.map(async (file) => ({
          imageBase64: await compressImageToDataUrl(file, { maxEdgePx: 1280, quality: 0.85 }),
          mimeType: 'image/jpeg',
        })),
      );
      await mutate(() =>
        forgeFetch<ReferencesResponse>('POST', '/api/forge/references', { sessionId, references }),
      );
      showSnack({ message: `${references.length} reference image${references.length > 1 ? 's' : ''} attached` });
    } catch (err) {
      notifyError(err);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeRef = async (path: string) => {
    if (removingPath) return;
    setRemovingPath(path);
    try {
      await mutate(() =>
        forgeFetch<{ session: ForgeSession }>('DELETE', '/api/forge/references', {
          sessionId,
          path,
        }),
      );
    } catch (err) {
      notifyError(err);
    } finally {
      setRemovingPath(null);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-brand-sage/25 bg-white/70 p-3">
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-brand-slate/80">
        <span>Reference images</span>
        <span title="Used for image-to-image so the generated ad matches your real packaging. Your uploads replace the product images.">
          <Info className="h-3 w-3 opacity-50" aria-hidden />
        </span>
      </div>

      {userRefs.length > 0 ? (
        <>
          <div className="flex flex-wrap gap-2">
            {userRefs.map((ref) => (
              <div key={ref.path} className="group relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ref.url}
                  alt="Reference"
                  className="h-16 w-16 rounded-lg border border-brand-sage/30 object-cover"
                />
                <button
                  type="button"
                  title="Remove"
                  disabled={removingPath === ref.path}
                  onClick={() => void removeRef(ref.path)}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-wine text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 disabled:opacity-60"
                >
                  {removingPath === ref.path ? (
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                  ) : (
                    <X className="h-3 w-3" aria-hidden />
                  )}
                </button>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-brand-slate/70">
            Your uploads replace the product images for generation.
          </p>
        </>
      ) : productImages.length > 0 ? (
        <>
          <div className="flex items-center gap-1.5 text-xs text-brand-forest">
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
            Using {productImages.length} product image{productImages.length > 1 ? 's' : ''}
          </div>
          <div className="flex flex-wrap gap-2">
            {productImages.slice(0, 6).map((img, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={img.url}
                alt={img.label || `Product image ${i + 1}`}
                title={img.label || undefined}
                className="h-16 w-16 rounded-lg border border-brand-sage/30 object-cover"
              />
            ))}
          </div>
        </>
      ) : (
        <div className="flex items-start gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 text-[11px] leading-snug text-amber-800">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            No reference images anywhere — generated ads may not match your packaging.{' '}
            <Link href="/admin/products" className="font-medium underline underline-offset-2">
              Add product images
            </Link>
          </span>
        </div>
      )}

      {/* Dropzone */}
      {userRefs.length < MAX_REFS && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) void handleFiles(Array.from(e.target.files));
            }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void handleFiles(Array.from(e.dataTransfer.files));
            }}
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-sage/40 px-3 py-3 text-xs text-brand-slate transition-colors hover:border-brand-forest/40 hover:bg-brand-cream/30 hover:text-brand-forest disabled:opacity-60"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Uploading…
              </>
            ) : (
              <>
                <ImagePlus className="h-4 w-4" aria-hidden />
                {userRefs.length
                  ? `Add more (${MAX_REFS - userRefs.length} slot${MAX_REFS - userRefs.length !== 1 ? 's' : ''} left)`
                  : 'Upload replacements — click or drag & drop (max 4)'}
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
}
