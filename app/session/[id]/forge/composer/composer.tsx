'use client';

/**
 * The Brief composer — sticky bar with the 3 target selects, count range,
 * Generate / Surprise actions, progressive-disclosure panels (Creative
 * levers, Constraints & extras), and honest-summary meta chips.
 *
 * Enter anywhere in the composer = Generate (after committing the field
 * being edited and awaiting the in-flight pin save).
 */

import { useState, type KeyboardEvent } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  Sparkles,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useForgeStore } from '../state/forge-store';
import { usePins, TARGET_KEYS, LEVER_KEYS } from '../state/use-pins';
import type { ForgePins, Loadout, TaxFormat } from '../state/types';
import { BriefField } from './brief-field';
import { SLOT_HELP, useChainSlots } from './slots';
import { LeversPanel } from './levers-panel';
import { ExtrasPanel } from './extras-panel';
import { MetaChips } from './meta-chips';

const MEDIUM = 'Static';

function randOf<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function mediumOk(f: TaxFormat): boolean {
  return f.medium === MEDIUM || f.medium === 'Video/Static' || !f.medium;
}

function DisclosureToggle({
  open,
  label,
  count,
  onClick,
}: {
  open: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-medium transition-colors',
        open ? 'text-brand-forest' : 'text-brand-slate hover:text-brand-forest',
      )}
    >
      <Chevron className="h-3.5 w-3.5" aria-hidden />
      {label}
      {count > 0 && (
        <span
          key={count}
          className="ml-0.5 inline-flex h-4 min-w-[16px] animate-badge-pop items-center justify-center rounded-full bg-brand-forest px-1 text-[10px] font-bold text-white"
        >
          {count}
        </span>
      )}
    </button>
  );
}

export function Composer({
  onGenerate,
  streaming,
}: {
  onGenerate: (loadout: Loadout) => void;
  streaming: boolean;
}) {
  const { state, dispatch, showSnack, pinsSavingRef, composerRef } = useForgeStore();
  const { savePins, clearBrief } = usePins();
  const slots = useChainSlots();
  const [count, setCount] = useState(4);

  const pins = state.session?.pins || {};
  const tax = state.taxonomies;
  const { leversOpen, extrasOpen } = state.ui;

  const leverCount = LEVER_KEYS.filter((k) => (pins as Record<string, unknown>)[k]).length;
  const extraCount =
    (pins.constraints || []).length + (pins.enhancers || []).length + (pins.insights || []).length;

  const generate = () => onGenerate({ count, medium: MEDIUM });

  /** Randomly fill the OPEN creative choices (mechanic, format, hook tactic). */
  const spin = () => {
    if (!tax) return;
    const roll: Partial<ForgePins> = {};
    if (tax.mechanics.length) roll.mechanic = randOf(tax.mechanics).name;
    if (tax.hookTactics.length) roll.hookTactic = randOf(tax.hookTactics);
    if (tax.formats.length) {
      const pool = tax.formats.filter(mediumOk);
      roll.format = randOf(pool.length ? pool : tax.formats).name;
    }
    void savePins(roll);
    showSnack({ message: 'Filled the open creative choices — hit Generate' });
  };

  // Enter anywhere in the composer = Generate (text fields commit first via
  // their own Enter handler; we then await the pin save).
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Enter') return;
    const t = e.target as HTMLElement;
    if (t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON') return;
    e.preventDefault();
    void (async () => {
      await pinsSavingRef.current;
      generate();
    })();
  };

  return (
    <section
      ref={(el) => {
        composerRef.current = el;
      }}
      onKeyDown={onKeyDown}
      className="sticky top-0 z-30 border-b border-brand-forest/10 bg-brand-cream/95 px-4 py-3 backdrop-blur"
    >
      {/* Row 1: targets + actions */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid min-w-[260px] flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
          {TARGET_KEYS.map((key) => {
            const slot = slots[key];
            if (!slot) return null;
            return (
              <BriefField
                key={key}
                label={slot.label}
                help={SLOT_HELP[key]}
                type={slot.type}
                options={slot.options}
                value={((pins as Record<string, unknown>)[key] as string | undefined) ?? ''}
                onCommit={(v) => void savePins({ [key]: v })}
              />
            );
          })}
        </div>
        <div className="flex items-end gap-2.5">
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-slate/80">
              Count <b className="text-brand-forest">{count}</b>
            </span>
            <input
              type="range"
              min={2}
              max={6}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="h-[34px] w-24 accent-brand-forest"
            />
          </label>
          <Button size="sm" className="h-[34px] gap-1.5" onClick={generate} disabled={streaming}>
            <Zap className="h-4 w-4" aria-hidden />
            Generate
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-[34px] gap-1.5"
            onClick={spin}
            title="Randomly fill the open creative choices"
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            Surprise me
          </Button>
        </div>
      </div>

      {/* Row 2: disclosures */}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <DisclosureToggle
          open={leversOpen}
          label="Creative levers"
          count={leverCount}
          onClick={() => dispatch({ type: 'SET_LEVERS', open: !leversOpen })}
        />
        <DisclosureToggle
          open={extrasOpen}
          label="Constraints & extras"
          count={extraCount}
          onClick={() => dispatch({ type: 'SET_EXTRAS', open: !extrasOpen })}
        />
        <Badge variant="secondary" className="gap-1" title="Concept Forge makes static image ads">
          <ImageIcon className="h-3 w-3" aria-hidden />
          Static ads
        </Badge>
        <button
          type="button"
          onClick={clearBrief}
          title="Clear all brief fields"
          className="ml-auto text-[11px] text-brand-slate/70 underline-offset-2 hover:text-brand-wine hover:underline"
        >
          clear brief
        </button>
      </div>

      {/* Row 3: honest-summary chips for pins hidden in closed panels */}
      <div className="mt-2 empty:hidden">
        <MetaChips />
      </div>

      {/* Panels */}
      {leversOpen && (
        <div className="mt-2">
          <LeversPanel />
        </div>
      )}
      {extrasOpen && (
        <div className="mt-2">
          <ExtrasPanel />
        </div>
      )}
    </section>
  );
}
