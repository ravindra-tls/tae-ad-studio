'use client';

/**
 * Brief-first workspace — three stacked panels:
 *   1. BriefForm     — objective + strictness + wild_card → POST /api/pipeline/brief
 *   2. BriefCard     — renders the structured brief, Approve button → /concept
 *   3. ConceptGallery — N concept cards + sameness debug (Claude vs cosine)
 *
 * All state lives here so the page can move between phases without route
 * navigation. On page refresh, the server component hydrates initialBrief and
 * initialConcepts so the user resumes where they left off.
 *
 * Shell-scope caveats:
 *   - Brief is read-only after draft. Editing is Phase 2 polish — for now,
 *     marketers re-submit a new objective to get a new brief.
 *   - Concept gallery is display-only. No selection, no downstream generation.
 *   - Sameness debug panel renders both Claude and cosine verdicts per round
 *     so Ravindra can eyeball which signal is better before we lock one in.
 */

import { useMemo, useState } from 'react';
import { Breadcrumb } from '@/components/Breadcrumb';
import type { Brief, Concept, Session, Product } from '@/types';
import type { SamenessRound } from '@/lib/pipeline/stages/sameness';
import type { AspectRatio } from '@/lib/hooks/use-generation-stream';
import { BriefQuizV2 } from './brief-quiz-v2';
import { BriefCard } from './brief-card';
import { ConceptGallery } from './concept-gallery';
import { GenerationDrawer } from './generation-drawer';

interface BriefWorkspaceProps {
  session: Session & { product?: Product };
  initialBrief: Brief | null;
  initialConcepts: Concept[];
  research: import('@/lib/research/types').PositioningResearch | null;
}

type Phase = 'form' | 'brief_ready' | 'concepts_loading' | 'concepts_ready';

export function BriefWorkspace({
  session,
  initialBrief,
  initialConcepts,
  research,
}: BriefWorkspaceProps) {
  const [brief, setBrief] = useState<Brief | null>(initialBrief);
  const [concepts, setConcepts] = useState<Concept[]>(initialConcepts);
  const [samenessRounds, setSamenessRounds] = useState<SamenessRound[]>([]);
  const [samenessRetries, setSamenessRetries] = useState(0);

  const [briefLoading, setBriefLoading] = useState(false);
  const [conceptLoading, setConceptLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generation drawer state — opened from concept gallery's Continue button.
  // Aspect ratio defaults to 1:1 for now; a picker belongs here as a follow-up
  // once we know which ratios marketers actually use most (pending usage data).
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerConceptIds, setDrawerConceptIds] = useState<string[]>([]);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  // In direct-generate mode, product reference images are always used to keep
  // the correct product in the ad. Default ON — direct mode fetches them
  // server-side regardless, but keeping the toggle on matches user expectation.
  const [useReferences, setUseReferences] = useState(true);

  // Resolve the ID list to full Concept rows in declared order. Memoized so
  // the drawer's effect dependency on `concepts` stays stable until selection
  // actually changes.
  const drawerConcepts = useMemo(() => {
    const byId = new Map(concepts.map((c) => [c.id, c]));
    return drawerConceptIds
      .map((id) => byId.get(id))
      .filter((c): c is Concept => Boolean(c));
  }, [drawerConceptIds, concepts]);

  // Initial phase: wherever the server hydration leaves us.
  const initialPhase: Phase =
    initialConcepts.length > 0
      ? 'concepts_ready'
      : initialBrief
        ? 'brief_ready'
        : 'form';
  const [phase, setPhase] = useState<Phase>(initialPhase);

  async function handleDraftBrief(input: {
    objective: string;
    strictness: 'off' | 'loose' | 'tight';
    wild_card: boolean;
    funnel_stage?: 'tofu' | 'mofu' | 'bofu';
    persona_name?: string;
  }) {
    setBriefLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/pipeline/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          session_id: session.id,
          ...input,
          source: input.funnel_stage ? 'quiz' : 'freeform',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);

      setBrief(data.brief as Brief);
      setConcepts([]);
      setSamenessRounds([]);
      setSamenessRetries(0);
      setPhase('brief_ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBriefLoading(false);
    }
  }

  async function handleApproveBrief() {
    if (!brief) return;
    // Open drawer in template mode — auto-selects template, fills, and generates.
    setDrawerConceptIds([]);
    setDrawerOpen(true);
  }

  function handleStartOver() {
    setBrief(null);
    setConcepts([]);
    setSamenessRounds([]);
    setSamenessRetries(0);
    setError(null);
    setPhase('form');
  }

  /**
   * Toggle a concept's selection via PATCH /api/pipeline/concept/[id]/select.
   * Throws on non-200 so ConceptGallery can show an inline error.
   */
  async function handleToggleSelect(
    conceptId: string,
    next: boolean,
  ): Promise<Concept> {
    const res = await fetch(`/api/pipeline/concept/${conceptId}/select`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ selected: next }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);

    const updated = data.concept as Concept;
    setConcepts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    return updated;
  }

  function handleContinue(selectedIds: string[]) {
    if (selectedIds.length === 0) return;
    setError(null);
    setDrawerConceptIds(selectedIds);
    setDrawerOpen(true);
  }

  const productName = session.product?.name ?? 'Session';

  return (
    <div className="animate-fade-in">
      <Breadcrumb
        crumbs={[
          { label: 'Sessions', href: '/dashboard' },
          { label: productName, href: `/session/${session.id}/prompts` },
          { label: 'Brief-first' },
        ]}
      />

      {phase === 'form' && (
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-brand-forest">Let's build your brief</h1>
          <p className="text-sm text-brand-slate mt-1.5">
            A few quick questions — Claude does the rest.
          </p>
        </div>
      )}

      {error && (
        <div className="max-w-2xl mx-auto mb-5 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong className="font-semibold">Something went wrong:</strong> {error}
        </div>
      )}

      {/* Step 1: Brief quiz (gamified multi-step questionnaire). */}
      {phase === 'form' && (
        <BriefQuizV2
          productName={productName}
          research={research}
          onSubmit={handleDraftBrief}
          loading={briefLoading}
        />
      )}

      {/* Step 2: Brief card + approve button. */}
      {(phase === 'brief_ready' || phase === 'concepts_loading' || phase === 'concepts_ready') &&
        brief && (
          <BriefCard
            brief={brief}
            onApprove={handleApproveBrief}
            onStartOver={handleStartOver}
            approving={conceptLoading}
            alreadyGenerated={phase === 'concepts_ready' && concepts.length > 0}
          />
        )}

      {/* Aspect ratio + reference toggle — constrained to quiz width */}
      {phase === 'concepts_ready' && concepts.length > 0 && (
        <div className="max-w-2xl mx-auto mb-0 mt-4 flex flex-wrap items-stretch gap-2">
          <AspectRatioPicker value={aspectRatio} onChange={setAspectRatio} />
          <ReferenceToggle value={useReferences} onChange={setUseReferences} />
        </div>
      )}

      {/* Step 3: Concept gallery + sameness debug. */}
      {(phase === 'concepts_loading' || phase === 'concepts_ready') && (
        <ConceptGallery
          concepts={concepts}
          samenessRounds={samenessRounds}
          samenessRetries={samenessRetries}
          loading={conceptLoading}
          onToggleSelect={handleToggleSelect}
          onContinue={handleContinue}
        />
      )}

      <GenerationDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        concepts={drawerConcepts}
        briefId={brief?.id}
        aspectRatio={aspectRatio}
        useReferences={useReferences}
        sessionId={session.id}
        mode="template"
      />
    </div>
  );
}

