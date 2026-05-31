'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Images, User, Star, LayoutGrid, Layers2, Loader2 } from 'lucide-react';
import { Lightbox } from '@/components/Lightbox';
import type { LightboxCreatorInfo } from '@/components/Lightbox';
import { EditPromptModal } from '@/components/EditPromptModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImageCard } from '@/components/ImageCard';
import { SwipeView } from '@/components/SwipeView';
import { AnalyzingImage } from '@/components/AnalyzingImage';
import { cn, downloadImage } from '@/lib/utils';
import type { GalleryImage, GeneratedImage } from '@/types';

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

// ─── Types ────────────────────────────────────────────────────────────────────
type FilterTab  = 'all' | 'mine' | 'starred';
type ViewMode   = 'grid' | 'swipe';

interface EditEntry {
  tempId:      string;
  realId:      string | null;
  aspectRatio: string;
  sourceImage: GalleryImage;
}

interface GalleryProps {
  initialImages: GalleryImage[];
  totalCount:    number;
  currentUserId: string;
  ratedImageIds: Set<string>;
}

// ─── Masonry item type ────────────────────────────────────────────────────────
type GalleryColItem =
  | { kind: 'edit';  entry: EditEntry }
  | { kind: 'image'; img: GalleryImage; colIdx: number };

