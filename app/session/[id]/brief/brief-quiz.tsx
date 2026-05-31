'use client';

/**
 * Gamified quiz replacement for BriefForm.
 *
 * 7 questions + 1 animated transition, rendered one at a time with slide
 * animations. On completion the answers are assembled into a rich objective
 * string and passed to onSubmit — the same API contract as BriefForm.
 *
 * Question types:
 *   persona-grid  — 6 illustrated persona cards (Q1: audience)
 *   speech-bubble — pain-point speech bubbles   (Q2: blocker)
 *   [transition]  — animated encouragement beat
 *   emotion-grid  — colour-coded emotion cards  (Q3: feeling)
 *   chips         — pill buttons                (Q4: CTA)
 *   text-input    — optional free text          (Q5: key claims)
 *   voice-cards   — 3 illustrated voice cards   (Q6: strictness)
 *   wild-toggle   — big illustrated YES/NO      (Q7: wild card)
 */

import { useState, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, Zap, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type Strictness = 'off' | 'loose' | 'tight';

export interface BriefQuizProps {
  productName: string;
  onSubmit: (input: {
    objective: string;
    strictness: Strictness;
    wild_card: boolean;
  }) => void | Promise<void>;
  loading?: boolean;
}

// ─── Answer shape ─────────────────────────────────────────────────────────────

interface QuizAnswers {
  audience:      string; // preset value or 'custom'
  audienceText:  string; // filled when audience === 'custom'
  blocker:       string;
  blockerText:   string;
  emotion:       string;
  cta:           string;
  keyDetails:    string; // optional
  voice:         'off' | 'balanced' | 'tight';
  wildCard:      boolean | null;
}

const EMPTY: QuizAnswers = {
  audience:     '',
  audienceText: '',
  blocker:      '',
  blockerText:  '',
  emotion:      '',
  cta:          '',
  keyDetails:   '',
  voice:        'balanced',
  wildCard:     null,
};

// ─── Step config ──────────────────────────────────────────────────────────────

type StepType = 'persona-grid' | 'speech-bubble' | 'transition' | 'emotion-grid'
              | 'chips' | 'text-input' | 'voice-cards' | 'wild-toggle';

interface Step {
  type:        StepType;
  questionNum?: number;   // shown in progress bar (omit for transitions)
  title?:      string;
  subtitle?:   string;
  field?:      keyof QuizAnswers;
  options?:    Option[];
  optional?:   boolean;
  // transition-only
  emoji?:      string;
  message?:    string;
}

interface Option {
  value:    string;
  label:    string;
  sub?:     string;
  emoji?:   string;
  color?:   string;   // tailwind bg class
  textColor?: string;
}

const STEPS: Step[] = [
  // ── Q1: Audience ──────────────────────────────────────────────────────────
  {
    type:        'persona-grid',
    questionNum: 1,
    field:       'audience',
    title:       'Who are we talking to?',
    subtitle:    `Pick the closest match for your ${''} ad audience.`,
    options: [
      { value: 'women-30-45',   label: 'Women 30–45',          sub: 'Prime skincare & wellness window',  emoji: '💆‍♀️' },
      { value: 'women-45plus',  label: 'Women 45+',            sub: 'Anti-aging, confidence, longevity', emoji: '👩‍🦳' },
      { value: 'men-25-40',     label: 'Men 25–40',            sub: 'Performance, energy, modern wellness',emoji: '🧑' },
      { value: 'men-45plus',    label: 'Men 45+',              sub: 'Vitality, joints, strength',         emoji: '👨‍🦳' },
      { value: 'wellness-all',  label: 'Wellness seekers',     sub: 'Any age, actively health-conscious', emoji: '🌿' },
      { value: 'custom',        label: 'Describe my own →',   sub: 'I have a specific persona in mind',   emoji: '✍️' },
    ],
  },

  // ── Q2: Blocker ───────────────────────────────────────────────────────────
  {
    type:        'speech-bubble',
    questionNum: 2,
    field:       'blocker',
    title:       "What's holding them back?",
    subtitle:    'Pick the belief or fear that stops them from buying.',
    options: [
      { value: 'tried-before',  label: '"I\'ve tried things like this — nothing ever works for me."', emoji: '😔' },
      { value: 'no-trust',      label: '"Brand claims are all hype. Show me real proof."',           emoji: '🤨' },
      { value: 'slow-results',  label: '"I don\'t have months to wait — I need results fast."',      emoji: '⏳' },
      { value: 'ingredients',   label: '"What\'s actually in this? I care about what I put on/in my body."', emoji: '🔍' },
      { value: 'too-expensive', label: '"It feels too expensive for what it is."',                   emoji: '💸' },
      { value: 'custom',        label: 'Something else…',                                            emoji: '💬' },
    ],
  },

  // ── Transition ────────────────────────────────────────────────────────────
  {
    type:    'transition',
    emoji:   '✨',
    message: 'Now let\'s talk about the feeling you want to create',
  },

  // ── Q3: Emotion ───────────────────────────────────────────────────────────
  {
    type:        'emotion-grid',
    questionNum: 3,
    field:       'emotion',
    title:       'What should hit them instantly?',
    subtitle:    'Pick the emotional gut-reaction you\'re engineering.',
    options: [
      { value: 'hope',      label: 'HOPE',      sub: '"Finally, something that might actually work for me."',  emoji: '🌟', color: 'bg-emerald-50',  textColor: 'text-emerald-700' },
      { value: 'urgency',   label: 'URGENCY',   sub: '"I need this NOW before I miss out."',                   emoji: '⚡', color: 'bg-orange-50',  textColor: 'text-orange-700' },
      { value: 'curiosity', label: 'CURIOSITY', sub: '"Wait… how does that even work?"',                       emoji: '🧪', color: 'bg-violet-50',  textColor: 'text-violet-700' },
      { value: 'trust',     label: 'TRUST',     sub: '"These people actually get my struggle."',               emoji: '🤝', color: 'bg-sky-50',     textColor: 'text-sky-700'    },
      { value: 'surprise',  label: 'SURPRISE',  sub: '"I didn\'t expect this to be so different."',            emoji: '😲', color: 'bg-pink-50',    textColor: 'text-pink-700'   },
      { value: 'delight',   label: 'DELIGHT',   sub: '"This is exactly my life — lol."',                       emoji: '😂', color: 'bg-yellow-50',  textColor: 'text-yellow-700' },
    ],
  },

  // ── Q4: CTA ───────────────────────────────────────────────────────────────
  {
    type:        'chips',
    questionNum: 4,
    field:       'cta',
    title:       'What should they do after seeing this?',
    subtitle:    'One desired action. Pick the most important one.',
    options: [
      { value: 'shop-now',     label: '🛒  Shop Now',       sub: 'Direct to purchase' },
      { value: 'learn-more',   label: '📖  Learn More',     sub: 'Education first' },
      { value: 'watch-video',  label: '🎬  Watch the Video', sub: 'Engagement-led' },
      { value: 'save-later',   label: '📌  Save for Later', sub: 'Consideration stage' },
      { value: 'tag-friend',   label: '👯  Tag a Friend',   sub: 'Shareability goal' },
    ],
  },

  // ── Q5: Key details (optional) ────────────────────────────────────────────
  {
    type:        'text-input',
    questionNum: 5,
    field:       'keyDetails',
    optional:    true,
    title:       'Any specific claims or details?',
    subtitle:    'Timeframe, stat, promo, hero ingredient — or skip if none.',
  },

  // ── Q6: Voice level ───────────────────────────────────────────────────────
  {
    type:        'voice-cards',
    questionNum: 6,
    field:       'voice',
    title:       'How should we handle brand voice?',
    subtitle:    'This controls how tightly Claude sticks to your brand script.',
    options: [
      { value: 'off',      label: 'Chase Performance',  sub: 'Voice is a guide. Push angles that convert, even if they stretch the script.',  emoji: '🎨' },
      { value: 'balanced', label: 'Balanced',           sub: 'Default. On-brand but flexible — the best of both worlds.',                     emoji: '✅' },
      { value: 'tight',    label: 'Brand-strict',       sub: 'Voice is sacred. Every word must align with brand guidelines. No exceptions.',  emoji: '📐' },
    ],
  },

  // ── Q7: Wild card ─────────────────────────────────────────────────────────
  {
    type:        'wild-toggle',
    questionNum: 7,
    field:       'wildCard',
    title:       'Want one concept that breaks the mold?',
    subtitle:    'Claude will generate one wildly unexpected take alongside the safe ones.',
    options: [
      { value: 'yes', label: '🎲  Yes, surprise me',   sub: 'One concept can challenge the brief entirely. Keeps creativity fresh.' },
      { value: 'no',  label: '🎯  Keep it on-strategy', sub: 'All concepts stay close to the brief. Better when iterating on a proven angle.' },
    ],
  },
];

const TOTAL_QUESTIONS = STEPS.filter((s) => s.questionNum !== undefined).length;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildObjective(a: QuizAnswers): string {
  const audienceLabel: Record<string, string> = {
    'women-30-45':  'women aged 30–45',
    'women-45plus': 'women 45+',
    'men-25-40':    'men aged 25–40',
    'men-45plus':   'men 45+',
    'wellness-all': 'health-conscious adults',
    'custom':       a.audienceText,
  };
  const blockerLabel: Record<string, string> = {
    'tried-before':  'they\'ve tried similar products before and got no results',
    'no-trust':      'they don\'t trust brand claims and need real proof',
    'slow-results':  'they want results fast and can\'t wait months',
    'ingredients':   'they care deeply about ingredients and transparency',
    'too-expensive': 'they feel the price doesn\'t justify the value yet',
    'custom':        a.blockerText,
  };
  const emotionLabel: Record<string, string> = {
    'hope':     'hopeful ("finally, something that might work")',
    'urgency':  'urgent ("I need this now")',
    'curiosity':'curious ("how does this even work?")',
    'trust':    'reassured ("these people get my struggle")',
    'surprise': 'surprised ("I didn\'t expect this to be different")',
    'delight':  'delighted and entertained',
  };
  const ctaLabel: Record<string, string> = {
    'shop-now':    'click to shop now',
    'learn-more':  'click to learn more',
    'watch-video': 'watch the brand video',
    'save-later':  'save or bookmark for later',
    'tag-friend':  'tag a friend',
  };

  const audience = audienceLabel[a.audience] || a.audienceText || a.audience;
  const blocker  = blockerLabel[a.blocker]   || a.blockerText  || a.blocker;
  const emotion  = emotionLabel[a.emotion]   || a.emotion;
  const cta      = ctaLabel[a.cta]           || a.cta;

  const parts = [
    `Target audience: ${audience}.`,
    `Their main barrier: ${blocker}.`,
    `The ad should make them feel ${emotion}.`,
    `Desired action: ${cta}.`,
    a.keyDetails.trim() ? `Key details to include: ${a.keyDetails.trim()}.` : '',
  ].filter(Boolean);

  return parts.join(' ');
}

function getStrictness(voice: QuizAnswers['voice']): Strictness {
  if (voice === 'off')      return 'off';
  if (voice === 'tight')    return 'tight';
  return 'loose';
}

function stepIsAnswered(step: Step, answers: QuizAnswers): boolean {
  if (step.type === 'transition') return true;
  if (step.optional) return true;
  const field = step.field;
  if (!field) return true;
  const val = answers[field];
  if (field === 'audience') return !!(val && (val !== 'custom' || answers.audienceText.trim()));
  if (field === 'blocker')  return !!(val && (val !== 'custom' || answers.blockerText.trim()));
  if (field === 'voice')    return !!val;
  if (field === 'wildCard') return val !== null;
  return typeof val === 'string' ? val.trim().length > 0 : val !== null;
}

// ─── Sub-renderers ────────────────────────────────────────────────────────────

function PersonaGrid({ step, answers, setAnswers }: {
  step: Step; answers: QuizAnswers; setAnswers: (a: QuizAnswers) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {step.options!.map((opt) => {
          const selected = answers.audience === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => setAnswers({ ...answers, audience: opt.value })}
              className={cn(
                'relative flex flex-col items-center gap-2 rounded-2xl border-2 p-4 text-center transition-all duration-200',
                'hover:border-brand-forest hover:shadow-md hover:-translate-y-0.5',
                selected
                  ? 'border-brand-forest bg-brand-forest/5 shadow-md -translate-y-0.5'
                  : 'border-brand-forest/15 bg-white',
              )}
            >
              <span className="text-3xl">{opt.emoji}</span>
              <span className={cn('text-sm font-semibold', selected ? 'text-brand-forest' : 'text-brand-slate')}>
                {opt.label}
              </span>
              <span className="text-[11px] text-brand-slate/70 leading-snug">{opt.sub}</span>
              {selected && (
                <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-brand-forest flex items-center justify-center">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>
      {answers.audience === 'custom' && (
        <div className="mt-3">
          <textarea
            autoFocus
            value={answers.audienceText}
            onChange={(e) => setAnswers({ ...answers, audienceText: e.target.value })}
            placeholder="e.g. Busy Indian women 35–50 who've tried Ayurvedic skincare before..."
            rows={3}
            className="w-full rounded-xl border-2 border-brand-forest/20 px-4 py-3 text-sm focus:border-brand-forest focus:outline-none resize-none"
          />
        </div>
      )}
    </div>
  );
}

function SpeechBubbles({ step, answers, setAnswers }: {
  step: Step; answers: QuizAnswers; setAnswers: (a: QuizAnswers) => void;
}) {
  return (
    <div className="space-y-2.5">
      {step.options!.map((opt) => {
        const selected = answers.blocker === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => setAnswers({ ...answers, blocker: opt.value })}
            className={cn(
              'w-full flex items-center gap-4 rounded-2xl border-2 px-5 py-4 text-left transition-all duration-200',
              'hover:border-brand-forest hover:shadow-sm',
              selected
                ? 'border-brand-forest bg-brand-forest/5 shadow-sm'
                : 'border-brand-forest/15 bg-white',
            )}
          >
            <span className="text-2xl shrink-0">{opt.emoji}</span>
            <span className={cn('text-sm leading-snug', selected ? 'text-brand-forest font-medium' : 'text-brand-navy')}>
              {opt.label}
            </span>
            {selected && (
              <div className="ml-auto shrink-0 h-5 w-5 rounded-full bg-brand-forest flex items-center justify-center">
                <Check className="h-3 w-3 text-white" />
              </div>
            )}
          </button>
        );
      })}
      {answers.blocker === 'custom' && (
        <textarea
          autoFocus
          value={answers.blockerText}
          onChange={(e) => setAnswers({ ...answers, blockerText: e.target.value })}
          placeholder="Describe the belief or fear that stops them..."
          rows={3}
          className="w-full rounded-xl border-2 border-brand-forest/20 px-4 py-3 text-sm focus:border-brand-forest focus:outline-none resize-none mt-2"
        />
      )}
    </div>
  );
}

function EmotionGrid({ step, answers, setAnswers }: {
  step: Step; answers: QuizAnswers; setAnswers: (a: QuizAnswers) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {step.options!.map((opt) => {
        const selected = answers.emotion === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => setAnswers({ ...answers, emotion: opt.value })}
            className={cn(
              'flex flex-col items-start gap-2 rounded-2xl border-2 p-4 text-left transition-all duration-200',
              'hover:shadow-md hover:-translate-y-0.5',
              selected
                ? 'border-brand-forest shadow-md -translate-y-0.5 ' + opt.color
                : 'border-brand-forest/15 bg-white hover:border-brand-forest/40',
            )}
          >
            <span className="text-3xl">{opt.emoji}</span>
            <span className={cn(
              'text-xs font-bold tracking-widest uppercase',
              selected ? opt.textColor : 'text-brand-slate',
            )}>
              {opt.label}
            </span>
            <span className="text-[11px] text-brand-slate/70 leading-snug">{opt.sub}</span>
          </button>
        );
      })}
    </div>
  );
}

function Chips({ step, answers, setAnswers }: {
  step: Step; answers: QuizAnswers; setAnswers: (a: QuizAnswers) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {step.options!.map((opt) => {
        const selected = answers.cta === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => setAnswers({ ...answers, cta: opt.value })}
            className={cn(
              'flex items-center gap-4 rounded-2xl border-2 px-5 py-4 text-left transition-all duration-200',
              'hover:border-brand-forest hover:shadow-sm',
              selected
                ? 'border-brand-forest bg-brand-forest/5 shadow-sm'
                : 'border-brand-forest/15 bg-white',
            )}
          >
            <span className={cn('flex-1 text-sm font-semibold', selected ? 'text-brand-forest' : 'text-brand-navy')}>
              {opt.label}
            </span>
            <span className="text-xs text-brand-slate">{opt.sub}</span>
            {selected && (
              <div className="shrink-0 h-5 w-5 rounded-full bg-brand-forest flex items-center justify-center">
                <Check className="h-3 w-3 text-white" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function TextInput({ step, answers, setAnswers }: {
  step: Step; answers: QuizAnswers; setAnswers: (a: QuizAnswers) => void;
}) {
  return (
    <div className="space-y-3">
      <textarea
        value={answers.keyDetails}
        onChange={(e) => setAnswers({ ...answers, keyDetails: e.target.value })}
        placeholder="e.g. works in 14 days, 94% saw visible results, hero ingredient is Red Ginseng Root, ₹1,999 offer ends Sunday..."
        rows={5}
        className="w-full rounded-xl border-2 border-brand-forest/20 px-4 py-3 text-sm focus:border-brand-forest focus:outline-none resize-none"
      />
      <p className="text-xs text-brand-slate/60">
        This becomes part of Claude's brief — the more specific, the better the output.
        Leave blank to skip.
      </p>
    </div>
  );
}

function VoiceCards({ step, answers, setAnswers }: {
  step: Step; answers: QuizAnswers; setAnswers: (a: QuizAnswers) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {step.options!.map((opt) => {
        const selected = answers.voice === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => setAnswers({ ...answers, voice: opt.value as QuizAnswers['voice'] })}
            className={cn(
              'flex items-center gap-5 rounded-2xl border-2 px-5 py-4 text-left transition-all duration-200',
              'hover:border-brand-forest hover:shadow-sm',
              selected
                ? 'border-brand-forest bg-brand-forest/5 shadow-sm'
                : 'border-brand-forest/15 bg-white',
            )}
          >
            <span className="text-3xl shrink-0">{opt.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className={cn('text-sm font-bold', selected ? 'text-brand-forest' : 'text-brand-navy')}>
                {opt.label}
              </p>
              <p className="text-xs text-brand-slate mt-0.5 leading-snug">{opt.sub}</p>
            </div>
            <div className={cn(
              'shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all',
              selected ? 'border-brand-forest bg-brand-forest' : 'border-brand-slate/30',
            )}>
              {selected && <Check className="h-3 w-3 text-white" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function WildToggle({ step, answers, setAnswers }: {
  step: Step; answers: QuizAnswers; setAnswers: (a: QuizAnswers) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {step.options!.map((opt) => {
        const val = opt.value === 'yes';
        const selected = answers.wildCard === val;
        return (
          <button
            key={opt.value}
            onClick={() => setAnswers({ ...answers, wildCard: val })}
            className={cn(
              'flex flex-col items-center gap-4 rounded-2xl border-2 px-6 py-8 text-center transition-all duration-200',
              'hover:shadow-lg hover:-translate-y-1',
              selected
                ? 'border-brand-forest bg-brand-forest/5 shadow-lg -translate-y-1'
                : 'border-brand-forest/15 bg-white',
            )}
          >
            <span className="text-5xl">{opt.value === 'yes' ? '🎲' : '🎯'}</span>
            <p className={cn('text-base font-bold', selected ? 'text-brand-forest' : 'text-brand-navy')}>
              {opt.label}
            </p>
            <p className="text-xs text-brand-slate leading-relaxed">{opt.sub}</p>
            {selected && (
              <div className="h-7 w-7 rounded-full bg-brand-forest flex items-center justify-center">
                <Check className="h-4 w-4 text-white" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Transition screen ────────────────────────────────────────────────────────

function TransitionScreen({ step, onContinue }: { step: Step; onContinue: () => void }) {
  useEffect(() => {
    const t = setTimeout(onContinue, 1800);
    return () => clearTimeout(t);
  }, [onContinue]);

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-6 text-center">
      <div
        className="h-24 w-24 rounded-full flex items-center justify-center text-5xl animate-bounce"
        style={{ background: 'linear-gradient(135deg, #E0CEAB 0%, #D0DD61 100%)' }}
      >
        {step.emoji}
      </div>
      <p className="text-xl font-semibold text-brand-forest max-w-xs">{step.message}</p>
      <div className="flex gap-1 mt-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-2 w-2 rounded-full bg-brand-forest/40 animate-pulse"
            style={{ animationDelay: `${i * 200}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Loading screen (while API drafts the brief) ──────────────────────────────

const DRAFTING_MESSAGES = [
  'Reading between the lines…',
  'Mapping your audience…',
  'Sharpening the hook…',
  'Structuring the brief…',
  'Almost there…',
];

function DraftingScreen() {
  const [msgIdx, setMsgIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setMsgIdx((i) => (i + 1) % DRAFTING_MESSAGES.length), 2000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-6 text-center">
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
        <p className="text-lg font-bold text-brand-forest">Drafting your brief…</p>
        <p className="text-sm text-brand-slate mt-1 transition-all duration-500">
          {DRAFTING_MESSAGES[msgIdx]}
        </p>
      </div>
      <p className="text-xs text-brand-slate/60 max-w-xs">
        Claude is turning your answers into a structured creative brief. Usually takes 10–20 seconds.
      </p>
    </div>
  );
}

// ─── Main quiz ────────────────────────────────────────────────────────────────

export function BriefQuiz({ productName, onSubmit, loading }: BriefQuizProps) {
  const [stepIdx, setStepIdx]     = useState(0);
  const [answers, setAnswers]     = useState<QuizAnswers>(EMPTY);
  const [visible, setVisible]     = useState(true);
  const [direction, setDirection] = useState<'fwd' | 'bwd'>('fwd');

  const step = STEPS[stepIdx];

  const canAdvance = stepIsAnswered(step, answers);

  // Animated step transition
  const goTo = useCallback((next: number, dir: 'fwd' | 'bwd') => {
    setDirection(dir);
    setVisible(false);
    setTimeout(() => {
      setStepIdx(next);
      setVisible(true);
    }, 180);
  }, []);

  const advance = useCallback(() => {
    if (stepIdx < STEPS.length - 1) goTo(stepIdx + 1, 'fwd');
  }, [stepIdx, goTo]);

  const back = useCallback(() => {
    if (stepIdx > 0) goTo(stepIdx - 1, 'bwd');
  }, [stepIdx, goTo]);

  // Submit on last step
  const handleSubmit = useCallback(async () => {
    const objective  = buildObjective(answers);
    const strictness = getStrictness(answers.voice);
    const wild_card  = answers.wildCard === true;
    await onSubmit({ objective, strictness, wild_card });
  }, [answers, onSubmit]);

  const isLastQuestion = stepIdx === STEPS.length - 1;

  // Progress: count answered questions
  const answeredCount = STEPS.filter(
    (s, i) => i < stepIdx && s.questionNum !== undefined,
  ).length;

  // Dynamic motivating label — changes as the user progresses
  const progressLabel =
    step.type === 'transition'
      ? '✨ Nice one!'
      : answeredCount === 0
      ? 'Let\'s get started'
      : answeredCount === 1
      ? 'Good start!'
      : answeredCount === 2
      ? 'Building momentum…'
      : answeredCount === 3
      ? 'You\'re halfway there!'
      : answeredCount === 4
      ? 'Looking good 👀'
      : answeredCount === 5
      ? 'Almost done!'
      : 'Last one — make it count';

  // Show loading screen while API is running
  if (loading) return <DraftingScreen />;

  return (
    <div className="max-w-2xl mx-auto">
      {/* ── Step tracker — numbered dots only, no redundant bar ── */}
      <div className="mb-8 flex flex-col items-center gap-3">
        {/* Motivating label */}
        <p className="text-sm font-medium text-brand-slate transition-all duration-300">
          {progressLabel}
        </p>
        {/* Numbered step dots */}
        <div className="flex items-center gap-2">
          {STEPS.filter((s) => s.questionNum !== undefined).map((s) => {
            const num = s.questionNum ?? 0;
            const done    = num <= answeredCount;
            const current = num === (step.questionNum ?? 0);
            return (
              <div
                key={num}
                className={cn(
                  'flex items-center justify-center rounded-full font-bold transition-all duration-300 select-none',
                  done && !current
                    ? 'h-8 w-8 bg-brand-forest text-white text-xs shadow-sm'
                    : current
                    ? 'h-9 w-9 bg-brand-forest text-white text-sm shadow-md ring-4 ring-brand-forest/20'
                    : 'h-8 w-8 bg-brand-forest/10 text-brand-forest/40 text-xs',
                )}
              >
                {done && !current ? '✓' : num}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Question card ── */}
      <div
        className={cn(
          'transition-all duration-180',
          visible
            ? 'opacity-100 translate-x-0'
            : direction === 'fwd'
            ? 'opacity-0 translate-x-6'
            : 'opacity-0 -translate-x-6',
        )}
      >
        {step.type === 'transition' ? (
          <TransitionScreen step={step} onContinue={advance} />
        ) : (
          <div className="rounded-3xl border border-brand-forest/10 bg-white shadow-sm p-6 sm:p-8">
            {/* Question header */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-6 w-6 rounded-full bg-brand-forest flex items-center justify-center text-[11px] font-bold text-white">
                  {step.questionNum}
                </div>
                {step.optional && (
                  <span className="text-[11px] font-medium text-brand-slate bg-brand-cream px-2 py-0.5 rounded-full">
                    Optional
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-brand-forest leading-tight">
                {step.title}
              </h2>
              {step.subtitle && (
                <p className="text-sm text-brand-slate mt-1.5">
                  {step.subtitle.replace('${}', productName)}
                </p>
              )}
            </div>

            {/* Question body */}
            {step.type === 'persona-grid' && (
              <div className="relative">
                <PersonaGrid step={step} answers={answers} setAnswers={setAnswers} />
              </div>
            )}
            {step.type === 'speech-bubble'  && <SpeechBubbles step={step} answers={answers} setAnswers={setAnswers} />}
            {step.type === 'emotion-grid'   && <EmotionGrid   step={step} answers={answers} setAnswers={setAnswers} />}
            {step.type === 'chips'          && <Chips         step={step} answers={answers} setAnswers={setAnswers} />}
            {step.type === 'text-input'     && <TextInput     step={step} answers={answers} setAnswers={setAnswers} />}
            {step.type === 'voice-cards'    && <VoiceCards    step={step} answers={answers} setAnswers={setAnswers} />}
            {step.type === 'wild-toggle'    && <WildToggle    step={step} answers={answers} setAnswers={setAnswers} />}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-8 pt-5 border-t border-brand-forest/8">
              <button
                onClick={back}
                disabled={stepIdx === 0}
                className={cn(
                  'flex items-center gap-1.5 text-sm font-medium rounded-lg px-3 py-2 transition-colors',
                  stepIdx === 0
                    ? 'text-brand-slate/30 cursor-not-allowed'
                    : 'text-brand-slate hover:text-brand-forest hover:bg-brand-cream',
                )}
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </button>

              {isLastQuestion ? (
                <Button
                  disabled={!canAdvance}
                  onClick={handleSubmit}
                  className="gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  Draft my brief
                </Button>
              ) : (
                <button
                  disabled={!canAdvance && step.type !== 'text-input'}
                  onClick={advance}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200',
                    canAdvance || step.optional
                      ? 'bg-brand-forest text-white hover:bg-brand-forest/90 shadow-sm'
                      : 'bg-brand-forest/20 text-brand-forest/40 cursor-not-allowed',
                  )}
                >
                  {step.optional && !answers.keyDetails.trim() ? 'Skip' : 'Next'}
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Product context chip */}
      <div className="mt-4 flex justify-center">
        <div className="inline-flex items-center gap-1.5 text-[11px] text-brand-slate bg-brand-cream/60 px-3 py-1.5 rounded-full">
          <Zap className="h-3 w-3 text-brand-forest/60" />
          Brief for <span className="font-medium text-brand-forest">{productName}</span>
        </div>
      </div>
    </div>
  );
}
