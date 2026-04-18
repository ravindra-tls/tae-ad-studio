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

import { useState } from 'react';
import Link from 'next/link';
import { Breadcrumb } from '@/components/Breadcrumb';
import type { Brief, Concept, Session, Product } from '@/types';
import type { SamenessRound } from '@/lib/pipeline/stages/sameness';
import { BriefForm } from './brief-form';
import { BriefCard } from './brief-card';
import { ConceptGallery } from './concept-gallery';

interface BriefWorkspaceProps {
  session: Session & { product?: Product };
  initialBrief: Brief | null;
  initialConcepts: Concept[];
}

type Phase = 'form' | 'brief_ready' | 'concepts_loading' | 'concepts_ready';

export function BriefWorkspace({
  session,
  initialBrief,
  initialConcepts,
}: BriefWorkspaceProps) {
  const [brief, setBrief] = useState<Brief | null>(initialBrief);
  const [concepts, setConcepts] = useState<Concept[]>(initialConcepts);
  const [samenessRounds, setSamenessRounds] = useState<SamenessRound[]>([]);
  const [samenessRetries, setSamenessRetries] = useState(0);

  const [briefLoading, setBriefLoading] = useState(false);
  const [conceptLoading, setConceptLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          source: 'freeform',
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
    setConceptLoading(true);
    setError(null);
    setPhase('concepts_loading');
    try {
      const res = await fetch('/api/pipeline/concept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ brief_id: brief.id, count: 4 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);

      setConcepts((data.concepts as Concept[]) ?? []);
      setSamenessRounds((data.sameness_rounds as SamenessRound[]) ?? []);
      setSamenessRetries(Number(data.sameness_retries ?? 0));
      setPhase('concepts_ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase('brief_ready'); // let them retry approval
    } finally {
      setConceptLoading(false);
    }
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
   * Throws on non-200 so ConceptGallery can show an inline error (e.g. the
   * 409 from the max-2 selection cap).
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
    // Phase 2 target: hand off to copy/visual generation. For the shell we just
    // surface a message so the whole flow is clickable end-to-end.
    setError(
      `Selected ${selectedIds.length} concept${selectedIds.length === 1 ? '' : 's'}. Downstream copy + visual generation lands in Phase 2.`,
    );
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
        actions={
          <Link
            href={`/session/${session.id}/prompts`}
            className="text-xs text-brand-slate hover:text-brand-forest underline-offset-4 hover:underline"
          >
            Switch to templates &rarr;
          </Link>
        }
      />

      <div className="mb-5">
        <h1 className="text-2xl font-bold text-brand-forest">Brief-first session</h1>
        <p className="text-sm text-brand-slate mt-1">
          Start from an objective. Claude drafts a structured brief, then proposes
          diverse concept directions. No rendering in this shell &mdash; that&apos;s Phase 2.
        </p>
      </div>

      {error && (
        <div className="mb-5 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong className="font-semibold">Something went wrong:</strong> {error}
        </div>
      )}

      {/* Step 1: Brief form (always visible until a brief is drafted). */}
      {phase === 'form' && (
        <BriefForm
          productName={productName}
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
    </div>
  );
}
