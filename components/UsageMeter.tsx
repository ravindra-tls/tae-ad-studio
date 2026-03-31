'use client';

import { cn } from '@/lib/utils';

interface UsageMeterProps {
  used: number;
  cap: number;
  daysUntilReset?: number;
  compact?: boolean;
}

export function UsageMeter({ used, cap, daysUntilReset, compact = false }: UsageMeterProps) {
  const remaining = Math.max(0, cap - used);
  const percentage = cap > 0 ? (used / cap) * 100 : 0;
  const isHigh = percentage > 80;
  const isExhausted = remaining === 0;

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <div className="h-2 w-16 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', isHigh ? 'bg-brand-wine' : 'bg-brand-teal')}
            style={{ width: `${Math.min(100, percentage)}%` }}
          />
        </div>
        <span className={cn('font-medium', isExhausted ? 'text-brand-wine' : 'text-brand-slate')}>
          {remaining}/{cap}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-brand-teal/10 bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-brand-teal">Monthly Usage</span>
        <span className={cn('text-sm font-bold', isExhausted ? 'text-brand-wine' : 'text-brand-teal')}>
          {remaining} remaining
        </span>
      </div>
      <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', isHigh ? 'bg-brand-wine' : 'bg-brand-teal')}
          style={{ width: `${Math.min(100, percentage)}%` }}
        />
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-gray-500">{used} of {cap} used</span>
        {daysUntilReset !== undefined && (
          <span className="text-xs text-gray-500">Resets in {daysUntilReset} days</span>
        )}
      </div>
    </div>
  );
}
