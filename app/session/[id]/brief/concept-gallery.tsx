'use client';

/**
 * Step 3 of the brief-first shell. Renders the N candidate concepts returned
 * by /api/pipeline/concept, plus a collapsible sameness debug panel that
 * shows what BOTH sameness checks said per round.
 *
 * The sameness panel is shell-only tooling: Ravindra asked to see Claude-
 * judged and TF-IDF cosine verdicts side by side during dev so he can
 * evaluate which signal catches the right redundancy before we lock one in.
 * Once that decision is made we can drop the debug panel and, if desired,
 * drop one of the sameness methods.
 */

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChevronDown, ChevronRight, Check, ArrowRight, Loader2 } from 'lucide-react';
import type { Concept } from '@/types';
import type {
  SamenessRound,
  SamenessCheckResult,
  PairwiseScore,
} from '@/lib/pipeline/stages/sameness';

interface ConceptStructured {
  schema_version?: string;
  title?: string;
  hook_archetype?: string;
  description?: string;
  visual_direction?: string;
  copy_direction?: string;
  leaning_on?: {
    pains?: string[];
    proof_points?: string[];
  };
}

interface ConceptGalleryProps {
  concepts: Concept[];
  samenessRounds: SamenessRound[];
  samenessRetries: number;
  loading?: boolean;
  /**
   * Toggle a concept's selection. Returns the updated row so the parent can
   * refresh local state with the new selected_at timestamp. Should throw on
   * HTTP failure so we can show an inline error.
   */
  onToggleSelect?: (conceptId: string, next: boolean) => Promise<Concept>;
  /** Fired when the user clicks "Continue". Parent handles the routing. */
  onContinue?: (selectedIds: string[]) => void;
}

// ─── Loading screen — matches quiz DraftingScreen style ───────────────────────

const CONCEPT_MESSAGES = [
  'Drafting concept directions…',
  'Checking for redundancy…',
  'Sharpening each hook…',
  'Finalising the lineup…',
  'Almost there…',
];

function ConceptLoadingScreen() {
  const [msgIdx, setMsgIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setMsgIdx((i) => (i + 1) % CONCEPT_MESSAGES.length), 2500);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="max-w-2xl mx-auto mt-6">
      <div className="flex flex-col items-center justify-center py-20 gap-6 text-center rounded-3xl border border-brand-forest/10 bg-white shadow-sm">
        <div
          className="relative h-24 w-24 rounded-full flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #3A5340, #C4963F)' }}
        >
          <div
            className="absolute inset-0 rounded-full animate-ping opacity-20"
            style={{ background: 'linear-gradient(135deg, #3A5340, #D0DD61)' }}
          />
          <Loader2 className="h-10 w-10 text-white animate-spin" />
        </div>
        <div>
          <p className="text-lg font-bold text-brand-forest">Generating concepts…</p>
          <p className="text-sm text-brand-slate mt-1">{CONCEPT_MESSAGES[msgIdx]}</p>
        </div>
        <p className="text-xs text-brand-slate/60 max-w-xs">
          Claude drafts 4 distinct directions, then checks for redundancy and
          regenerates any that are too similar. Usually 15–30s.
        </p>
      </div>
    </div>
  );
}

// ─── Gallery ──────────────────────────────────────────────────────────────────

