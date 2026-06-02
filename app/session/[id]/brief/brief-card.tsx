'use client';

/**
 * Step 2 of the brief-first shell — brief review in the same quiz visual
 * language. Renders the structured brief Claude produced, with an Approve
 * button that triggers concept generation.
 *
 * Shell-scope: display-only (no inline editing). If the marketer wants to
 * tweak the hypothesis, they click "Start over" and re-run the quiz.
 * Full inline editing is Phase 2 polish.
 */

import { Button } from '@/components/ui/button';
import { RefreshCcw, Sparkles, Lightbulb, Users, Gift, Mic } from 'lucide-react';
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
  narrative_brief?: string;
}

interface BriefCardProps {
  brief: Brief;
  onApprove: () => void | Promise<void>;
  onStartOver: () => void;
  approving?: boolean;
  /** True once concepts already exist — hides the approve button, keeps the card. */
  alreadyGenerated?: boolean;
}

function Pill({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="rounded-xl bg-brand-cream/60 px-4 py-3">
      <dt className="text-[10px] font-semibold uppercase tracking-widest text-brand-slate/60 mb-0.5">
        {label}
      </dt>
      <dd className="text-sm text-brand-navy leading-snug">{value}</dd>
    </div>
  );
}

function BulletList({ label, items }: { label: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="rounded-xl bg-brand-cream/60 px-4 py-3">
      <dt className="text-[10px] font-semibold uppercase tracking-widest text-brand-slate/60 mb-1.5">
        {label}
      </dt>
      <ul className="space-y-1">
        {items.map((s, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-brand-navy">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-forest/50" />
            {s}
          </li>
        ))}
      </ul>
    </div>
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
  const meta = ((s as any)._meta ?? {}) as { funnel_stage?: string; persona_name?: string };

  return (
    <div className="max-w-2xl mx-auto mt-6">
      {/* Narrative brief — shown when quiz source + persona selected */}
      {s.narrative_brief && (
        <div className="rounded-2xl border-2 border-brand-forest/15 bg-brand-forest/[0.03] px-5 py-5 mb-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-forest/50 mb-2">
            AUTO-GENERATED BRIEF — READY TO APPROVE
          </p>
          <p className="text-sm text-brand-navy leading-relaxed">{s.narrative_brief}</p>
          {(meta.persona_name || meta.funnel_stage) && (
            <p className="text-[11px] text-brand-slate/50 mt-3 pt-3 border-t border-brand-forest/10">
              Built from research
              {meta.persona_name && (
                <> · <span className="text-brand-forest font-medium">{meta.persona_name}</span></>
              )}
              {meta.funnel_stage && (
                <> · <span className="font-medium uppercase">{meta.funnel_stage}</span></>
              )}
            </p>
          )}
        </div>
      )}
      {/* Step header — matches quiz step numbering style */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-6 w-6 rounded-full bg-brand-forest flex items-center justify-center text-[11px] font-bold text-white">
            ✓
          </div>
          <span className="text-xs font-medium text-brand-slate">Brief ready — review before generating</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-brand-forest">
          Here's what Claude built
        </h2>
        <p className="text-sm text-brand-slate mt-1">
          Review the structured brief. If it looks right, approve it — Claude will generate concept directions next.
        </p>
      </div>

      {/* Objective echo */}
      <div className="rounded-2xl border border-brand-forest/10 bg-white px-5 py-4 mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-slate/60 mb-1">
          Your objective
        </p>
        <p className="text-sm text-brand-navy leading-relaxed">{brief.objective ?? '—'}</p>
        <div className="flex gap-2 mt-3 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[11px] bg-brand-cream px-2.5 py-1 rounded-full text-brand-slate font-medium">
            Strictness: <span className="text-brand-forest">{brief.strictness}</span>
          </span>
          {brief.wild_card && (
            <span className="inline-flex items-center gap-1 text-[11px] bg-amber-50 px-2.5 py-1 rounded-full text-amber-700 font-medium border border-amber-200/60">
              🎲 Wild card on
            </span>
          )}
        </div>
      </div>

      {/* Brief sections */}
      <div className="rounded-3xl border border-brand-forest/10 bg-white shadow-sm p-6 sm:p-8 space-y-6">

        {/* Audience */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-brand-forest/60" />
            <h3 className="text-sm font-bold text-brand-forest uppercase tracking-wide">Audience</h3>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Pill label="Primary" value={s.audience?.primary} />
            <Pill label="Context" value={s.audience?.context} />
            <BulletList label="Pains" items={s.audience?.pains} />
            <BulletList label="Jobs to be done" items={s.audience?.jobs_to_be_done} />
          </dl>
        </section>

        <div className="h-px bg-brand-forest/8" />

        {/* Offer */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Gift className="h-4 w-4 text-brand-forest/60" />
            <h3 className="text-sm font-bold text-brand-forest uppercase tracking-wide">Offer</h3>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Pill label="Core promise" value={s.offer?.core_promise} />
            <Pill label="Mechanism" value={s.offer?.mechanism} />
            <BulletList label="Proof points" items={s.offer?.proof_points} />
            <Pill label="CTA" value={s.offer?.cta} />
          </dl>
        </section>

        <div className="h-px bg-brand-forest/8" />

        {/* Hypothesis + Tone */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="h-4 w-4 text-brand-gold" />
            <h3 className="text-sm font-bold text-brand-forest uppercase tracking-wide">Strategy</h3>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Pill label="Hypothesis" value={s.hypothesis} />
            <Pill label="Tone direction" value={s.tone_direction} />
          </dl>
        </section>

        {s.wild_card_interpretation && (
          <>
            <div className="h-px bg-brand-forest/8" />
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Mic className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-bold text-amber-600 uppercase tracking-wide">Wild-card interpretation</h3>
              </div>
              <div className="rounded-xl border border-amber-200/60 bg-amber-50/60 px-4 py-3">
                <p className="text-sm text-brand-navy">{s.wild_card_interpretation}</p>
              </div>
            </section>
          </>
        )}

        {/* Navigation — matches quiz step nav */}
        {!alreadyGenerated && (
          <div className="flex items-center justify-between pt-5 border-t border-brand-forest/8">
            <button
              onClick={onStartOver}
              disabled={approving}
              className="flex items-center gap-1.5 text-sm font-medium rounded-lg px-3 py-2 transition-colors text-brand-slate hover:text-brand-forest hover:bg-brand-cream disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCcw className="h-4 w-4" /> Start over
            </button>
            <Button
              onClick={onApprove}
              disabled={approving}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {approving ? 'Generating concepts…' : 'Looks good — generate concepts'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