/**
 * Compact aspect-ratio picker. Keeps the marketer's ratio choice next to the
 * concept gallery so they don't have to hunt for it inside the drawer mid-run.
 * The set here mirrors lib/hooks/use-generation-stream AspectRatio — add new
 * ratios in both places.
 */
const ASPECT_OPTIONS: Array<{ value: AspectRatio; label: string; hint: string }> = [
  { value: '1:1', label: '1:1', hint: 'Feed square' },
  { value: '4:5', label: '4:5', hint: 'Instagram portrait' },
  { value: '9:16', label: '9:16', hint: 'Stories / Reels' },
  { value: '16:9', label: '16:9', hint: 'Landscape' },
  { value: '3:4', label: '3:4', hint: 'Portrait' },
];

/**
 * Two-state toggle for "ship reference product images to the image model".
 * Compact pill pair to match the aspect-ratio picker's visual register. The
 * ON state is deliberately labelled "With product photo" rather than
 * "/edits endpoint" — the marketer shouldn't need to know which xAI route
 * is chosen, only the trade-off (likeness vs. composition freedom).
 */
function ReferenceToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-brand-teal/15 bg-white px-3 py-2">
      <span className="text-xs font-medium uppercase tracking-wide text-brand-slate">
        Product photo
      </span>
      <button
        type="button"
        onClick={() => onChange(false)}
        title="Pure text-to-image; stronger composition."
        className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
          !value
            ? 'bg-brand-teal text-white'
            : 'bg-brand-cream/60 text-brand-forest hover:bg-brand-teal/10'
        }`}
      >
        Off
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        title="Include product reference image; better likeness, weaker composition."
        className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
          value
            ? 'bg-brand-teal text-white'
            : 'bg-brand-cream/60 text-brand-forest hover:bg-brand-teal/10'
        }`}
      >
        On
      </button>
    </div>
  );
}

function AspectRatioPicker({
  value,
  onChange,
}: {
  value: AspectRatio;
  onChange: (next: AspectRatio) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-brand-teal/15 bg-white px-3 py-2">
      <span className="text-xs font-medium uppercase tracking-wide text-brand-slate">
        Aspect
      </span>
      {ASPECT_OPTIONS.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              active
                ? 'bg-brand-teal text-white'
                : 'bg-brand-cream/60 text-brand-forest hover:bg-brand-teal/10'
            }`}
            title={opt.hint}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
