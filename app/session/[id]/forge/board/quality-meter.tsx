'use client';

/**
 * Quality meter — overall bar with the 6-axis breakdown and the judge's note
 * collapsed behind the score row.
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp, Scale } from 'lucide-react';
import { scoreTone } from '../state/forge-store';
import type { CardScores } from '../state/types';

function AxisBar({ label, value }: { label: string; value: number }) {
  const tone = scoreTone(value);
  return (
    <div className="flex flex-col gap-0.5">
      <div className="h-1 overflow-hidden rounded-full bg-brand-sage/25">
        <span className={`block h-full rounded-full ${tone.bg}`} style={{ width: `${value}%` }} />
      </div>
      <div className="text-[9px] leading-none text-brand-slate/70">{label}</div>
    </div>
  );
}

export function QualityMeter({ scores }: { scores: CardScores }) {
  const [open, setOpen] = useState(false);
  const overall = scores.overall ?? 0;
  const tone = scoreTone(overall);
  const hasDetail = scores.productTruth != null || !!scores.note;

  const axes: Array<[string, number | undefined]> = [
    ['Truth', scores.productTruth],
    ['Emotion', scores.emotionalTruth],
    ['Specific', scores.specificity],
    ['Concrete', scores.concreteness],
    ['Scroll', scores.scrollStop],
    ['Voice', scores.brandVoice],
  ];

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={!hasDetail}
        onClick={() => setOpen((o) => !o)}
        title={hasDetail ? 'click to see the score breakdown' : undefined}
        className="flex w-full items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-brand-slate/70 disabled:cursor-default"
      >
        <span>Quality score</span>
        <span className="flex items-center gap-1">
          <span className={`text-xs font-bold ${tone.text}`}>{scores.overall ?? '–'}</span>
          {hasDetail &&
            (open ? (
              <ChevronUp className="h-3 w-3" aria-hidden />
            ) : (
              <ChevronDown className="h-3 w-3" aria-hidden />
            ))}
        </span>
      </button>
      <div className="h-1.5 overflow-hidden rounded-full bg-brand-sage/25">
        <span
          className={`block h-full rounded-full ${tone.bg}`}
          style={{ width: `${overall}%` }}
        />
      </div>
      {open && hasDetail && (
        <div className="mt-1 flex flex-col gap-1.5">
          {scores.productTruth != null && (
            <div className="grid grid-cols-6 gap-1.5">
              {axes.map(([label, v]) => (
                <AxisBar key={label} label={label} value={v ?? 0} />
              ))}
            </div>
          )}
          {scores.note && (
            <div className="flex items-start gap-1 text-[11px] italic leading-snug text-brand-slate">
              <Scale className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              {scores.note}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
