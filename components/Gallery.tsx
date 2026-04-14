'use client';

import { useState, useMemo, useCallback } from 'react';
import { Images, User, Star, LayoutGrid, Layers2 } from 'lucide-react';
import { Lightbox } from '@/components/Lightbox';
import type { LightboxCreatorInfo } from '@/components/Lightbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImageCard } from '@/components/ImageCard';
import { SwipeView } from '@/components/SwipeView';
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

interface GalleryProps {
  images:        GalleryImage[];
  currentUserId: string;
  ratedImageIds: Set<string>;   // images this user already reacted to — skipped in swipe mode
}

// ─── Component ────────────────────────────────────────────────────────────────
export function Gallery({ images, currentUserId, ratedImageIds }: GalleryProps) {
  const [activeTab,      setActiveTab]      = useState<FilterTab>('all');
  const [productFilter,  setProductFilter]  = useState<string>('all');
  const [starred,        setStarred]        = useState<Set<string>>(() => loadStarred(currentUserId));
  const [lightboxIdx,    setLightboxIdx]    = useState<number | null>(null);
  const [viewMode,       setViewMode]       = useState<ViewMode>('grid');

  const products = useMemo(() => {
    const map = new Map<string, string>();
    images.forEach((img) => {
      if (img.product_id && img.product_name) map.set(img.product_id, img.product_name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [images]);

  const filtered = useMemo(() => images.filter((img) => {
    if (activeTab === 'mine'    && img.creator_user_id !== currentUserId) return false;
    if (activeTab === 'starred' && !starred.has(img.id))                  return false;
    if (productFilter !== 'all' && img.product_id !== productFilter)       return false;
    return true;
  }), [images, activeTab, starred, productFilter, currentUserId]);

  // Swipe queue: same filters as grid, but also exclude images the user already rated
  const swipeQueue = useMemo(
    () => filtered.filter((img) => !ratedImageIds.has(img.id)),
    [filtered, ratedImageIds],
  );

  const unratedCount = swipeQueue.length;

  // Map image id → creator info for lightbox
  const creatorMap = useMemo<Map<string, LightboxCreatorInfo>>(() => {
    const map = new Map<string, LightboxCreatorInfo>();
    filtered.forEach((img) => {
      if (img.creator_name && img.creator_initials) {
        map.set(img.id, { name: img.creator_name, initials: img.creator_initials });
      }
    });
    return map;
  }, [filtered]);

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

  return (
    <>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="mb-6 stagger-item" style={{ animationDelay: '40ms' }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-brand-forest">Gallery</h1>
            <p className="mt-1 text-sm text-brand-slate">All generated ad images across the workspace.</p>
          </div>
          <span className="text-xs text-brand-slate bg-brand-cream px-3 py-1.5 rounded-full border border-brand-sage/20 self-start mt-1">
            {filtered.length} image{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-center gap-3 stagger-item" style={{ animationDelay: '80ms' }}>

        {/* Tab pills */}
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
              {tab.id === 'starred' && starred.size > 0 && (
                <span className="ml-0.5 rounded-full bg-brand-lime/80 text-brand-forest px-1.5 text-[10px] font-bold">
                  {starred.size}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Product filter — Radix Select */}
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

        {/* View mode toggle — pushed to the right */}
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

      {/* ── Content ────────────────────────────────────────────── */}
      {viewMode === 'swipe' ? (
        /* Swipe / Tinder mode */
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
        /* Grid mode */
        filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-brand-sage/30 bg-brand-cream/30 py-20 stagger-item" style={{ animationDelay: '120ms' }}>
            <Images className="h-10 w-10 text-brand-forest/20 mb-3" />
            <p className="text-sm font-medium text-brand-slate">No images found</p>
            <p className="text-xs text-brand-slate/60 mt-1">
              {activeTab === 'starred' ? 'Star an image to see it here.' : 'Generate some ads to get started.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((img, i) => (
              <ImageCard
                key={img.id}
                image={img}
                index={i}
                isStarred={starred.has(img.id)}
                onStar={() => toggleStar(img.id)}
                onDownload={() => handleDownload(img)}
                onOpenLightbox={() => setLightboxIdx(i)}
                galleryMeta={{
                  creatorName:     img.creator_name,
                  creatorInitials: img.creator_initials,
                  productName:     img.product_name,
                  productSubBrand: img.product_sub_brand,
                }}
              />
            ))}
          </div>
        )
      )}

      {/* ── Lightbox ───────────────────────────────────────────── */}
      {lightboxIdx !== null && (
        <Lightbox
          images={filtered as unknown as GeneratedImage[]}
          startIndex={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
          creatorMap={creatorMap}
          onDownload={(img) => handleDownload(img as unknown as GalleryImage)}
          onStar={(id) => toggleStar(id)}
          isStarred={(id) => starred.has(id)}
        />
      )}
    </>
  );
}
