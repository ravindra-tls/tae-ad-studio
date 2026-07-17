'use client';

/**
 * SearchInput — the app's search field idiom.
 *
 *   <SearchInput value={q} onChange={setQ} onSearch={runSearch} resultCount={n} />
 *
 * Controlled input with a leading Search icon, a trailing ✕ clear button (when
 * non-empty), and a 300ms-debounced onSearch callback. Pressing '/' anywhere
 * on the page focuses it (skipped while typing in an input/textarea/
 * contenteditable). Styling matches components/ui/input.tsx (rounded-xl,
 * sage border, forest focus ring).
 */

import * as React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchInputProps {
  /** Controlled value. */
  value: string;
  /** Fires on every keystroke (and on clear) with the new value. */
  onChange: (value: string) => void;
  /** Debounced (300ms) search callback; fires immediately on clear. */
  onSearch?: (value: string) => void;
  placeholder?: string;
  /** When set (and the field is non-empty), a small "n results" hint renders inside the field. */
  resultCount?: number;
  className?: string;
  debounceMs?: number;
}

export function SearchInput({
  value,
  onChange,
  onSearch,
  placeholder = 'Search…',
  resultCount,
  className,
  debounceMs = 300,
}: SearchInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Keep the latest onSearch without re-arming timers/effects on identity churn.
  const onSearchRef = React.useRef(onSearch);
  onSearchRef.current = onSearch;

  const clearTimer = () => {
    if (timerRef.current !== undefined) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  };

  React.useEffect(() => clearTimer, []);

  const handleChange = (next: string) => {
    onChange(next);
    clearTimer();
    if (!onSearchRef.current) return;
    timerRef.current = setTimeout(() => onSearchRef.current?.(next), debounceMs);
  };

  const handleClear = () => {
    clearTimer();
    onChange('');
    onSearchRef.current?.(''); // immediate — no debounce on clear
    inputRef.current?.focus();
  };

  // '/' focuses the field — unless the user is already typing somewhere.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t) {
        const tag = t.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) return;
      }
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const showCount = resultCount !== undefined && value.length > 0;

  return (
    <div className={cn('relative flex items-center', className)}>
      <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-brand-slate/50" aria-hidden />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(
          'h-9 w-full rounded-xl border border-brand-sage/25 bg-white pl-9 text-sm text-brand-forest',
          'transition-colors duration-150 placeholder:text-brand-slate/50',
          'focus:outline-none focus:border-brand-forest focus:ring-2 focus:ring-brand-forest/15',
          showCount ? 'pr-24' : value ? 'pr-8' : 'pr-3',
        )}
      />
      {showCount && (
        <span className="pointer-events-none absolute right-8 text-[10px] tabular-nums text-brand-slate/60 whitespace-nowrap">
          {resultCount!.toLocaleString()} result{resultCount === 1 ? '' : 's'}
        </span>
      )}
      {value.length > 0 && (
        <button
          type="button"
          onClick={handleClear}
          title="Clear search"
          aria-label="Clear search"
          className="absolute right-2 flex h-5 w-5 items-center justify-center rounded-md text-brand-slate/50 hover:bg-brand-cream hover:text-brand-forest transition-colors duration-150"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
