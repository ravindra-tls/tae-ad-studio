'use client';

/**
 * Step 1 of the brief-first shell. Captures the marketer's freeform objective
 * plus the two controls that ride with it: brand-voice strictness and the
 * wild-card toggle.
 *
 * Submits to /api/pipeline/brief via the parent workspace. This component is
 * presentation + local form state only — no fetch lives here.
 */

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';

type Strictness = 'off' | 'loose' | 'tight';

interface BriefFormProps {
  productName: string;
  onSubmit: (input: {
    objective: string;
    strictness: Strictness;
    wild_card: boolean;
  }) => void | Promise<void>;
  loading?: boolean;
}

const STRICTNESS_OPTIONS: Array<{
  value: Strictness;
  label: string;
  hint: string;
}> = [
  { value: 'off',   label: 'Off',   hint: 'Voice is a hint. Chase performance angles.' },
  { value: 'loose', label: 'Loose', hint: 'Default. Stretch the voice without breaking it.' },
  { value: 'tight', label: 'Tight', hint: 'Brand voice is a hard constraint.' },
];

export function BriefForm({ productName, onSubmit, loading }: BriefFormProps) {
  const [objective, setObjective] = useState('');
  const [strictness, setStrictness] = useState<Strictness>('loose');
  const [wildCard, setWildCard] = useState(false);

  const canSubmit = objective.trim().length >= 10 && !loading;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({ objective: objective.trim(), strictness, wild_card: wildCard });
  }

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="objective" className="block text-sm font-semibold text-brand-forest">
            What should this ad do?
          </label>
          <p className="text-xs text-brand-slate mt-1">
            Plain English works best. Tell Claude the audience, the pain you&apos;re
            chasing, and what success looks like &mdash; for{' '}
            <span className="font-medium text-brand-forest">{productName}</span>.
          </p>
          <Textarea
            id="objective"
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="e.g. Convince 30-45yr women who tried ashwagandha gummies and got zero results that our root-form extract actually works, by day 14."
            rows={5}
            maxLength={4000}
            className="mt-2"
            disabled={loading}
          />
          <div className="mt-1 flex items-center justify-between text-xs text-brand-slate">
            <span>
              {objective.trim().length < 10
                ? 'At least 10 characters'
                : `${objective.trim().length} chars`}
            </span>
            <span>{objective.length}/4000</span>
          </div>
        </div>

        {/* Strictness + wild card row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <fieldset>
            <legend className="text-sm font-semibold text-brand-forest">
              Brand-voice strictness
            </legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {STRICTNESS_OPTIONS.map((opt) => {
                const active = strictness === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setStrictness(opt.value)}
                    disabled={loading}
                    className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                      active
                        ? 'border-brand-teal bg-brand-teal text-white shadow-sm'
                        : 'border-brand-teal/20 bg-white text-brand-teal hover:bg-brand-cream'
                    }`}
                    title={opt.hint}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-brand-slate">
              {STRICTNESS_OPTIONS.find((o) => o.value === strictness)?.hint}
            </p>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-semibold text-brand-forest">Wild card</legend>
            <label className="mt-2 flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={wildCard}
                onChange={(e) => setWildCard(e.target.checked)}
                disabled={loading}
                className="mt-1 h-4 w-4 rounded border-brand-teal/30 text-brand-teal focus:ring-brand-teal"
              />
              <span className="text-sm text-brand-navy">
                Let one concept subvert the brief.
                <span className="block text-xs text-brand-slate mt-0.5">
                  Other concepts stay on-brief. Leave off if you&apos;re iterating on a tested angle.
                </span>
              </span>
            </label>
          </fieldset>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="submit" disabled={!canSubmit} variant="default">
            <Sparkles className="h-4 w-4 mr-2" />
            {loading ? 'Drafting brief…' : 'Draft brief'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