export function ConceptGallery({
  concepts,
  samenessRounds,
  samenessRetries,
  loading,
  onToggleSelect,
  onContinue,
}: ConceptGalleryProps) {
  const [debugOpen, setDebugOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [selectError, setSelectError] = useState<string | null>(null);

  const selectedCount = concepts.filter((c) => c.selected_at !== null).length;
  const selectionEnabled = Boolean(onToggleSelect);

  async function handleToggle(c: Concept, next: boolean) {
    if (!onToggleSelect) return;
    setSelectError(null);
    setPendingId(c.id);
    try {
      await onToggleSelect(c.id, next);
    } catch (err) {
      setSelectError(err instanceof Error ? err.message : String(err));
    } finally {
      setPendingId(null);
    }
  }

  if (loading && concepts.length === 0) {
    return <ConceptLoadingScreen />;
  }

  return (
    <div className="max-w-2xl mx-auto mt-6 space-y-4">
      {/* Section header — same quiz step style */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-brand-forest flex items-center justify-center text-[11px] font-bold text-white shrink-0">
            ✓
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-brand-forest">
            Pick your concepts
          </h2>
          {selectionEnabled && selectedCount > 0 && (
            <Badge
              variant="outline"
              className="border-brand-teal/40 text-brand-teal"
            >
              {selectedCount} selected
            </Badge>
          )}
        </div>
        {samenessRetries > 0 && (
          <Badge variant="outline" className="border-brand-gold text-brand-gold text-[10px]">
            {samenessRetries} retr{samenessRetries === 1 ? 'y' : 'ies'}
          </Badge>
        )}
      </div>
      <p className="text-sm text-brand-slate -mt-2">
        Select one or more directions to advance to copy + visuals.
      </p>

      {selectError && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {selectError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {concepts.map((c, i) => {
          const isSelected = c.selected_at !== null;
          const disabled = !selectionEnabled || pendingId === c.id;
          return (
            <ConceptCard
              key={c.id}
              concept={c}
              index={i}
              selected={isSelected}
              selectable={selectionEnabled}
              disabled={disabled}
              pending={pendingId === c.id}
              onToggle={(next) => handleToggle(c, next)}
            />
          );
        })}
      </div>

      {selectionEnabled && onContinue && (
        <div className="flex items-center justify-between gap-3 pt-5 border-t border-brand-forest/8">
          <p className="text-xs text-brand-slate">
            {selectedCount === 0
              ? 'Select at least one concept to continue.'
              : selectedCount === 1
                ? '1 concept selected — ready to generate.'
                : `${selectedCount} concepts selected — ready to generate.`}
          </p>
          <Button
            disabled={selectedCount === 0}
            onClick={() =>
              onContinue(
                concepts.filter((c) => c.selected_at !== null).map((c) => c.id),
              )
            }
            className="gap-2"
          >
            Generate visuals
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {samenessRounds.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setDebugOpen((v) => !v)}
            className="flex items-center gap-2 text-xs font-semibold text-brand-slate hover:text-brand-forest"
          >
            {debugOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            Sameness debug ({samenessRounds.length} round{samenessRounds.length === 1 ? '' : 's'})
          </button>

          {debugOpen && (
            <div className="mt-3 space-y-4">
              {samenessRounds.map((round, idx) => (
                <SamenessRoundPanel key={idx} round={round} roundIndex={idx} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ConceptCard({
  concept,
  index,
  selected,
  selectable,
  disabled,
  pending,
  onToggle,
}: {
  concept: Concept;
  index: number;
  selected: boolean;
  selectable: boolean;
  disabled: boolean;
  pending: boolean;
  onToggle: (next: boolean) => void;
}) {
  const s = (concept.structured as ConceptStructured | null) ?? {};
  return (
    <Card
      className={`p-4 flex flex-col transition-colors ${
        selected ? 'ring-2 ring-brand-teal border-brand-teal' : ''
      } ${pending ? 'opacity-70' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {selectable && (
            <button
              type="button"
              role="checkbox"
              aria-checked={selected}
              aria-label={
                selected
                  ? `Deselect concept ${index + 1}`
                  : `Select concept ${index + 1}`
              }
              onClick={() => !disabled && onToggle(!selected)}
              disabled={disabled}
              className={`mt-0.5 h-5 w-5 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                selected
                  ? 'bg-brand-teal border-brand-teal text-white'
                  : 'border-brand-slate/40 bg-white hover:border-brand-teal'
              } ${disabled && !selected ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {selected && <Check className="h-3.5 w-3.5" />}
            </button>
          )}
          <div className="min-w-0">
            <div className="text-xs text-brand-slate">#{index}</div>
            <h3 className="text-base font-semibold text-brand-forest leading-snug">
              {concept.title}
            </h3>
          </div>
        </div>
        <Badge variant="secondary" className="shrink-0">
          {concept.hook_archetype ?? 'unknown'}
        </Badge>
      </div>

      <p className="mt-2 text-sm text-brand-navy">{concept.description}</p>

      <dl className="mt-3 space-y-2 text-xs">
        <div>
          <dt className="uppercase tracking-wide text-brand-slate">Visual direction</dt>
          <dd className="text-brand-navy">{s.visual_direction ?? '—'}</dd>
        </div>
        <div>
          <dt className="uppercase tracking-wide text-brand-slate">Copy direction</dt>
          <dd className="text-brand-navy">{s.copy_direction ?? '—'}</dd>
        </div>
      </dl>

      {(s.leaning_on?.pains?.length || s.leaning_on?.proof_points?.length) && (
        <div className="mt-3 pt-3 border-t border-brand-cream">
          <div className="text-xs uppercase tracking-wide text-brand-slate mb-1">
            Leaning on
          </div>
          <div className="flex flex-wrap gap-1">
            {s.leaning_on?.pains?.map((p, i) => (
              <Badge key={`p-${i}`} variant="outline" className="border-brand-wine/40 text-brand-wine">
                pain: {p}
              </Badge>
            ))}
            {s.leaning_on?.proof_points?.map((p, i) => (
              <Badge
                key={`pp-${i}`}
                variant="outline"
                className="border-brand-teal/40 text-brand-teal"
              >
                proof: {p}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function SamenessRoundPanel({
  round,
  roundIndex,
}: {
  round: SamenessRound;
  roundIndex: number;
}) {
  const claudeCheck = round.checks.find((c) => c.method === 'claude');
  const cosineCheck = round.checks.find((c) => c.method === 'cosine_tfidf');

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Badge variant="secondary">Round {roundIndex + 1}</Badge>
        {round.regenerate.length === 0 ? (
          <span className="text-xs text-brand-teal">
            Passed — all concepts diverse enough
          </span>
        ) : (
          <span className="text-xs text-brand-wine">
            Regenerating indices{' '}
            {round.regenerate.map((r) => `#${r.index}`).join(', ')}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SamenessCheckPanel label="Claude (semantic)" check={claudeCheck} />
        <SamenessCheckPanel label="TF-IDF cosine (lexical)" check={cosineCheck} />
      </div>

      {round.regenerate.length > 0 && (
        <div className="mt-3 pt-3 border-t border-brand-cream">
          <div className="text-xs font-semibold text-brand-forest mb-1.5">
            Merged regeneration list (union of both methods)
          </div>
          <ul className="text-xs text-brand-slate space-y-1">
            {round.regenerate.map((r) => (
              <li key={r.index}>
                <span className="font-medium text-brand-navy">#{r.index}:</span> {r.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function SamenessCheckPanel({
  label,
  check,
}: {
  label: string;
  check?: SamenessCheckResult;
}) {
  if (!check) {
    return (
      <div className="rounded-md border border-brand-cream p-3">
        <div className="text-xs font-semibold text-brand-slate">{label}</div>
        <div className="text-xs text-brand-slate italic mt-1">No result</div>
      </div>
    );
  }

  const verdict = check.verdict;
  const isPass = verdict.status === 'pass';

  return (
    <div
      className={`rounded-md border p-3 ${
        isPass ? 'border-brand-teal/30 bg-brand-teal/5' : 'border-brand-wine/30 bg-brand-wine/5'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-brand-forest">{label}</div>
        <Badge variant={isPass ? 'secondary' : 'outline'} className={isPass ? '' : 'border-brand-wine text-brand-wine'}>
          {isPass ? 'pass' : 'regenerate'}
        </Badge>
      </div>

      {verdict.status === 'regenerate' && (
        <ul className="mt-2 text-xs text-brand-navy space-y-1">
          {verdict.items.map((item) => (
            <li key={item.index}>
              <span className="font-semibold">#{item.index}:</span> {item.reason}
            </li>
          ))}
        </ul>
      )}

      {/* Cosine-specific: top pairwise scores */}
      {check.method === 'cosine_tfidf' && check.details.pairwise_scores && (
        <div className="mt-3 pt-2 border-t border-brand-cream/80">
          <div className="text-[10px] uppercase tracking-wide text-brand-slate mb-1">
            Pairwise cosine (threshold {check.details.threshold ?? '?'})
          </div>
          <div className="flex flex-wrap gap-1">
            {check.details.pairwise_scores.slice(0, 8).map((p: PairwiseScore, i: number) => {
              const hot = p.score >= (check.details.threshold ?? 1);
              return (
                <span
                  key={i}
                  className={`text-[10px] rounded px-1.5 py-0.5 font-mono ${
                    hot
                      ? 'bg-brand-wine text-white'
                      : 'bg-brand-cream text-brand-slate'
                  }`}
                  title={hot ? 'above threshold' : 'below threshold'}
                >
                  {p.i}×{p.j}: {p.score.toFixed(3)}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Claude-specific: model + prompt version */}
      {check.method === 'claude' && (check.details.model || check.details.prompt_version) && (
        <div className="mt-3 pt-2 border-t border-brand-cream/80 text-[10px] text-brand-slate font-mono">
          {check.details.model && <>model: {check.details.model}</>}
          {check.details.prompt_version && <> · v{check.details.prompt_version}</>}
        </div>
      )}
    </div>
  );
}
