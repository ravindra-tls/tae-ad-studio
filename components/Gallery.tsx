'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Images, User, Star, LayoutGrid, Layers2, Loader2, SearchX } from 'lucide-react';
import { Lightbox } from '@/components/Lightbox';
import type { LightboxCreatorInfo } from '@/components/Lightbox';
import { EditPromptModal } from '@/components/EditPromptModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { SearchInput } from '@/components/ui/search-input';
import { ImageCard } from '@/components/ImageCard';
import { SwipeView } from '@/components/SwipeView';
import { AnalyzingImage } from '@/components/AnalyzingImage';
import { cn, downloadImage } from '@/lib/utils';
import { useMasonryColumns } from '@/lib/hooks/use-masonry-columns';
import { useEditEntries, type EditEntry } from '@/lib/hooks/use-edit-entries';
import { useStarred } from '@/lib/hooks/use-starred';
import type { GalleryImage, GeneratedImage } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────
type FilterTab  = 'all' | 'mine' | 'starred';
type ViewMode   = 'grid' | 'swipe';

interface GalleryProps {
  initialImages: GalleryImage[];
  totalCount:    number;
  currentUserId: string;
  ratedImageIds: Set<string>;
  /** When set, pagination only fetches images for this template */
  templateId?:   string;
}

// ─── Masonry item type ────────────────────────────────────────────────────────
type GalleryColItem =
  | { kind: 'edit';  entry: EditEntry<GalleryImage> }
  | { kind: 'image'; img: GalleryImage; colIdx: number };

