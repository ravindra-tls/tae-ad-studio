'use client';

/**
 * Notion-style context visibility: shows what the partner is working from
 * (the pinned Brief). Click scrolls to the composer.
 */

import { Clapperboard, Compass, Flame, Image as ImageIcon, PenLine, UserRound } from 'lucide-react';
import { useForgeStore, usePinLabels } from '../state/forge-store';
import type { ReactNode } from 'react';

export function ChatContextStrip() {
  const { state, composerRef, closeConcept, detailId } = useForgeStore();
  const { personaName, painLabel, stageName } = usePinLabels();
  const pins = state.session?.pins || {};

  const chips: ReactNode[] = [];
  if (pins.persona)
    chips.push(
      <span key="persona" className="inline-flex items-center gap-1">
        <UserRound className="h-3 w-3" aria-hidden />
        {personaName(pins.persona)}
      </span>,
    );
  if (pins.pain)
    chips.push(
      <span key="pain" className="inline-flex items-center gap-1">
        <Flame className="h-3 w-3" aria-hidden />
        {painLabel(pins.pain)}
      </span>,
    );
  if (pins.awarenessStage)
    chips.push(
      <span key="stage" className="inline-flex items-center gap-1">
        <Compass className="h-3 w-3" aria-hidden />
        {stageName(pins.awarenessStage)}
      </span>,
    );
  if (pins.format)
    chips.push(
      <span key="format" className="inline-flex items-center gap-1">
        <ImageIcon className="h-3 w-3" aria-hidden />
        {pins.format}
      </span>,
    );
  if (pins.tagline)
    chips.push(
      <span key="tagline" className="inline-flex items-center gap-1">
        <PenLine className="h-3 w-3" aria-hidden />
        tagline
      </span>,
    );
  if (pins.visualIdea)
    chips.push(
      <span key="visual" className="inline-flex items-center gap-1">
        <Clapperboard className="h-3 w-3" aria-hidden />
        visual
      </span>,
    );

  const extras =
    (['angle', 'mechanic', 'hookTactic', 'cta', 'product', 'notes'] as const).filter(
      (k) => pins[k],
    ).length +
    ((pins.insights || []).length ? 1 : 0) +
    ((pins.constraints || []).length ? 1 : 0);

  const more = Math.max(0, chips.length - 4) + extras;

  return (
    <button
      type="button"
      title="Open the Brief"
      onClick={() => {
        if (detailId) closeConcept();
        setTimeout(
          () => composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
          detailId ? 120 : 0,
        );
      }}
      className="flex w-full flex-wrap items-center gap-1.5 border-t border-brand-sage/20 px-3 py-1.5 text-left text-[10px] text-brand-slate/80 hover:bg-brand-cream/40"
    >
      <span className="font-semibold uppercase tracking-wide">
        {chips.length || extras ? 'Context — your Brief:' : 'Context: nothing pinned — I choose freely'}
      </span>
      {chips.slice(0, 4).map((c, i) => (
        <span key={i} className="rounded-full bg-brand-cream px-1.5 py-0.5 text-brand-forest">
          {c}
        </span>
      ))}
      {more > 0 && (
        <span className="rounded-full bg-brand-cream px-1.5 py-0.5 text-brand-forest">
          +{more} more
        </span>
      )}
    </button>
  );
}
