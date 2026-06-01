'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { PositioningResearch, ResearchPersona } from '@/lib/research/types';

export interface BriefQuizV2Props {
  productName: string;
  research: PositioningResearch | null;
  onSubmit: (input: {
    objective: string;
    strictness: 'off' | 'loose' | 'tight';
    wild_card: boolean;
    funnel_stage: 'tofu' | 'mofu' | 'bofu';
    persona_name: string;
  }) => void | Promise<void>;
  loading?: boolean;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type FunnelStage = 'tofu' | 'mofu' | 'bofu';

interface FunnelOption {
  title: string;
  subtitle: string;
  tag: string;
  value: FunnelStage;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FUNNEL_OPTIONS: FunnelOption[] = [
  {
    title: 'Top of funnel',
    subtitle: "Stop the scroll. Awareness. They've never heard of us.",
    tag: 'Emotion-led · broad hook',
    value: 'tofu',
  },
  {
    title: 'Middle of funnel',
    subtitle: 'They know the category. Building trust and preference.',
    tag: 'Proof-led · comparison',
    value: 'mofu',
  },
  {
    title: 'Bottom of funnel',
    subtitle: 'Retargeting warm audiences. Convert now.',
    tag: 'Urgency-led · offer',
    value: 'bofu',
  },
];

// ── Helper: build objective string ───────────────────────────────────────────

function buildObjective(
  funnelStage: FunnelStage,
  persona: ResearchPersona,
  research: PositioningResearch,
): string {
  const funnelDescriptions = {
    tofu: 'TOP-OF-FUNNEL (awareness): Write for someone who has never heard of this brand. Lead with emotion and a broad, pattern-interrupting hook that makes the problem vivid before any brand claim. No hard sell — the goal is to stop the scroll and plant the seed.',
    mofu: 'MIDDLE-OF-FUNNEL (consideration): Write for someone who knows the category but has not committed. Use proof, comparison, and credibility to build trust. The CTA should invite learning — read the story, watch the video — not buy now.',
    bofu: 'BOTTOM-OF-FUNNEL (conversion): Write for a warm, retargeting audience with real purchase intent. Lead with urgency, a compelling offer, and social proof. The CTA must convert immediately.',
  };

  return [
    `FUNNEL: ${funnelDescriptions[funnelStage]}`,
    '',
    `PERSONA: ${persona.archetype_name} (${persona.age_range}, ${persona.location})`,
    `Persona tagline: "${persona.tagline}"`,
    '',
    `Her deepest fears: ${persona.deepest_fears.slice(0, 3).join(' | ')}`,
    `Her deepest desires: ${persona.deepest_desires.slice(0, 3).join(' | ')}`,
    persona.verbatim_quotes.length > 0
      ? `Her actual words:\n${persona.verbatim_quotes.slice(0, 2).map((q: string) => `• "${q}"`).join('\n')}`
      : '',
    persona.emotional_triggers.slice(0, 3).length > 0
      ? `Emotional triggers: ${persona.emotional_triggers.slice(0, 3).map((t: { label: string; description: string }) => `${t.label} — ${t.description}`).join(' | ')}`
      : '',
    '',
    `Market: ${research.market} | Segment: ${research.segment}`,
  ]
    .filter(Boolean)
    .join('\n');
}

// ── Progress indicator ────────────────────────────────────────────────────────

const STEP_LABELS = ['Funnel', 'Persona', 'Research', 'Brief'];

function ProgressBar({ currentStep }: { currentStep: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEP_LABELS.map((label, idx) => {
        const stepNum = idx + 1;
        const isDone = currentStep > stepNum;
        const isCurrent = currentStep === stepNum;
        // Step 4 (Brief) is always future — handled by parent
        const isFuture = stepNum > currentStep;

        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                  isDone
                    ? 'bg-brand-forest text-white'
                    : isCurrent
                      ? 'bg-brand-forest text-white ring-4 ring-brand-forest/20'
                      : 'bg-brand-forest/10 text-brand-forest/40',
                )}
              >
                {isDone ? <Check className="h-3.5 w-3.5" /> : stepNum}
              </div>
              <span
                className={cn(
                  'text-[10px] font-medium transition-colors',
                  isCurrent
                    ? 'text-brand-forest'
                    : isDone
                      ? 'text-brand-forest/60'
                      : 'text-brand-slate/40',
                )}
              >
                {label}
              </span>
            </div>
            {idx < STEP_LABELS.length - 1 && (
              <div
                className={cn(
                  'h-px w-10 sm:w-16 mx-1 mb-4 transition-colors',
                  isDone ? 'bg-brand-forest/40' : 'bg-brand-forest/10',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Drafting screen (shown while loading) ─────────────────────────────────────

function DraftingScreen() {
  const msgs = [
    'Reading the persona…',
    'Matching funnel stage…',
    'Structuring the brief…',
    'Sharpening the hook…',
    'Almost there…',
  ];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % msgs.length), 2000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-6 text-center">
      <div
        className="relative h-24 w-24 rounded-full flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg,#3A5340,#C4963F)' }}
      >
        <div
          className="absolute inset-0 rounded-full animate-ping opacity-20"
          style={{ background: 'linear-gradient(135deg,#3A5340,#D0DD61)' }}
        />
        <Loader2 className="h-10 w-10 text-white animate-spin" />
      </div>
      <div>
        <p className="text-lg font-bold text-brand-forest">Drafting your brief…</p>
        <p className="text-sm text-brand-slate mt-1">{msgs[i]}</p>
      </div>
      <p className="text-xs text-brand-slate/60 max-w-xs">
        Claude is turning your answers into a structured creative brief. Usually takes 10–20
        seconds.
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BriefQuizV2({ productName, research, onSubmit, loading }: BriefQuizV2Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [funnelStage, setFunnelStage] = useState<FunnelStage | null>(null);
  const [selectedPersonaIdx, setSelectedPersonaIdx] = useState<number | null>(null);
  const [customPersona, setCustomPersona] = useState('');

  const personas = research?.personas ?? [];

  // Derived: the currently selected persona (if using research personas)
  const selectedPersona: ResearchPersona | null =
    selectedPersonaIdx !== null && personas.length > 0 ? (personas[selectedPersonaIdx] ?? null) : null;

  // ── Step 1: Funnel Stage ────────────────────────────────────────────────────

  function renderStep1() {
    return (
      <div>
        <div className="mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-brand-forest">
            Where is this ad in the funnel?
          </h2>
          <p className="text-sm text-brand-slate mt-1.5">
            This shapes everything — the hook, the offer, the CTA. Pick one.
          </p>
        </div>

        <div className="space-y-3">
          {FUNNEL_OPTIONS.map((opt) => {
            const isSelected = funnelStage === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFunnelStage(opt.value)}
                className={cn(
                  'relative w-full text-left rounded-2xl border-2 px-5 py-4 transition-all',
                  isSelected
                    ? 'border-brand-forest bg-brand-forest/5'
                    : 'border-brand-forest/15 bg-white hover:border-brand-forest/40',
                )}
              >
                {isSelected && (
                  <span className="absolute top-3 right-3 h-5 w-5 rounded-full bg-brand-forest flex items-center justify-center">
                    <Check className="h-3 w-3 text-white" />
                  </span>
                )}
                <p className="font-bold text-brand-navy text-sm">{opt.title}</p>
                <p className="text-xs text-brand-slate mt-0.5 leading-snug pr-6">
                  {opt.subtitle}
                </p>
                <span className="inline-block mt-2 text-[10px] font-semibold uppercase tracking-widest text-brand-forest/60 bg-brand-forest/8 rounded-full px-2.5 py-0.5">
                  {opt.tag}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex justify-end mt-6">
          <Button
            onClick={() => setStep(2)}
            disabled={!funnelStage}
            className="gap-2"
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // ── Step 2: Micro-persona ───────────────────────────────────────────────────

  function renderStep2() {
    return (
      <div>
        <div className="mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-brand-forest">
            Who is this ad for?
          </h2>
          <p className="text-sm text-brand-slate mt-1.5">
            Pick a specific human being, not a demographic band. Each persona is built from real
            language — Reddit threads, product reviews, forum posts.
          </p>
        </div>

        {personas.length > 0 ? (
          <div className="space-y-3">
            {personas.map((persona, idx) => {
              const isSelected = selectedPersonaIdx === idx;
              // First sentence of tagline, capped at 2 lines via CSS
              const taglinePreview = persona.tagline.split(/[.!?]/)[0]?.trim() ?? persona.tagline;
              return (
                <button
                  key={persona.archetype_name}
                  type="button"
                  onClick={() => setSelectedPersonaIdx(idx)}
                  className={cn(
                    'relative w-full text-left rounded-2xl border-2 px-5 py-4 transition-all',
                    isSelected
                      ? 'border-brand-forest bg-brand-forest/5'
                      : 'border-brand-forest/15 bg-white hover:border-brand-forest/40',
                  )}
                >
                  {isSelected && (
                    <span className="absolute top-3 right-3 h-5 w-5 rounded-full bg-brand-forest flex items-center justify-center">
                      <Check className="h-3 w-3 text-white" />
                    </span>
                  )}
                  <p className="font-bold text-brand-navy text-sm pr-6">
                    {persona.archetype_name}
                  </p>
                  <p className="text-xs text-brand-slate/70 mt-0.5">
                    {persona.age_range} · {persona.location}
                  </p>
                  <p className="text-xs text-brand-slate mt-1.5 leading-snug line-clamp-2 pr-6">
                    {taglinePreview}
                  </p>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            <label
              htmlFor="custom-persona"
              className="block text-sm font-medium text-brand-navy"
            >
              Describe your target persona
            </label>
            <textarea
              id="custom-persona"
              value={customPersona}
              onChange={(e) => setCustomPersona(e.target.value)}
              placeholder="e.g. Women 45-55 experiencing hot flashes who've tried herbal remedies before…"
              rows={4}
              className="w-full rounded-2xl border border-brand-forest/20 bg-white px-4 py-3 text-sm text-brand-navy placeholder:text-brand-slate/40 focus:outline-none focus:ring-2 focus:ring-brand-forest/30 resize-none"
            />
          </div>
        )}

        <div className="flex items-center justify-between mt-6">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="flex items-center gap-1.5 text-sm font-medium rounded-lg px-3 py-2 transition-colors text-brand-slate hover:text-brand-forest hover:bg-brand-cream"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          <Button
            onClick={() => setStep(3)}
            disabled={personas.length > 0 ? selectedPersonaIdx === null : customPersona.trim().length === 0}
            className="gap-2"
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // ── Step 3: Research Surface ────────────────────────────────────────────────

  function renderStep3() {
    // If using custom persona (no research), show a minimal review + submit
    if (!selectedPersona || !research) {
      return (
        <div>
          <div className="mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-brand-forest">
              Ready to build your brief
            </h2>
            <p className="text-sm text-brand-slate mt-1.5">
              Claude will use your funnel stage and persona description to build a focused creative
              brief.
            </p>
          </div>

          <div className="rounded-2xl border border-brand-forest/10 bg-brand-cream/30 px-5 py-4 text-sm text-brand-navy leading-relaxed">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-slate/60 mb-1">
              Persona description
            </p>
            <p>{customPersona}</p>
          </div>

          <div className="flex items-center justify-between mt-6">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex items-center gap-1.5 text-sm font-medium rounded-lg px-3 py-2 transition-colors text-brand-slate hover:text-brand-forest hover:bg-brand-cream"
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            <Button
              onClick={() => {
                if (!funnelStage) return;
                void onSubmit({
                  objective: customPersona.trim(),
                  strictness: 'loose',
                  wild_card: false,
                  funnel_stage: funnelStage,
                  persona_name: customPersona.trim().slice(0, 200),
                });
              }}
              disabled={!funnelStage || loading}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Generate brief
            </Button>
          </div>
        </div>
      );
    }

    // Research-backed persona surface
    return (
      <div>
        {/* Persona header */}
        <div className="mb-5">
          <h2 className="text-xl sm:text-2xl font-bold text-brand-forest">
            {selectedPersona.archetype_name}
          </h2>
          <p className="text-sm text-brand-slate mt-0.5">
            {selectedPersona.age_range} · {selectedPersona.location}
          </p>
        </div>

        {/* Verbatim quotes */}
        {selectedPersona.verbatim_quotes.length > 0 && (
          <div className="space-y-3 mb-5">
            {selectedPersona.verbatim_quotes.slice(0, 2).map((quote, idx) => (
              <blockquote
                key={idx}
                className="border-l-2 border-brand-forest/30 pl-4 italic text-sm text-brand-navy leading-relaxed"
              >
                "{quote}"
              </blockquote>
            ))}
          </div>
        )}

        {/* What drives her — two column grid */}
        <div className="mb-5">
          <p className="text-xs font-bold text-brand-forest uppercase tracking-widest mb-3">
            What drives her
          </p>
          <div className="grid grid-cols-2 gap-3">
            {/* Fears */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-red-500/70 mb-2">
                Fears
              </p>
              <div className="flex flex-wrap gap-1.5">
                {selectedPersona.deepest_fears.slice(0, 3).map((fear, idx) => (
                  <span
                    key={idx}
                    className="bg-red-50 text-red-700 text-xs rounded-full px-3 py-1"
                  >
                    {fear}
                  </span>
                ))}
              </div>
            </div>
            {/* Desires */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600/70 mb-2">
                Desires
              </p>
              <div className="flex flex-wrap gap-1.5">
                {selectedPersona.deepest_desires.slice(0, 3).map((desire, idx) => (
                  <span
                    key={idx}
                    className="bg-emerald-50 text-emerald-700 text-xs rounded-full px-3 py-1"
                  >
                    {desire}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Emotional triggers */}
        {selectedPersona.emotional_triggers.length > 0 && (
          <div className="mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-forest/60 mb-2">
              Emotional triggers
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedPersona.emotional_triggers.map((trigger, idx) => (
                <div
                  key={idx}
                  className="border border-brand-forest/15 rounded-xl px-3 py-2 max-w-[200px]"
                >
                  <p className="text-xs font-bold text-brand-navy">{trigger.label}</p>
                  <p className="text-[11px] text-brand-slate mt-0.5 leading-snug">
                    {trigger.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Her language */}
        {research.language_guide.words_she_uses.length > 0 && (
          <div className="mb-6">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-forest/60 mb-2">
              Her language
            </p>
            <div className="flex flex-wrap gap-1.5">
              {research.language_guide.words_she_uses.map((word, idx) => (
                <span
                  key={idx}
                  className="bg-brand-cream text-brand-forest text-xs rounded-full px-2.5 py-1"
                >
                  {word}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-brand-forest/8">
          <button
            type="button"
            onClick={() => setStep(2)}
            className="flex items-center gap-1.5 text-sm font-medium rounded-lg px-3 py-2 transition-colors text-brand-slate hover:text-brand-forest hover:bg-brand-cream"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          <Button
            onClick={() => {
              if (!funnelStage || !selectedPersona || !research) return;
              const objective = buildObjective(funnelStage, selectedPersona, research);
              void onSubmit({
                objective,
                strictness: 'loose',
                wild_card: false,
                funnel_stage: funnelStage,
                persona_name: selectedPersona.archetype_name,
              });
            }}
            disabled={!funnelStage || loading}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Generate brief
          </Button>
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <ProgressBar currentStep={step} />
        <DraftingScreen />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <ProgressBar currentStep={step} />

      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
    </div>
  );
}
