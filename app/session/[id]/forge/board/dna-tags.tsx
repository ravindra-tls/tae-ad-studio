'use client';

/**
 * A concept's DNA — stage / mechanic / format / hook tactic / persona / pain.
 * Every tag is clickable to pin that value into the Brief.
 */

import { Flame, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePinLabels } from '../state/forge-store';
import type { CardDna, PinKey } from '../state/types';

interface TagDef {
  key: PinKey;
  value: string;
  display: React.ReactNode;
  className: string;
}

export function DnaTags({
  dna,
  onPin,
}: {
  dna: CardDna;
  onPin: (key: PinKey, value: string) => void;
}) {
  const { personaName, painLabel, stageName } = usePinLabels();

  const tags: TagDef[] = [
    {
      key: 'awarenessStage',
      value: dna.awarenessStage,
      display: stageName(dna.awarenessStage),
      className: 'bg-brand-forest/10 text-brand-forest',
    },
    {
      key: 'mechanic',
      value: dna.mechanic,
      display: dna.mechanic,
      className: 'bg-brand-green/15 text-brand-forest',
    },
    {
      key: 'format',
      value: dna.format,
      display: dna.format,
      className: 'bg-brand-lime/25 text-brand-forest',
    },
    {
      key: 'hookTactic',
      value: dna.hookTactic || '',
      display: dna.hookTactic || dna.trigger || '',
      className: 'bg-brand-cream text-brand-slate',
    },
    {
      key: 'persona',
      value: dna.persona,
      display: (
        <>
          <UserRound className="h-3 w-3" aria-hidden />
          {personaName(dna.persona)}
        </>
      ),
      className: 'bg-brand-cream text-brand-slate',
    },
    {
      key: 'pain',
      value: dna.pain,
      display: (
        <>
          <Flame className="h-3 w-3" aria-hidden />
          {painLabel(dna.pain)}
        </>
      ),
      className: 'bg-brand-cream text-brand-slate',
    },
  ];

  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((t) =>
        t.display ? (
          <button
            key={t.key}
            type="button"
            title="click to add to your Brief"
            onClick={() => {
              if (t.value) onPin(t.key, t.value);
            }}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
              'transition-colors hover:ring-1 hover:ring-brand-forest/30',
              t.className,
            )}
          >
            {t.display}
          </button>
        ) : null,
      )}
    </div>
  );
}
