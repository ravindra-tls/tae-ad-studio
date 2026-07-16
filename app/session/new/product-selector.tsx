'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ProductCard } from '@/components/ProductCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Search, Loader2, ImagePlus, X, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { compressImageToDataUrl } from '@/lib/client/compress';
import type { Product } from '@/types';

interface ProductSelectorProps {
  products: Product[];
  flow?: 'brief' | 'templates';
}

export function ProductSelector({ products, flow = 'templates' }: ProductSelectorProps) {
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState<string | null>(null);
  const [creatingFor, setCreatingFor] = useState<string | null>(null);
  const [error, setError] = useState('');
  const router = useRouter();

  // Upload step state
  const [showUploadStep, setShowUploadStep] = useState(false);
  const [createdSessionId, setCreatedSessionId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [uploadedPreviews, setUploadedPreviews] = useState<{ id: string; dataUrl: string; name: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const brands = Array.from(new Set(products.map((p) => p.sub_brand || p.brand)));

  const filtered = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesBrand = !brandFilter || (p.sub_brand || p.brand) === brandFilter;
    return matchesSearch && matchesBrand;
  });

  const handleProductClick = useCallback(async (product: Product) => {
    if (creatingFor) return;
    setCreatingFor(product.id);
    setError('');

    try {
      let sessionId: string;
      if (flow === 'brief') {
        // Concept Forge session — the server also builds/loads the product's
        // grounding deck, which can take up to a minute the first time a
        // product is used.
        const res = await fetch('/api/forge/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: product.id }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Failed to create session');
          setCreatingFor(null);
          return;
        }
        sessionId = data.session.id;
      } else {
        const name = `${product.name} — ${new Date().toLocaleDateString()}`;
        const res = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: product.id, name }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Failed to create session');
          setCreatingFor(null);
          return;
        }
        sessionId = data.id;
      }

      // Show optional upload step
      setCreatedSessionId(sessionId);
      setSelectedProduct(product);
      setShowUploadStep(true);
    } catch (e) {
      setError('Something went wrong. Please try again.');
      setCreatingFor(null);
    }
  }, [creatingFor, flow]);

  // Downscale + JPEG-encode so we do not blow the ~5MB sessionStorage quota
  // when stashing previews between pages. Phone photos come in at 4-8MB as
  // PNG data URLs; after this they are typically 150-400KB each.
  // Shared util (1280px long edge, JPEG 0.85).
  const compressToDataUrl = (file: File): Promise<string> =>
    compressImageToDataUrl(file, { maxEdgePx: 1280, quality: 0.85 });

  const handleFilesSelected = (files: FileList) => {
    Array.from(files).forEach(async (file) => {
      try {
        const dataUrl = await compressToDataUrl(file);
        setUploadedPreviews((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            dataUrl,
            name: file.name,
          },
        ]);
      } catch {
        // If compression fails (bad file, OOM in canvas), skip this image
        // rather than taking down the whole upload step.
        setError(`Could not process ${file.name}. Try a smaller image.`);
      }
    });
  };

  const removePreview = (id: string) => {
    setUploadedPreviews((prev) => prev.filter((p) => p.id !== id));
  };

  // Close upload modal and go back to product selection
  const closeUploadStep = useCallback(() => {
    setShowUploadStep(false);
    setCreatingFor(null);
    setCreatedSessionId(null);
    setSelectedProduct(null);
    setUploadedPreviews([]);
  }, []);

  const [finishing, setFinishing] = useState(false);

  const proceedToTemplates = async () => {
    if (!createdSessionId || finishing) return;

    if (flow === 'brief') {
      // Forge references are durable — upload them to the session now (the
      // forge workspace shows/removes them and generation attaches them).
      if (uploadedPreviews.length > 0) {
        setFinishing(true);
        try {
          const res = await fetch('/api/forge/references', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: createdSessionId,
              references: uploadedPreviews.slice(0, 4).map((p) => ({
                imageBase64: p.dataUrl,
                mimeType: 'image/jpeg',
              })),
            }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            console.warn('[product-selector] forge reference upload failed:', data.error);
          }
        } catch (e) {
          console.warn('[product-selector] forge reference upload failed:', e);
        } finally {
          setFinishing(false);
        }
      }
      router.push(`/session/${createdSessionId}/forge`);
      return;
    }

    // Store uploaded images in sessionStorage so the prompts page can pick
    // them up. sessionStorage caps around 5MB per origin — we pre-compress
    // in handleFilesSelected, but large batches can still overflow. If it
    // does, surface a hint and let the user continue without the refs
    // rather than crashing the page.
    if (uploadedPreviews.length > 0) {
      try {
        sessionStorage.setItem(
          `ref-images-${createdSessionId}`,
          JSON.stringify(uploadedPreviews),
        );
      } catch (e) {
        console.warn(
          '[product-selector] sessionStorage quota exceeded; continuing without stashed refs.',
          e,
        );
        setError(
          'Too many or too-large images to carry over. Continuing without references — you can attach them on the next screen.',
        );
      }
    }
    router.push(`/session/${createdSessionId}/prompts`);
  };

  return (
    <div>
      {/* Search and filters */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setBrandFilter(null)}
            className={cn(
              'filter-pill rounded-full px-3 py-1.5 text-xs font-medium',
              !brandFilter
                ? 'bg-brand-forest text-white shadow-sm'
                : 'border border-brand-sage/40 bg-white text-brand-slate hover:border-brand-forest/50 hover:text-brand-forest hover:shadow-sm',
            )}
          >
            All
          </button>
          {brands.map((brand) => (
            <button
              key={brand}
              onClick={() => setBrandFilter(brand)}
              className={cn(
                'filter-pill rounded-full px-3 py-1.5 text-xs font-medium',
                brandFilter === brand
                  ? 'bg-brand-forest text-white shadow-sm'
                  : 'border border-brand-sage/40 bg-white text-brand-slate hover:border-brand-forest/50 hover:text-brand-forest hover:shadow-sm',
              )}
            >
              {brand}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Product grid — 4 equal columns, cards wrap on smaller screens */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {filtered.map((product, i) => (
          <div key={product.id} className="relative">
            <ProductCard
              product={product}
              index={i}
              onClick={() => handleProductClick(product)}
            />
            {creatingFor === product.id && !showUploadStep && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/80 backdrop-blur-[2px]">
                <div className="flex flex-col items-center gap-2 px-3 text-center">
                  <Loader2 className="h-6 w-6 animate-spin text-brand-forest" />
                  <span className="text-xs font-medium text-brand-forest">
                    {flow === 'brief'
                      ? 'Preparing product grounding — first time can take a minute…'
                      : 'Starting session…'}
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="py-12 text-center text-brand-slate">No products match your search.</div>
      )}

      {/* ── Upload step modal (portalled to body so it covers sidebar too) ── */}
      {showUploadStep && (
        <Modal
          open
          onClose={closeUploadStep}
          maxWidth="max-w-lg"
          className="max-h-[80vh]"
          title="Add Reference Images"
          subtitle={
            <>
              Upload product photos or inspiration for <strong>{selectedProduct?.name}</strong>. These will be available to attach to any template.
            </>
          }
          footer={
            <div className="flex items-center justify-between">
              <button
                onClick={proceedToTemplates}
                className="text-xs text-brand-slate hover:text-brand-forest hover:underline"
              >
                Skip for now
              </button>
              <Button
                onClick={proceedToTemplates}
                disabled={finishing}
                className="gap-2 bg-brand-forest hover:bg-brand-forest/90 hover:scale-[1.03] active:scale-95 transition-[transform,background-color] duration-150"
                style={{ transitionTimingFunction: 'var(--spring)' }}
              >
                {finishing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading references…
                  </>
                ) : uploadedPreviews.length > 0 ? (
                  <>Continue with {uploadedPreviews.length} image{uploadedPreviews.length > 1 ? 's' : ''}</>
                ) : (
                  <>Continue without images</>
                )}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          }
        >
            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) handleFilesSelected(e.target.files);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              />

              {/* Uploaded previews */}
              {uploadedPreviews.length > 0 && (
                <div className="flex flex-wrap gap-3 mb-4">
                  {uploadedPreviews.map((img) => (
                    <div key={img.id} className="group/img relative">
                      <img
                        src={img.dataUrl}
                        alt={img.name}
                        className="h-20 w-20 rounded-xl border border-brand-sage/30 object-cover shadow-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removePreview(img.id)}
                        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-brand-wine text-white flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity duration-100 shadow-sm"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <p className="text-[9px] text-brand-slate mt-0.5 truncate w-20 text-center">{img.name}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload dropzone */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="filter-pill w-full flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-brand-sage/40 px-4 py-8 text-brand-slate hover:border-brand-forest/40 hover:text-brand-forest hover:bg-brand-cream/30 transition-colors"
              >
                <ImagePlus className="h-8 w-8 text-brand-sage" />
                <span className="text-sm font-medium">Click to upload images</span>
                <span className="text-[10px] text-brand-slate/60">PNG, JPG, WebP — you can select multiple</span>
              </button>
            </div>

        </Modal>
      )}
    </div>
  );
}
