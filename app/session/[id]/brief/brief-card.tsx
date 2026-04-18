'use client';

/**
 * Step 2 of the brief-first shell. Renders the structured brief that Claude
 * produced in stage 1, with an Approve button that triggers concept
 * generation.
 *
 * Shell-scope: display only (no inline editing). If Ravindra wants to tweak
 * the hypothesis, he clicks "Start over" and re-drafts with a better
 * objective. Full inline editing is Phase 2 polish.
 */

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, RefreshCcw, Lightbulb } from 'lucide-react';
import type { Brief } from '@/types';

interface BriefStructured {
  schema_version?: string;
  audience?: {
    primary?: string;
    pains?: string[];
    jobs_to_be_done?: string[];
    context?: string;
  };
  offer?: {
    core_promise?: string;
    mechanism?: string;
    proof_points?: string[];
    cta?: string;
  };
  hypothesis?: string;
  tone_direction?: string;
  wild_card_interpretation?: string;
}

interface BriefCardProps {
  brief: Brief;
  onApprove: () => void | Promise<void>;
  onStartOver: () => void;
  approving?: boolean;
  /** True once concepts already exist — hides the approve button, keeps the card. */
  alreadyGenerated?: boolean;
}

function List({ items }: { items?: string[] }) {
  if (!items || items.length === 0) {
    return <span className="text-xs italic text-brand-slate">(none)</span>;
  }
  return (
    <ul className="list-disc pl-5 space-y-1 text-sm text-brand-navy">
      {items.map((s, i) => (
        <li key={i}>{s}</li>
      ))}
    </ul>
  );
}

export function BriefCard({
  brief,
  onApprove,
  onStartOver,
  approving,
  alreadyGenerated,
}: BriefCardProps) {
  const s = (brief.structured as BriefStructured | null) ?? {};

  return (
    <Card className="mt-5 p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-brand-slate">
            <Badge variant="secondary">Stage 1 — Brief</Badge>
            <Badge variant="outline" className="border-brand-teal/30">
              Strictness: {brief.strictness}
            </Badge>
            {brief.wild_card && (
              <Badge variant="outline" className="border-brand-gold text-brand-gold">
                Wild card
              </Badge>
            )}
          </div>
          <h2 className="text-lg font-semibold text-brand-forest mt-1">
            Structured brief
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onStartOver} disabled={approving}>
            <RefreshCcw className="h-3.5 w-3.5 mr-1.5" /> Start over
          </Button>
          {!alreadyGenerated && (
            <Button size="sm" onClick={onApprove} disabled={approving}>
              <Check className="h-3.5 w-3.5 mr-1.5" />
              {approving ? 'Generating concepts…' : 'Approve & get concepts'}
            </Button>
          )}
        </div>
      </div>

      <div className="mb-4 rounded-md bg-brand-cream/50 px-3 py-2 text-xs text-brand-slate">
        <span className="font-semibold text-brand-forest">Your objective:</span>{' '}
        {brief.objective ?? '(none)'}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Audience */}
        <section>
          <h3 className="text-sm font-semibold text-brand-forest mb-2">Audience</h3>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-brand-slate">Primary</dt>
              <dd className="text-brand-navy">{s.audience?.primary ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-brand-slate">Pains</dt>
              <dd>
                <List items={s.audience?.pains} />
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-brand-slate">
                Jobs to be done
              </dt>
              <dd>
                <List items={s.audience?.jobs_to_be_done} />
              </dd>
            </div>
            {s.audience?.context && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-brand-slate">Context</dt>
                <dd className="text-sm text-brand-navy">{s.audience.context}</dd>
              </div>
            )}
          </dl>
        </section>

        {/* Offer */}
        <section>
          <h3 className="text-sm font-semibold text-brand-forest mb-2">Offer</h3>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-brand-slate">Core promise</dt>
              <dd className="text-brand-navy">{s.offer?.core_promise ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-brand-slate">Mechanism</dt>
              <dd className="text-brand-navy">{s.offer?.mechanism ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-brand-slate">Proof points</dt>
              <dd>
                <List items={s.offer?.proof_points} />
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-brand-slate">CTA</dt>
              <dd className="text-brand-navy">{s.offer?.cta ?? '—'}</dd>
            </div>
          </dl>
        </section>
      </div>

      <div className="mt-5 border-t border-brand-cream pt-4 grid grid-cols-1 md:grid-cols-2 gap-5">
        <section>
          <h3 className="text-sm font-semibold text-brand-forest flex items-center gap-1.5">
            <Lightbulb className="h-3.5 w-3.5 text-brand-gold" />
            Hypothesis
          </h3>
          <p className="mt-1 text-sm text-brand-navy">{s.hypothesis ?? '—'}</p>
        </section>
        <section>
          <h3 className="text-sm font-semibold text-brand-forest">Tone direction</h3>
          <p className="mt-1 text-sm text-brand-navy">{s.tone_direction ?? '—'}</p>
        </section>
      </div>

      {s.wild_card_interpretation && (
        <div className="mt-5 rounded-md border border-brand-gold/30 bg-brand-gold/5 px-4 py-3">
          <div className="text-xs font-semibold text-brand-gold uppercase tracking-wide">
            Wild-card interpretation
          </div>
          <p className="mt-1 text-sm text-brand-navy">{s.wild_card_interpretation}</p>
        </div>
      )}
    </Card>
  );
}
