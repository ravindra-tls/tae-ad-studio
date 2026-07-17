'use client';

import { useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { X, Upload, Pencil, Check } from 'lucide-react';
import {
  uploadProductReferenceImage,
  deleteProductReferenceImage,
  updateProductReferenceImageLabel,
} from './actions';
import type { ResolvedProductImage } from '@/types';

interface ReferenceImageManagerProps {
  productId: string;
  images: ResolvedProductImage[];
}

/**
 * Drop-in admin UI for managing a product's reference images. Expects its
 * parent to pass rows with `resolved_url` already filled (via
 * `resolveReferenceImages`) — this component is client-side and cannot
 * mint signed URLs itself.
 *
 * The parent is responsible for re-fetching and re-resolving after any
 * server action returns — the server actions call `revalidatePath`, so a
 * `router.refresh()` in the surrounding page is enough.
 */
export function ReferenceImageManager({ productId, images }: ReferenceImageManagerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const doUpload = (file: File, label?: string) => {
    setError(null);
    const form = new FormData();
    form.set('file', file);
    if (label) form.set('label', label);
    startTransition(async () => {
      try {
        await uploadProductReferenceImage(productId, form);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) doUpload(file);
    e.target.value = ''; // let the same file be re-picked
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) doUpload(file);
  };

  const onDelete = (id: string) => {
    if (!confirm('Delete this reference image?')) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteProductReferenceImage(id);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  };

  const startEdit = (img: ResolvedProductImage) => {
    setEditingId(img.id);
    setLabelDraft(img.label ?? '');
  };

  const saveLabel = (id: string) => {
    startTransition(async () => {
      try {
        await updateProductReferenceImageLabel(id, labelDraft);
        setEditingId(null);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex items-center justify-between gap-3 rounded-lg border border-dashed p-4 transition-colors ${
          dragging
            ? 'border-brand-forest bg-brand-cream/40'
            : 'border-brand-forest/30 bg-brand-cream/10'
        }`}
      >
        <p className="text-xs text-brand-slate/70">
          Drop an image here or click Upload. Stored privately; the pipeline fetches
          it via a short-lived signed URL.
        </p>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={onPick}
            disabled={pending}
            className="hidden"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={pending}
          >
            <Upload className="mr-1 h-3.5 w-3.5" />
            {pending ? 'Uploading…' : 'Upload'}
          </Button>
        </div>
      </div>

      {error && (
        <p className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}

      {images.length === 0 ? (
        <p className="text-xs text-brand-slate/50">No reference images yet.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {images.map((img) => (
            <li
              key={img.id}
              className="group relative overflow-hidden rounded-lg border border-brand-forest/10 bg-white"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.resolved_url}
                alt={img.label ?? 'Reference image'}
                className="aspect-square w-full object-cover"
              />
              <button
                type="button"
                onClick={() => onDelete(img.id)}
                disabled={pending}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Delete"
              >
                <X className="h-3.5 w-3.5" />
              </button>

              <div className="flex items-center gap-1 border-t border-brand-forest/10 px-2 py-1.5">
                {editingId === img.id ? (
                  <>
                    <input
                      value={labelDraft}
                      onChange={(e) => setLabelDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          saveLabel(img.id);
                        }
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      disabled={pending}
                      placeholder="Label"
                      autoFocus
                      className="flex-1 rounded border border-brand-forest/20 px-1.5 py-0.5 text-xs focus:border-brand-forest focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => saveLabel(img.id)}
                      disabled={pending}
                      className="rounded p-1 text-brand-forest hover:bg-brand-forest/10"
                      aria-label="Save"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 truncate text-xs text-brand-slate">
                      {img.label || <span className="italic text-brand-slate/40">no label</span>}
                    </span>
                    <button
                      type="button"
                      onClick={() => startEdit(img)}
                      disabled={pending}
                      className="rounded p-1 text-brand-slate/60 opacity-0 transition-opacity hover:bg-brand-forest/10 hover:text-brand-forest group-hover:opacity-100"
                      aria-label="Edit label"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
