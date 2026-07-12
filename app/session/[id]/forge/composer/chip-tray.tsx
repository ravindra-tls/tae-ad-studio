'use client';

/**
 * Toggleable chip tray — constraints, enhancers, and mined insights.
 */

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface ChipTrayItem {
  id: string;
  label: ReactNode;
  title?: string;
}

export function ChipTray({
  items,
  activeIds,
  onToggle,
}: {
  items: ChipTrayItem[];
  activeIds: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => {
        const active = activeIds.includes(item.id);
        return (
          <button
            key={item.id}
            type="button"
            title={item.title}
            onClick={() => onToggle(item.id)}
            className={cn(
              'filter-pill inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium',
              active
                ? 'border-brand-forest bg-brand-forest text-white shadow-sm'
                : 'border-brand-sage/40 bg-white text-brand-slate hover:border-brand-forest/50 hover:text-brand-forest',
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