// ─── Component ────────────────────────────────────────────────────────────────
export function Gallery({ initialImages, totalCount, currentUserId, ratedImageIds }: GalleryProps) {
  // ── Pagination state ────────────────────────────────────────────────────────
  const [allImages,  setAllImages]  = useState<GalleryImage[]>(initialImages);
  const [page,       setPage]       = useState(1);
  const [isLoading,  setIsLoading]  = useState(false);
  const [hasMore,    setHasMore]    = useState(initialImages.length < totalCount);

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [activeTab,      setActiveTab]      = useState<FilterTab>('all');
  const [productFilter,  setProductFilter]  = useState<string>('all');
  const [starred,        setStarred]        = useState<Set<string>>(new Set());
  const [lightboxIdx,    setLightboxIdx]    = useState<number | null>(null);
  const [viewMode,       setViewMode]       = useState<ViewMode>('grid');
  const [editingImage,   setEditingImage]   = useState<GeneratedImage | null>(null);
  const [editEntries,    setEditEntries]    = useState<EditEntry[]>([]);
  const [freshImages,    setFreshImages]    = useState<GalleryImage[]>([]);
  const [numCols,        setNumCols]        = useState(3);

  // ── Starred tab: dedicated fetch by ID (no full pagination needed) ────────
  const [starredImages,  setStarredImages]  = useState<GalleryImage[]>([]);
  const [starredLoading, setStarredLoading] = useState(false);

  const entriesRef  = useRef<EditEntry[]>([]);
  const sentinelRef = useRef<HTMLDivElement>(null);
  entriesRef.current = editEntries;

  // ── Column count responsive ───────────────────────────────────────────────
  useEffect(() => {
    const update = () => setNumCols(window.innerWidth >= 1024 ? 3 : 2);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // ── Load starred IDs from localStorage ───────────────────────────────────
  useEffect(() => {
    setStarred(loadStarred(currentUserId));
  }, [currentUserId]);

  // ── Fetch full image data for starred IDs when starred tab is active ─────
  // Fires when: tab switches to starred, or when starred set changes while on starred tab.
  // Calls /api/gallery?ids=... so only those specific images are fetched — no
  // need to page through all images looking for them.
  useEffect(() => {
    if (activeTab !== 'starred') return;
    const ids = [...starred];
    if (ids.length === 0) { setStarredImages([]); return; }
    setStarredLoading(true);
    fetch(`/api/gallery?ids=${ids.join(',')}`)
      .then((r) => r.json())
      .then((data) => { setStarredImages(data.images ?? []); })
      .catch((err) => { console.error('[Gallery] starred fetch failed:', err); })
      .finally(() => { setStarredLoading(false); });
  }, [activeTab, starred]);

  // ── Infinite scroll: load next page ──────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;
    setIsLoading(true);
    try {
      const nextPage = page + 1;
      const res  = await fetch(`/api/gallery?page=${nextPage}&limit=48`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load');
      setAllImages((prev) => {
        const existingIds = new Set(prev.map((img) => img.id));
        const newImgs = (data.images as GalleryImage[]).filter((img) => !existingIds.has(img.id));
        return [...prev, ...newImgs];
      });
      setPage(nextPage);
      setHasMore(data.hasMore);
    } catch (err) {
      console.error('[Gallery] loadMore failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, hasMore, page]);

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

  const products = useMemo(() => {
    const map = new Map<string, string>();
    allImages.forEach((img) => {
      if (img.product_id && img.product_name) map.set(img.product_id, img.product_name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [allImages]);

  const filtered = useMemo(() => {
    // Starred tab uses its own dedicated fetch result — don't mix with allImages
    const source = activeTab === 'starred' ? starredImages : allImages;
    return source.filter((img) => {
      if (activeTab === 'mine' && img.creator_user_id !== currentUserId) return false;
      if (productFilter !== 'all' && img.product_id !== productFilter)   return false;
      return true;
    });
  }, [allImages, starredImages, activeTab, productFilter, currentUserId]);

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

  // ── Poll edit entries ─────────────────────────────────────────────────────
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

      const doneIds:   string[]       = [];
      const completed: GalleryImage[] = [];

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
      }

      if (completed.length > 0) setFreshImages((prev) => [...completed, ...prev]);
      if (doneIds.length > 0)   setEditEntries((prev) => prev.filter((e) => !doneIds.includes(e.tempId)));
    };

    const id = setInterval(tick, 2500);
    tick();
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editEntries.filter((e) => e.realId).map((e) => e.realId).join(',')]);

  // ── Star helpers ──────────────────────────────────────────────────────────
  const toggleStar = useCallback((id: string) => {
    setStarred((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      persistStarred(currentUserId, next);
      return next;
    });
  }, [currentUserId]);

  const handleDownload = useCallback((img: GalleryImage) => {
    if (!img.image_url) return;
    downloadImage(
      img.image_url,
      `tae-${(img.product_name ?? 'ad').toLowerCase().replace(/\s+/g, '-')}-${img.id.slice(0, 6)}.png`,
    );
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

  const galleryCols: GalleryColItem[][] = Array.from({ length: numCols }, () => []);
  galleryAllItems.forEach((item, i) => galleryCols[i % numCols].push(item));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Header */}
      <div className="mb-6 stagger-item" style={{ animationDelay: '40ms' }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-brand-forest">Gallery</h1>
            <p className="mt-1 text-sm text-brand-slate">All generated ad images across the workspace.</p>
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
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-brand-sage/30 bg-brand-cream/30 py-20 stagger-item" style={{ animationDelay: '120ms' }}>
            <Layers2 className="h-10 w-10 text-brand-forest/20 mb-3" />
            {filtered.length > 0 ? (
              <>
                <p className="text-sm font-medium text-brand-slate">You&apos;ve rated everything here!</p>
                <p className="text-xs text-brand-slate/60 mt-1">Switch to Grid to review your ratings or clear filters to find unrated images.</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-brand-slate">No images to swipe</p>
                <p className="text-xs text-brand-slate/60 mt-1">
                  {activeTab === 'starred' ? 'Star an image to see it here.' : 'Generate some ads to get started.'}
                </p>
              </>
            )}
          </div>
        ) : (
          <SwipeView images={swipeQueue} />
        )
      ) : (
        filtered.length === 0 && editEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-brand-sage/30 bg-brand-cream/30 py-20 stagger-item" style={{ animationDelay: '120ms' }}>
            <Images className="h-10 w-10 text-brand-forest/20 mb-3" />
            <p className="text-sm font-medium text-brand-slate">
              {activeTab === 'starred' && starredLoading ? 'Loading starred images…' : 'No images found'}
            </p>
            <p className="text-xs text-brand-slate/60 mt-1">
              {activeTab === 'starred' && !starredLoading ? 'Star an image to see it here.' : activeTab !== 'starred' ? 'Generate some ads to get started.' : ''}
            </p>
          </div>
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
                          className="rounded-xl border border-brand-sage/20 bg-brand-cream/30 overflow-hidden"
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
                        onStar={() => toggleStar(img.id)}
                        onDownload={() => handleDownload(img)}
                        onOpenLightbox={() => setLightboxIdx(item.colIdx - editEntries.length)}
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

            {/* Infinite scroll sentinel — not used for starred tab (it fetches by ID directly) */}
            {activeTab !== 'starred' && <div ref={sentinelRef} className="h-1 mt-2" aria-hidden />}

            {/* Loading indicator */}
            {(isLoading || (activeTab === 'starred' && starredLoading)) && (
              <div className="flex justify-center items-center gap-2 py-10 text-brand-slate/50">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs">Loading more…</span>
              </div>
            )}

            {/* End of feed */}
            {!hasMore && activeTab !== 'starred' && allImages.length > 0 && (
              <p className="text-center text-xs text-brand-slate/40 py-10">
                All {totalCount.toLocaleString()} images loaded
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
          onStar={(id) => toggleStar(id)}
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
            setEditEntries((prev) => [...prev, { tempId, realId: null, aspectRatio, sourceImage: src }]);
          }}
          onSubmitted={(tempId, realId, imageUrl) => {
            if (imageUrl) {
              const entry = entriesRef.current.find((e) => e.tempId === tempId);
              if (entry) {
                setFreshImages((prev) => {
                  if (prev.some((img) => img.id === realId)) return prev;
                  return [{
                    ...entry.sourceImage,
                    id:           realId,
                    image_url:    imageUrl,
                    aspect_ratio: entry.aspectRatio,
                    status:       'completed' as const,
                    created_at:   new Date().toISOString(),
                  }, ...prev];
                });
              }
              setEditEntries((prev) => prev.filter((e) => e.tempId !== tempId));
            } else {
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
