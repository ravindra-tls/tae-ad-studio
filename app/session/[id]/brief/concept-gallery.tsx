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

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { LoadingExperience } from '@/components/LoadingExperience';
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
}

export function ConceptGallery({
  concepts,
  samenessRounds,
  samenessRetries,
  loading,
}: ConceptGalleryProps) {
  const [debugOpen, setDebugOpen] = useState(false);

  if (loading && concepts.length === 0) {
    return (
      <Card className="mt-5 p-10 flex flex-col items-center justify-center text-center">
        <LoadingExperience />
        <h3 className="mt-4 text-base font-semibold text-brand-forest">
          Generating concepts…
        </h3>
        <p className="mt-1 text-sm text-brand-slate max-w-md">
          Claude is drafting 4 candidate directions. Redundant ones get
          regenerated in place — this can take ~15-30s.
        </p>
      </Card>
    );
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-brand-forest">
          Concepts <span className="text-brand-slate font-normal">({concepts.length})</span>
        </h2>
        {samenessRetries > 0 && (
          <Badge variant="outline" className="border-brand-gold text-brand-gold">
            {samenessRetries} sameness retr{samenessRetries === 1 ? 'y' : 'ies'}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {concepts.map((c, i) => (
          <ConceptCard key={c.id} concept={c} index={i} />
        ))}
      </div>

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

function ConceptCard({ concept, index }: { concept: Concept; index: number }) {
  const s = (concept.structured as ConceptStructured | null) ?? {};
  return (
    <Card className="p-4 flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs text-brand-slate">#{index}</div>
          <h3 className="text-base font-semibold text-brand-forest leading-snug">
            {concept.title}
          </h3>
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
