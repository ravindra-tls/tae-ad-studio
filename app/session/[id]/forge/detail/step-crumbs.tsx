'use client';

/**
 * 1 Concept › 2 Template & Prompt › 3 Image — crumbs behind the furthest
 * unlocked step stay clickable.
 */

import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = ['Concept', 'Template & Prompt', 'Image'] as const;

export function StepCrumbs({
  step,
  reached,
  onStep,
}: {
  step: number;
  reached: number;
  onStep: (n: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step && n <= reached;
        return (
          <span key={label} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-brand-slate/40" aria-hidden />}
            <button
              type="button"
              disabled={n > reached}
              onClick={() => onStep(n)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                active && 'bg-brand-forest text-white shadow-sm',
                done && 'text-brand-forest hover:bg-brand-cream',
                !active && !done && 'text-brand-slate/60',
                n > reached ? 'cursor-not-allowed opacity-50' : '',
              )}
            >
              <span
                className={cn(
                  'inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold',
                  active ? 'bg-white/25 text-white' : 'bg-brand-sage/30 text-brand-forest',
                )}
              >
                {n}
              </span>
              {label}
            </button>
          </span>
        );
      })}
    </div>
  );
}
