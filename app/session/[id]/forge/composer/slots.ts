'use client';

/**
 * Brief slot definitions — built from the deck (personas/pains) and the
 * taxonomies (stages, mechanics, formats, hook tactics, CTA options).
 */

import { useMemo } from 'react';
import { useForgeStore } from '../state/forge-store';
import type { PinKey } from '../state/types';
import type { SlotOption } from './brief-field';

export interface Slot {
  key: PinKey;
  label: string;
  type: 'select' | 'text';
  options?: SlotOption[];
}

export const SLOT_HELP: Record<string, string> = {
  persona: "Who you're talking to — the target customer.",
  pain: 'The core problem or desire the ad speaks to.',
  awarenessStage: 'How aware the viewer is — from unaware to ready-to-buy.',
  angle: 'The core truth/message the ad expresses.',
  mechanic: 'The creative move that makes the point land.',
  format: 'The type/structure of the static ad.',
  hookTactic: 'How the opening line is framed.',
  tagline: 'A line you want the concepts built around.',
  visualIdea: 'A specific visual/scene you want.',
  cta: "The action you want the viewer to take — or 'No CTA' for top-of-funnel.",
  product: 'Whether the product itself should appear in the image.',
  notes: 'Any extra direction for the concepts.',
};

export const WIDE_SLOTS = new Set<string>(['angle', 'tagline', 'visualIdea', 'notes']);

export function useChainSlots(): Record<string, Slot> {
  const { state } = useForgeStore();
  const { deck, taxonomies: tax } = state;

  return useMemo(() => {
    const opt = (value: string, label: string): SlotOption => ({ value, label });
    const list: Slot[] = [
      { key: 'persona', label: 'Persona', type: 'select', options: (deck?.personas || []).map((p) => opt(p.id, p.name)) },
      { key: 'pain', label: 'Pain / desire', type: 'select', options: (deck?.pains || []).map((p) => opt(p.id, p.label)) },
      { key: 'awarenessStage', label: 'Awareness stage', type: 'select', options: (tax?.stages || []).map((s) => opt(s.id, s.name)) },
      { key: 'angle', label: 'Angle', type: 'text' },
      { key: 'mechanic', label: 'Mechanic', type: 'select', options: (tax?.mechanics || []).map((m) => opt(m.name, m.name)) },
      { key: 'format', label: 'Visual format', type: 'select', options: (tax?.formats || []).map((f) => opt(f.name, f.name)) },
      { key: 'hookTactic', label: 'Hook tactic', type: 'select', options: (tax?.hookTactics || []).map((t) => opt(t, t)) },
      { key: 'tagline', label: 'Seed tagline', type: 'text' },
      { key: 'visualIdea', label: 'Visual idea', type: 'text' },
      { key: 'cta', label: 'Call to action', type: 'select', options: [opt('none', 'No CTA'), ...(tax?.ctaOptions || []).map((c) => opt(c, c))] },
      { key: 'product', label: 'Product in image', type: 'select', options: [opt('show', 'Show product'), opt('hide', "Don't show product")] },
      { key: 'notes', label: 'Notes', type: 'text' },
    ];
    return Object.fromEntries(list.map((s) => [s.key, s])) as Record<string, Slot>;
  }, [deck, tax]);
}
