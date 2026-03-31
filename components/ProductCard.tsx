'use client';

import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Product } from '@/types';

interface ProductCardProps {
  product: Product;
  onClick?: () => void;
  selected?: boolean;
  /** Stagger index for entrance animation delay */
  index?: number;
}

export function ProductCard({ product, onClick, selected = false, index = 0 }: ProductCardProps) {
  return (
    <button
      onClick={onClick}
      title={product.name}
      className={cn(
        'product-card stagger-item group relative w-full flex flex-col rounded-xl border p-3 text-left overflow-hidden',
        selected
          ? 'border-brand-forest bg-brand-cream/50 shadow-[0_0_0_3px_rgba(26,81,41,0.15),0_4px_16px_rgba(26,81,41,0.12)] ring-2 ring-brand-forest'
          : 'border-brand-sage/30 bg-white hover:border-brand-forest/40 hover:shadow-md',
      )}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Checkbox */}
      <div
        className={cn(
          'checkbox-box absolute right-2.5 top-2.5 z-10 h-5 w-5 rounded border-2',
          'flex items-center justify-center flex-shrink-0',
          selected
            ? 'bg-brand-forest border-brand-forest shadow-[0_2px_8px_rgba(26,81,41,0.35)]'
            : 'border-brand-sage/40 bg-white opacity-0 group-hover:opacity-100',
        )}
      >
        {selected && (
          <svg viewBox="0 0 10 8" className="h-2.5 w-2.5" fill="none" overflow="visible">
            <path
              d="M1 4l3 3 5-6"
              stroke="white"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="animate-checkmark"
            />
          </svg>
        )}
      </div>

      {/* Image — fixed height, fills width */}
      <div className="relative h-44 w-full shrink-0 overflow-hidden rounded-lg bg-brand-cream">
        {product.thumbnail_url ? (
          <Image
            src={product.thumbnail_url}
            alt={product.name}
            fill
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl text-brand-forest/15 font-serif">
            {product.name.charAt(0)}
          </div>
        )}
      </div>

      {/* Bottom info — fixed height text area */}
      <div className="mt-2 w-full shrink-0">
        <h3 className="h-8 text-xs font-semibold text-brand-forest line-clamp-2 leading-4">
          {product.name}
        </h3>
        <div className="mt-1 flex items-center justify-between gap-1.5">
          <Badge variant="secondary" className="text-[9px] shrink-0">
            {product.sub_brand || product.brand}
          </Badge>
          {product.color_palette?.length > 0 && (
            <div className="flex gap-0.5">
              {product.color_palette.slice(0, 4).map((c, i) => (
                <div
                  key={i}
                  className="h-2.5 w-2.5 rounded-full border border-gray-200"
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
