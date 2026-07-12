'use client';

/**
 * One Brief slot — labeled Radix Select or free-text input. Text fields
 * commit on blur and on Enter (the composer's Enter-to-generate handler then
 * awaits the in-flight pin save before dealing).
 */

import { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface SlotOption {
  value: string;
  label: string;
}

export interface BriefFieldProps {
  label: string;
  help?: string;
  type: 'select' | 'text';
  options?: SlotOption[];
  value: string;
  onCommit: (value: string) => void;
  wide?: boolean;
}

/** Radix Select items can't have an empty value — sentinel for "— any —". */
const ANY = '__any__';

export function BriefField({ label, help, type, options = [], value, onCommit, wide }: BriefFieldProps) {
  const pinned = value !== '';
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const commitText = () => {
    const v = draft.trim();
    if (v !== value) onCommit(v);
  };

  return (
    <div className={cn('flex min-w-0 flex-col gap-1', wide && 'sm:col-span-2')}>
      <div
        className={cn(
          'flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide',
          pinned ? 'text-brand-forest' : 'text-brand-slate/80',
        )}
      >
        <span>{label}</span>
        {help && <Info className="h-3 w-3 opacity-50" aria-hidden />}
        {pinned && <span className="h-1.5 w-1.5 rounded-full bg-brand-lime" aria-hidden />}
      </div>
      {type === 'select' ? (
        <Select
          value={value === '' ? ANY : value}
          onValueChange={(v) => onCommit(v === ANY ? '' : v)}
        >
          <SelectTrigger className="w-full" title={help}>
            <span className="truncate">
              <SelectValue />
            </span>
          </SelectTrigger>
          <SelectContent className="max-h-72 overflow-y-auto">
            <SelectItem value={ANY}>— any —</SelectItem>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          value={draft}
          placeholder="optional…"
          title={help}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitText();
          }}
          className="h-[34px] rounded-xl border-brand-sage/25 text-xs"
        />
      )}
    </div>
  );
}
