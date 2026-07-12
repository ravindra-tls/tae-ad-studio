'use client';

/**
 * Creative levers — the optional Brief fields behind the first disclosure.
 */

import { useForgeStore } from '../state/forge-store';
import { usePins, LEVER_KEYS } from '../state/use-pins';
import { BriefField } from './brief-field';
import { SLOT_HELP, WIDE_SLOTS, useChainSlots } from './slots';

export function LeversPanel() {
  const { state } = useForgeStore();
  const { savePins } = usePins();
  const slots = useChainSlots();
  const pins = state.session?.pins || {};

  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl border border-brand-sage/25 bg-white/70 p-3 sm:grid-cols-2 lg:grid-cols-3">
      {LEVER_KEYS.map((key) => {
        const slot = slots[key];
        if (!slot) return null;
        return (
          <BriefField
            key={key}
            label={slot.label}
            help={SLOT_HELP[key]}
            type={slot.type}
            options={slot.options}
            wide={WIDE_SLOTS.has(key)}
            value={(pins as Record<string, unknown>)[key] as string | undefined ?? ''}
            onCommit={(v) => void savePins({ [key]: v })}
          />
        );
      })}
    </div>
  );
}
