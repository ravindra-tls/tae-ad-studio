'use client';

/**
 * Pinned values hiding inside CLOSED sections surface here as removable
 * chips, so the composer is always an honest summary of the Brief.
 */

import { Link2, Shield, X } from 'lucide-react';
import { useForgeStore, usePinLabels, truncate } from '../state/forge-store';
import { usePins, LEVER_KEYS } from '../state/use-pins';
import { useChainSlots } from './slots';
import { InsightIcon } from './insight-icon';
import type { ReactNode } from 'react';

function MetaChip({
  label,
  title,
  onRemove,
}: {
  label: ReactNode;
  title?: string;
  onRemove: () => void;
}) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 rounded-full border border-brand-sage/40 bg-white px-2 py-0.5 text-[11px] text-brand-slate"
    >
      {label}
      <button
        type="button"
        title="Remove from Brief"
        onClick={onRemove}
        className="rounded p-0.5 text-brand-slate/50 hover:bg-brand-wine/10 hover:text-brand-wine"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}

export function MetaChips() {
  const { state } = useForgeStore();
  const { savePins } = usePins();
  const { displayPin } = usePinLabels();
  const slots = useChainSlots();
  const pins = state.session?.pins || {};
  const { leversOpen, extrasOpen } = state.ui;
  const tax = state.taxonomies;

  const chips: ReactNode[] = [];

  if (!leversOpen) {
    for (const key of LEVER_KEYS) {
      const value = (pins as Record<string, unknown>)[key] as string | undefined;
      if (!value) continue;
      const slot = slots[key];
      chips.push(
        <MetaChip
          key={`lever-${key}`}
          title={String(value)}
          label={`${slot ? slot.label : key}: ${truncate(displayPin(key, value), 28)}`}
          onRemove={() => void savePins({ [key]: '' })}
        />,
      );
    }
  }

  if (!extrasOpen) {
    for (const ins of pins.insights || []) {
      chips.push(
        <MetaChip
          key={`insight-${ins.id}`}
          title={ins.tension}
          label={
            <>
              <InsightIcon emotion={ins.emotion} className="h-3 w-3" />
              {truncate(ins.tension, 26)}
            </>
          }
          onRemove={() =>
            void savePins({ insights: (pins.insights || []).filter((x) => x.id !== ins.id) })
          }
        />,
      );
    }
    for (const id of pins.constraints || []) {
      const c = (tax?.constraintCards || []).find((x) => x.id === id);
      chips.push(
        <MetaChip
          key={`constraint-${id}`}
          title={c?.instruction}
          label={
            <>
              <Link2 className="h-3 w-3" aria-hidden />
              {c ? c.label : id}
            </>
          }
          onRemove={() =>
            void savePins({ constraints: (pins.constraints || []).filter((x) => x !== id) })
          }
        />,
      );
    }
    for (const id of pins.enhancers || []) {
      const e = (tax?.conversionEnhancers || []).find((x) => x.id === id);
      chips.push(
        <MetaChip
          key={`enhancer-${id}`}
          title="Rendered on the exported image"
          label={
            <>
              <Shield className="h-3 w-3" aria-hidden />
              {e ? e.label : id}
            </>
          }
          onRemove={() =>
            void savePins({ enhancers: (pins.enhancers || []).filter((x) => x !== id) })
          }
        />,
      );
    }
  }

  if (!chips.length) return null;
  return <div className="flex flex-wrap gap-1.5">{chips}</div>;
}
