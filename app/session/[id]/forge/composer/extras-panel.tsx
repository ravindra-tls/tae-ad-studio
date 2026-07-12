'use client';

/**
 * Constraints & extras drawer — constraint cards, conversion enhancers, and
 * human-insight mining (the emotional core).
 */

import { Info, Link2, Pickaxe, Loader2, Shield } from 'lucide-react';
import { useForgeStore, currentInsights, truncate } from '../state/forge-store';
import { usePins } from '../state/use-pins';
import { useInsights } from '../state/use-insights';
import { ChipTray } from './chip-tray';
import { InsightIcon } from './insight-icon';

function GroupLabel({ text, help }: { text: string; help: string }) {
  return (
    <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-brand-slate/80">
      <span>{text}</span>
      <span title={help}>
        <Info className="h-3 w-3 opacity-50" aria-hidden />
      </span>
    </div>
  );
}

export function ExtrasPanel() {
  const { state } = useForgeStore();
  const { toggleConstraint, toggleEnhancer, toggleInsight } = usePins();
  const { mine, mining } = useInsights();
  const pins = state.session?.pins || {};
  const tax = state.taxonomies;
  const mined = currentInsights(state.session);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-brand-sage/25 bg-white/70 p-3">
      {/* Constraints */}
      <div className="flex flex-col gap-1.5">
        <GroupLabel
          text="Constraints"
          help="Optional rules that force novelty (e.g. ≤6 words, as a confession)."
        />
        <ChipTray
          items={(tax?.constraintCards || []).map((c) => ({
            id: c.id,
            title: c.instruction,
            label: (
              <>
                <Link2 className="h-3 w-3" aria-hidden />
                {c.label}
              </>
            ),
          }))}
          activeIds={pins.constraints || []}
          onToggle={toggleConstraint}
        />
      </div>

      {/* Conversion enhancers */}
      <div className="flex flex-col gap-1.5">
        <GroupLabel
          text="Conversion enhancers"
          help="Integrated into the exported image in the form that fits the composition — a badge cluster, icon+text, a seal, a strip, or short trust text. Never woven into the copy."
        />
        <ChipTray
          items={(tax?.conversionEnhancers || []).map((e) => ({
            id: e.id,
            title: 'Integrated into the exported image, placed to fit the composition',
            label: (
              <>
                <Shield className="h-3 w-3" aria-hidden />
                {e.label}
              </>
            ),
          }))}
          activeIds={pins.enhancers || []}
          onToggle={toggleEnhancer}
        />
      </div>

      {/* Human insights */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <GroupLabel
            text="Human insights"
            help="Imagine this persona's inner life and surface the raw, unspoken truths (envy, shame, fear, grief). Pick the truest 3-4 to build ads on."
          />
          <button
            type="button"
            onClick={() => void mine()}
            disabled={mining}
            className="inline-flex items-center gap-1 rounded-full border border-brand-forest/30 bg-white px-2.5 py-0.5 text-[11px] font-medium text-brand-forest hover:bg-brand-cream disabled:opacity-60"
          >
            {mining ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                Mining…
              </>
            ) : (
              <>
                <Pickaxe className="h-3 w-3" aria-hidden />
                Mine insights
              </>
            )}
          </button>
        </div>
        {mined.length ? (
          <ChipTray
            items={mined.map((i) => ({
              id: i.id,
              title: `${i.emotion || ''}: ${i.tension}\n\nstings when: ${i.momentItStings || ''}\n\n${i.whyItsTrue || ''}`,
              label: (
                <>
                  <InsightIcon emotion={i.emotion} className="h-3 w-3" />
                  {truncate(i.tension, 42)}
                </>
              ),
            }))}
            activeIds={(pins.insights || []).map((i) => i.id)}
            onToggle={(id) => toggleInsight(id, mined)}
          />
        ) : (
          <p className="text-[11px] italic text-brand-slate/70">
            {pins.persona
              ? "Mine insights to surface this persona's raw truths."
              : 'Pick a persona, then mine insights.'}
          </p>
        )}
      </div>
    </div>
  );
}
