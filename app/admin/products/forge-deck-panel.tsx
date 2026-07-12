'use client';

/**
 * Audience & Personas — the Concept Forge grounding deck for a product.
 *
 * Shows the distilled deck (personas with inner-life fields, pains with VOC
 * phrases, brand voice) with inline editing. Edits are saved as durable
 * overrides (PATCH /api/forge/deck/overrides) that survive every re-distill;
 * Rebuild (POST /api/forge/deck/rebuild) re-distills from product context +
 * positioning research + brand config.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCcw,
  Save,
  TriangleAlert,
  UsersRound,
} from 'lucide-react';
import type { Product } from '@/types';

// Local structural types — mirror lib/forge/types (server module, not imported client-side).
interface DeckPersona {
  id: string;
  name: string;
  description?: string;
  lifeContext?: string;
  desire?: string;
  innerMonologue?: string;
  unspokenFears?: string[];
  socialComparison?: string;
  shameMoments?: string[];
  identityLost?: string;
  identityDesired?: string;
}
interface DeckPain {
  id: string;
  label: string;
  description?: string;
  vocPhrases?: string[];
}
interface DeckShape {
  brand: string;
  product: string;
  oneLiner?: string;
  anchorType: string;
  personas: DeckPersona[];
  pains: DeckPain[];
  brandVoice: { adjectives?: string[]; approvedLanguage?: string[]; bannedLanguage?: string[]; notes?: string };
  constraints?: string[];
}
export interface ProductDeckRow {
  product_id: string;
  deck: DeckShape;
  overrides: Record<string, unknown>;
  source_hash: string;
  model_id: string | null;
  distilled_at: string;
}

const PERSONA_TEXT_FIELDS: Array<{ key: keyof DeckPersona; label: string; multiline?: boolean }> = [
  { key: 'description', label: 'Description', multiline: true },
  { key: 'lifeContext', label: 'Life context', multiline: true },
  { key: 'desire', label: 'Core desire', multiline: true },
  { key: 'innerMonologue', label: 'Inner monologue', multiline: true },
  { key: 'socialComparison', label: 'Social comparison', multiline: true },
  { key: 'identityLost', label: 'Identity lost', multiline: true },
  { key: 'identityDesired', label: 'Identity desired', multiline: true },
];
const PERSONA_LIST_FIELDS: Array<{ key: keyof DeckPersona; label: string }> = [
  { key: 'unspokenFears', label: 'Unspoken fears (one per line)' },
  { key: 'shameMoments', label: 'Shame moments (one per line)' },
];

function mergeForDisplay(row: ProductDeckRow): DeckShape {
  const deck = row.deck;
  const ov = (row.overrides ?? {}) as {
    personas?: Array<Partial<DeckPersona> & { id: string }>;
    pains?: Array<Partial<DeckPain> & { id: string }>;
    brandVoice?: DeckShape['brandVoice'];
    constraints?: string[];
  };
  return {
    ...deck,
    personas: (deck.personas ?? []).map((p) => ({ ...p, ...(ov.personas?.find((o) => o.id === p.id) ?? {}) })),
    pains: (deck.pains ?? []).map((p) => ({ ...p, ...(ov.pains?.find((o) => o.id === p.id) ?? {}) })),
    brandVoice: { ...(deck.brandVoice ?? {}), ...(ov.brandVoice ?? {}) },
    constraints: ov.constraints ?? deck.constraints,
  };
}

function depthOf(row: ProductDeckRow | null): 'none' | 'minimal' | 'built' {
  if (!row) return 'none';
  return row.source_hash?.startsWith('minimal:') ? 'minimal' : 'built';
}

export function ForgeDeckPanel({ product, deckRow }: { product: Product; deckRow: ProductDeckRow | null }) {
  const router = useRouter();
  const merged = useMemo(() => (deckRow ? mergeForDisplay(deckRow) : null), [deckRow]);

  const [personas, setPersonas] = useState<DeckPersona[]>(merged?.personas ?? []);
  const [pains, setPains] = useState<DeckPain[]>(merged?.pains ?? []);
  const [banned, setBanned] = useState((merged?.brandVoice.bannedLanguage ?? []).join('\n'));
  const [approved, setApproved] = useState((merged?.brandVoice.approvedLanguage ?? []).join('\n'));
  const [openPersona, setOpenPersona] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const depth = depthOf(deckRow);

  const patchPersona = (id: string, patch: Partial<DeckPersona>) => {
    setPersonas((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    setDirty(true);
  };
  const patchPain = (id: string, patch: Partial<DeckPain>) => {
    setPains((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    setDirty(true);
  };

  const saveOverrides = async () => {
    if (!deckRow || !merged) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      // Send only changed fields per entity so un-edited fields keep
      // improving on future re-distills.
      const personaOverrides = personas
        .map((p) => {
          const base = merged.personas.find((b) => b.id === p.id);
          const diff: Record<string, unknown> = { id: p.id };
          let changed = false;
          (Object.keys(p) as Array<keyof DeckPersona>).forEach((k) => {
            if (k === 'id') return;
            if (JSON.stringify(p[k] ?? null) !== JSON.stringify(base?.[k] ?? null)) {
              diff[k] = p[k];
              changed = true;
            }
          });
          return changed ? diff : null;
        })
        .filter(Boolean);
      const painOverrides = pains
        .map((p) => {
          const base = merged.pains.find((b) => b.id === p.id);
          const diff: Record<string, unknown> = { id: p.id };
          let changed = false;
          (Object.keys(p) as Array<keyof DeckPain>).forEach((k) => {
            if (k === 'id') return;
            if (JSON.stringify(p[k] ?? null) !== JSON.stringify(base?.[k] ?? null)) {
              diff[k] = p[k];
              changed = true;
            }
          });
          return changed ? diff : null;
        })
        .filter(Boolean);

      const bannedList = banned.split('\n').map((s) => s.trim()).filter(Boolean);
      const approvedList = approved.split('\n').map((s) => s.trim()).filter(Boolean);
      const voiceChanged =
        JSON.stringify(bannedList) !== JSON.stringify(merged.brandVoice.bannedLanguage ?? []) ||
        JSON.stringify(approvedList) !== JSON.stringify(merged.brandVoice.approvedLanguage ?? []);

      // Merge with previously saved overrides so older edits survive.
      const prev = (deckRow.overrides ?? {}) as Record<string, unknown>;
      const prevPersonas = (prev.personas as Array<{ id: string }> | undefined) ?? [];
      const prevPains = (prev.pains as Array<{ id: string }> | undefined) ?? [];
      const mergeById = (old: Array<{ id: string }>, next: Array<{ id: string } | null>) => {
        const out = new Map(old.map((o) => [o.id, o]));
        next.forEach((n) => {
          if (!n) return;
          out.set(n.id, { ...(out.get(n.id) ?? { id: n.id }), ...n });
        });
        return Array.from(out.values());
      };

      const overrides: Record<string, unknown> = {
        ...prev,
        personas: mergeById(prevPersonas, personaOverrides as Array<{ id: string }>),
        pains: mergeById(prevPains, painOverrides as Array<{ id: string }>),
      };
      if (voiceChanged) {
        overrides.brandVoice = {
          ...((prev.brandVoice as Record<string, unknown>) ?? {}),
          bannedLanguage: bannedList,
          approvedLanguage: approvedList,
        };
      }

      const res = await fetch('/api/forge/deck/overrides', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, overrides }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save overrides');
      setDirty(false);
      setNotice('Audience edits saved — they will survive future deck rebuilds.');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save overrides');
    } finally {
      setSaving(false);
    }
  };

  const rebuild = async () => {
    setRebuilding(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/forge/deck/rebuild', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Rebuild failed');
      setNotice('Deck rebuilt from product context, research, and brand config.');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rebuild failed');
    } finally {
      setRebuilding(false);
    }
  };

  return (
    <div className="rounded-xl border border-brand-sage/30 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-sage/20 px-4 py-3">
        <div className="flex items-center gap-2">
          <UsersRound className="h-4 w-4 text-brand-forest" />
          <h3 className="text-sm font-semibold text-brand-forest">Audience &amp; Personas (Forge deck)</h3>
          {depth === 'built' && <Badge className="bg-brand-forest/10 text-brand-forest hover:bg-brand-forest/10">Distilled</Badge>}
          {depth === 'minimal' && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Minimal grounding</Badge>}
          {depth === 'none' && <Badge className="bg-brand-cream text-brand-slate hover:bg-brand-cream">Not built yet</Badge>}
          {deckRow && (
            <span className="text-[11px] text-brand-slate">
              {new Date(deckRow.distilled_at).toLocaleDateString()} · {personas.length} personas · {pains.length} pains
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <Button size="sm" onClick={saveOverrides} disabled={saving} className="gap-1.5 bg-brand-forest hover:bg-brand-forest/90">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save edits
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={rebuild} disabled={rebuilding} className="gap-1.5">
            {rebuilding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
            {deckRow ? 'Rebuild deck' : 'Build deck'}
          </Button>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}
        {notice && (
          <div className="rounded-lg border border-brand-forest/20 bg-brand-cream/60 px-3 py-2 text-xs text-brand-forest">
            {notice}
          </div>
        )}

        {!deckRow && (
          <p className="text-xs text-brand-slate">
            The Concept Forge deck for this product has not been distilled yet. It is built automatically on the
            first forge session, or click <strong>Build deck</strong> now. Quality depends on rich product context
            and audience research — generate research above if it is missing.
          </p>
        )}

        {depth === 'minimal' && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            This deck was built without enough source material (no research, thin context). Add audience research
            or product context, then rebuild for meaningfully better concepts.
          </div>
        )}

        {deckRow && (
          <>
            {/* Personas */}
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-brand-slate">Personas</p>
              <div className="space-y-2">
                {personas.map((p) => {
                  const open = openPersona === p.id;
                  return (
                    <div key={p.id} className="rounded-lg border border-brand-sage/30">
                      <button
                        type="button"
                        onClick={() => setOpenPersona(open ? null : p.id)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left"
                      >
                        {open ? <ChevronDown className="h-3.5 w-3.5 text-brand-slate" /> : <ChevronRight className="h-3.5 w-3.5 text-brand-slate" />}
                        <span className="text-sm font-medium text-brand-forest">{p.name}</span>
                        <span className="truncate text-xs text-brand-slate">{p.desire}</span>
                      </button>
                      {open && (
                        <div className="space-y-3 border-t border-brand-sage/20 px-3 py-3">
                          {PERSONA_TEXT_FIELDS.map(({ key, label }) => (
                            <label key={String(key)} className="block">
                              <span className="mb-1 block text-[11px] font-medium text-brand-slate">{label}</span>
                              <textarea
                                value={(p[key] as string | undefined) ?? ''}
                                onChange={(e) => patchPersona(p.id, { [key]: e.target.value } as Partial<DeckPersona>)}
                                rows={2}
                                className="w-full rounded-md border border-brand-sage/40 px-2 py-1.5 text-xs text-brand-navy focus:border-brand-forest/50 focus:outline-none"
                              />
                            </label>
                          ))}
                          {PERSONA_LIST_FIELDS.map(({ key, label }) => (
                            <label key={String(key)} className="block">
                              <span className="mb-1 block text-[11px] font-medium text-brand-slate">{label}</span>
                              <textarea
                                value={((p[key] as string[] | undefined) ?? []).join('\n')}
                                onChange={(e) =>
                                  patchPersona(p.id, {
                                    [key]: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
                                  } as Partial<DeckPersona>)
                                }
                                rows={3}
                                className="w-full rounded-md border border-brand-sage/40 px-2 py-1.5 text-xs text-brand-navy focus:border-brand-forest/50 focus:outline-none"
                              />
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {personas.length === 0 && <p className="text-xs text-brand-slate">No personas in the deck.</p>}
              </div>
            </div>

            {/* Pains */}
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-brand-slate">Pains &amp; desires</p>
              <div className="space-y-2">
                {pains.map((p) => (
                  <div key={p.id} className="rounded-lg border border-brand-sage/30 px-3 py-2">
                    <input
                      value={p.label}
                      onChange={(e) => patchPain(p.id, { label: e.target.value })}
                      className="mb-1 w-full rounded-md border border-transparent px-1 py-0.5 text-sm font-medium text-brand-forest hover:border-brand-sage/40 focus:border-brand-forest/50 focus:outline-none"
                    />
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-medium text-brand-slate">Customer phrases / VOC (one per line)</span>
                      <textarea
                        value={(p.vocPhrases ?? []).join('\n')}
                        onChange={(e) =>
                          patchPain(p.id, { vocPhrases: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })
                        }
                        rows={2}
                        className="w-full rounded-md border border-brand-sage/40 px-2 py-1.5 text-xs text-brand-navy focus:border-brand-forest/50 focus:outline-none"
                      />
                    </label>
                  </div>
                ))}
                {pains.length === 0 && <p className="text-xs text-brand-slate">No pains in the deck.</p>}
              </div>
            </div>

            {/* Voice */}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-brand-slate">Banned language (one per line)</span>
                <textarea
                  value={banned}
                  onChange={(e) => { setBanned(e.target.value); setDirty(true); }}
                  rows={4}
                  className="w-full rounded-md border border-brand-sage/40 px-2 py-1.5 text-xs text-brand-navy focus:border-brand-forest/50 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-brand-slate">Approved language (one per line)</span>
                <textarea
                  value={approved}
                  onChange={(e) => { setApproved(e.target.value); setDirty(true); }}
                  rows={4}
                  className="w-full rounded-md border border-brand-sage/40 px-2 py-1.5 text-xs text-brand-navy focus:border-brand-forest/50 focus:outline-none"
                />
              </label>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