// ─── Component ────────────────────────────────────────────────────────────────
export function Gallery({ initialImages, totalCount, currentUserId, ratedImageIds, templateId }: GalleryProps) {
  // ── Pagination state ────────────────────────────────────────────────────────
  const [allImages,  setAllImages]  = useState<GalleryImage[]>(initialImages);
  const [page,       setPage]       = useState(1);
  const [isLoading,  setIsLoading]  = useState(false);
  const [hasMore,    setHasMore]    = useState(initialImages.length < totalCount);

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [activeTab,      setActiveTab]      = useState<FilterTab>('all');
  const [productFilter,  setProductFilter]  = useState<string>('all');
  const [lightboxIdx,    setLightboxIdx]    = useState<number | null>(null);
  const [viewMode,       setViewMode]       = useState<ViewMode>('grid');
  const [editingImage,   setEditingImage]   = useState<GeneratedImage | null>(null);

  // ── Search state — searchInput is the raw field, activeSearch the applied
  //    (debounced) server query. Composes with product filter + template.
  const [searchInput,   setSearchInput]   = useState('');
  const [activeSearch,  setActiveSearch]  = useState('');
  const [filteredTotal, setFilteredTotal] = useState(totalCount);

  // ── Stars — DB-backed via /api/images/stars (one-time localStorage import
  //    happens inside the hook), optimistic toggle.
  const { starred, toggleStar } = useStarred(currentUserId);

  // ── Edit placeholders: add → poll → promote into freshImages ─────────────
  const { editEntries, freshImages, addPending, resolveSubmitted, removeEntry } =
    useEditEntries<GalleryImage>();

  const sentinelRef = useRef<HTMLDivElement>(null);

  // Starred tab reuses the main feed pipeline — the server filters via
  // ?starred=1 (star join), composing with q/product/template.
  const starredMode = activeTab === 'starred';

  // ── When product filter, search, or starred mode changes: reset and reload ─
  const isFirstRender = useRef(true);
  useEffect(() => {
    // Skip on first render — initialImages already SSR-loaded for 'all'.
    if (isFirstRender.current) { isFirstRender.current = false; return; }

    if (!starredMode && productFilter === 'all' && !activeSearch) {
      // Restore SSR data and let infinite scroll take over again.
      setAllImages(initialImages);
      setPage(1);
      setHasMore(initialImages.length < totalCount);
      setFilteredTotal(totalCount);
      return;
    }

    setAllImages([]);
    setPage(1);
    setHasMore(false);
    setIsLoading(true);

    const params = new URLSearchParams({ page: '1', limit: '48' });
    if (productFilter !== 'all') params.set('product_id', productFilter);
    if (templateId)              params.set('template_id', templateId);
    if (activeSearch)            params.set('q', activeSearch);
    if (starredMode)             params.set('starred', '1');

    let cancelled = false;
    fetch(`/api/gallery?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setAllImages(data.images ?? []);
        setPage(1);
        setHasMore(data.hasMore ?? false);
        setFilteredTotal(data.total ?? 0);
      })
      .catch((err) => console.error('[Gallery] filter fetch failed:', err))
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productFilter, activeSearch, starredMode]);

  // ── Infinite scroll: load next page ──────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;
    setIsLoading(true);
    try {
      const nextPage = page + 1;
      const params = new URLSearchParams({ page: String(nextPage), limit: '48' });
      if (templateId)              params.set('template_id', templateId);
      if (productFilter !== 'all') params.set('product_id', productFilter);
      if (activeSearch)            params.set('q', activeSearch);
      if (starredMode)             params.set('starred', '1');
      const res  = await fetch(`/api/gallery?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load');
      setAllImages((prev) => {
        const existingIds = new Set(prev.map((img) => img.id));
        const newImgs = (data.images as GalleryImage[]).filter((img) => !existingIds.has(img.id));
        return [...prev, ...newImgs];
      });
      setPage(nextPage);
      setHasMore(data.hasMore);
      setFilteredTotal(data.total ?? 0);
    } catch (err) {
      console.error('[Gallery] loadMore failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, hasMore, page, productFilter, activeSearch, templateId, starredMode]);

  // ── IntersectionObserver sentinel at bottom of grid ──────────────────────
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { rootMargin: '400px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, hasMore]);

  // ── Derived counts ────────────────────────────────────────────────────────
  // starred.size is the source of truth — no need to cross-reference allImages
  const starredCount = starred.size;

  // ── Product filter list: fetched once from DB (not derived from loaded images)
  // so all products with images appear even if their images aren't in the first page.
  const [products, setProducts] = useState<{ id: string; name: string }[]>(() => {
    // Seed from SSR-loaded images so there's no flash while the fetch resolves.
    const map = new Map<string, string>();
    initialImages.forEach((img) => {
      if (img.product_id && img.product_name) map.set(img.product_id, img.product_name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  });

  useEffect(() => {
    fetch('/api/gallery?products=1')
      .then((r) => r.json())
      .then((data: { products?: { id: string; name: string }[] }) => {
        if (Array.isArray(data.products) && data.products.length > 0) {
          setProducts(data.products);
        }
      })
      .catch((err) => console.error('[Gallery] products fetch failed:', err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    // Product filter, search, and starred are server-side (allImages is already
    // scoped) — only "mine" is client-side.
    return allImages.filter((img) => {
      if (activeTab === 'mine' && img.creator_user_id !== currentUserId) return false;
      return true;
    });
  }, [allImages, activeTab, currentUserId]);

  const swipeQueue = useMemo(
    () => filtered.filter((img) => !ratedImageIds.has(img.id)),
    [filtered, ratedImageIds],
  );

  const unratedCount = swipeQueue.length;

  const creatorMap = useMemo<Map<string, LightboxCreatorInfo>>(() => {
    const map = new Map<string, LightboxCreatorInfo>();
    filtered.forEach((img) => {
      if (img.creator_name && img.creator_initials) {
        map.set(img.id, { name: img.creator_name, initials: img.creator_initials });
      }
    });
    return map;
  }, [filtered]);

  // ── Star toggle — on the starred tab, unstarring removes the image from the
  //    visible list immediately (server would exclude it on the next fetch anyway).
  const handleToggleStar = useCallback((id: string) => {
    if (starredMode && starred.has(id)) {
      setAllImages((prev) => prev.filter((img) => img.id !== id));
    }
    toggleStar(id);
  }, [starredMode, starred, toggleStar]);

  const handleDownload = useCallback((img: GalleryImage) => {
    if (!img.image_url) return;
    downloadImage(
      img.image_url,
      `tae-${(img.product_name ?? 'ad').toLowerCase().replace(/\s+/g, '-')}-${img.id.slice(0, 6)}.png`,
    );
  }, []);

  const handleUpscale = useCallback(async (img: GalleryImage) => {
    const res = await fetch('/api/images/upscale', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ image_id: img.id }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error || `Upscale failed (${res.status})`);
    }
    const blob   = await res.blob();
    const url    = URL.createObjectURL(blob);
    const slug   = (img.product_name ?? 'ad').toLowerCase().replace(/\s+/g, '-');
    const a      = document.createElement('a');
    a.href       = url;
    a.download   = `tae-${slug}-${img.id.slice(0, 6)}-2x.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const handleRegenerate = useCallback(async (img: GalleryImage) => {
    const res = await fetch('/api/images/regenerate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ image_id: img.id }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error || `Regenerate failed (${res.status})`);
    }
    const blob   = await res.blob();
    const url    = URL.createObjectURL(blob);
    const slug   = (img.product_name ?? 'ad').toLowerCase().replace(/\s+/g, '-');
    const a      = document.createElement('a');
    a.href       = url;
    a.download   = `tae-${slug}-${img.id.slice(0, 6)}-hq.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const TABS: { id: FilterTab; label: string; icon: React.ReactNode }[] = [
    { id: 'all',     label: 'All',     icon: <Images className="h-3.5 w-3.5" /> },
    { id: 'mine',    label: 'By Me',   icon: <User   className="h-3.5 w-3.5" /> },
    { id: 'starred', label: 'Starred', icon: <Star   className="h-3.5 w-3.5" /> },
  ];

  // ── Masonry layout ────────────────────────────────────────────────────────
  const freshIds = new Set(freshImages.map((img) => img.id));
  const dedupedFiltered = filtered.filter((img) => !freshIds.has(img.id));

  const galleryAllItems: GalleryColItem[] = [
    ...editEntries.map((entry) => ({ kind: 'edit' as const, entry })),
    ...[...freshImages, ...dedupedFiltered].map((img, i) => ({
      kind:   'image' as const,
      img,
      colIdx: editEntries.length + i,
    })),
  ];

  const { columns: galleryCols } = useMasonryColumns(galleryAllItems);

  const showLoadingSkeleton = isLoading && filtered.length === 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Header */}
      <div className="mb-6 stagger-item" style={{ animationDelay: '40ms' }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-brand-forest">Gallery</h1>
            <p className="mt-1 text-sm text-brand-slate">Every ad image generated in your workspace.</p>
          </div>
          <span className="text-xs text-brand-slate bg-brand-cream px-3 py-1.5 rounded-full border border-brand-sage/20 self-start mt-1">
            {totalCount.toLocaleString()} image{totalCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3 stagger-item" style={{ animationDelay: '80ms' }}>
        <div className="flex rounded-xl border border-brand-sage/25 bg-white p-1 gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150',
                activeTab === tab.id
                  ? 'bg-brand-forest text-white shadow-sm'
                  : 'text-brand-slate hover:text-brand-forest hover:bg-brand-cream',
              )}
            >
              {tab.icon}
              {tab.label}
              {tab.id === 'starred' && starredCount > 0 && (
                <span className="ml-0.5 rounded-full bg-brand-lime/80 text-brand-forest px-1.5 text-[10px] font-bold">
                  {starredCount}
                </span>
              )}
            </button>
          ))}
        </div>

        <SearchInput
          value={searchInput}
          onChange={setSearchInput}
          onSearch={(v) => setActiveSearch(v.trim())}
          placeholder="Search prompts, products, templates, people…"
          resultCount={activeSearch && !isLoading ? filteredTotal : undefined}
          className="w-full sm:w-72 lg:w-80"
        />

        {products.length > 0 && (
          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger className={cn(
              productFilter !== 'all' && 'border-brand-forest text-brand-forest bg-brand-forest/5',
            )}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="ml-auto flex rounded-xl border border-brand-sage/25 bg-white p-1 gap-1">
          <button
            onClick={() => setViewMode('grid')}
            title="Grid view"
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150',
              viewMode === 'grid'
                ? 'bg-brand-forest text-white shadow-sm'
                : 'text-brand-slate hover:text-brand-forest hover:bg-brand-cream',
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Grid
          </button>
          <button
            onClick={() => setViewMode('swipe')}
            title="Swipe view"
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150',
              viewMode === 'swipe'
                ? 'bg-brand-forest text-white shadow-sm'
                : 'text-brand-slate hover:text-brand-forest hover:bg-brand-cream',
            )}
          >
            <Layers2 className="h-3.5 w-3.5" />
            Swipe
            {unratedCount > 0 && (
              <span className={cn(
                'rounded-full px-1.5 text-[10px] font-bold tabular-nums',
                viewMode === 'swipe' ? 'bg-white/25 text-white' : 'bg-brand-lime/80 text-brand-forest',
              )}>
                {unratedCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'swipe' ? (
        swipeQueue.length === 0 ? (
          <EmptyState
            icon={Layers2}
            className="stagger-item"
            style={{ animationDelay: '120ms' }}
            title={filtered.length > 0 ? <>You&apos;ve rated everything here!</> : 'No images to swipe'}
            subtitle={
              filtered.length > 0
                ? 'Switch to Grid to review your ratings or clear filters to find unrated images.'
                : activeTab === 'starred'
                  ? 'Star an image to see it here.'
                  : 'Generate some ads to get started.'
            }
          />
        ) : (
          <SwipeView images={swipeQueue} />
        )
      ) : (
        filtered.length === 0 && editEntries.length === 0 ? (
          showLoadingSkeleton ? (
            // Full-region load (starred tab or a fresh search/filter fetch) —
            // brand skeleton grid instead of a spinner.
            <div className="grid animate-fade-in grid-cols-2 gap-5 lg:grid-cols-3">
              {Array.from({ length: Math.min(starredCount, 9) || 3 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2.5 rounded-xl border border-brand-sage/20 bg-white p-3">
                  <Skeleton className={i % 2 === 0 ? 'aspect-[4/5] w-full rounded-lg' : 'aspect-square w-full rounded-lg'} />
                  <Skeleton className="h-3 w-2/5" />
                </div>
              ))}
            </div>
          ) : activeSearch ? (
            <EmptyState
              icon={SearchX}
              className="stagger-item"
              style={{ animationDelay: '120ms' }}
              title={<>No results for &ldquo;{activeSearch}&rdquo;</>}
              subtitle="Try a different search — prompts, product names, template names, and creators all match."
            />
          ) : (
            <EmptyState
              icon={Images}
              className="stagger-item"
              style={{ animationDelay: '120ms' }}
              title="No images found"
              subtitle={
                activeTab === 'starred'
                  ? 'Star an image to see it here.'
                  : 'Generate some ads to get started.'
              }
            />
          )
        ) : (
          <>
            {/* Masonry grid */}
            <div className="flex gap-5 items-start">
              {galleryCols.map((col, ci) => (
                <div key={ci} className="flex-1 flex flex-col gap-5">
                  {col.map((item) => {
                    if (item.kind === 'edit') {
                      return (
                        <div
                          key={item.entry.tempId}
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
                    const img = item.img;
                    return (
                      <ImageCard
                        key={img.id}
                        image={img as unknown as GeneratedImage}
                        index={item.colIdx}
                        isStarred={starred.has(img.id)}
                        onStar={() => handleToggleStar(img.id)}
                        onDownload={() => handleDownload(img)}
                        onOpenLightbox={() => setLightboxIdx(item.colIdx - editEntries.length)}
                        onUpscale={() => handleUpscale(img)}
                        onRegenerate={() => handleRegenerate(img)}
                        onEdit={img.session_id && (img as GalleryImage).product_id
                          ? () => setEditingImage(img as unknown as GeneratedImage)
                          : undefined}
                        galleryMeta={{
                          creatorName:     (img as GalleryImage).creator_name,
                          creatorInitials: (img as GalleryImage).creator_initials,
                          productName:     (img as GalleryImage).product_name,
                          productSubBrand: (img as GalleryImage).product_sub_brand,
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="h-1 mt-2" aria-hidden />

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-center items-center gap-2 py-10 text-brand-slate/50">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs">Loading more…</span>
              </div>
            )}

            {/* End of feed */}
            {!hasMore && allImages.length > 0 && (
              <p className="text-center text-xs text-brand-slate/40 py-10">
                All {filteredTotal.toLocaleString()} image{filteredTotal !== 1 ? 's' : ''} loaded
              </p>
            )}
          </>
        )
      )}

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <Lightbox
          images={filtered as unknown as GeneratedImage[]}
          startIndex={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
          creatorMap={creatorMap}
          onDownload={(img) => handleDownload(img as unknown as GalleryImage)}
          onStar={(id) => handleToggleStar(id)}
          isStarred={(id) => starred.has(id)}
          onEdit={(img) => {
            const g = img as unknown as GalleryImage;
            if (!g.session_id || !g.product_id) return;
            setLightboxIdx(null);
            setEditingImage(img);
          }}
        />
      )}

      {/* Edit modal */}
      {editingImage && editingImage.session_id && (editingImage as unknown as GalleryImage).product_id && (
        <EditPromptModal
          image={editingImage}
          sessionId={editingImage.session_id}
          productId={(editingImage as unknown as GalleryImage).product_id!}
          onClose={() => setEditingImage(null)}
          onPending={(tempId, aspectRatio) => {
            const src = editingImage as unknown as GalleryImage;
            setEditingImage(null);
            addPending(tempId, aspectRatio, src);
          }}
          onSubmitted={resolveSubmitted}
          onFailed={removeEntry}
        />
      )}
    </>
  );
}
