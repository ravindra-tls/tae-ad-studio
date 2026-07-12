'use client';

/**
 * Step 1 — the finalized concept: hero tagline picker, visual direction
 * (clamped with read-more), CTA, collapsed extended details, inline
 * comment/regenerate, reference images, and "Build ad from template".
 */

import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clapperboard,
  Loader2,
  Megaphone,
  Pencil,
  RotateCw,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useForgeStore } from '../state/forge-store';
import { assignCommentMarkers } from '../comments/use-text-selection';
import { CommentsList, CommentMarkers } from '../board/comments-list';
import { TaglinePicker } from './tagline-picker';
import { ReferenceImagePicker } from './reference-image-picker';
import type { Champion, CommentItem, DetailCardLike, ProductRefImage } from '../state/types';

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-4 mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-brand-slate/80">
      {children}
    </h3>
  );
}

export function StepConcept({
  card,
  champ,
  heroOptions,
  onHeroChange,
  refining,
  onRegen,
  onBuild,
  building,
  productImages,
}: {
  card: DetailCardLike;
  champ: Champion;
  heroOptions: string[];
  onHeroChange: (headline: string) => void;
  refining: boolean;
  onRegen: () => void;
  onBuild: () => void;
  building: boolean;
  productImages: ProductRefImage[];
}) {
  const { state, dispatch } = useForgeStore();
  const comments = state.championComments[card.id] || [];

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [clamped, setClamped] = useState(true);
  const [showReadMore, setShowReadMore] = useState(false);
  const visualRef = useRef<HTMLDivElement | null>(null);

  const visualText = champ.visualIdea || card.visualIdea || '';

  // Measure after the detail view is actually visible (heights are 0 while
  // hidden); setTimeout, not rAF — rAF stalls in throttled/background tabs.
  useEffect(() => {
    if (!visualText) return;
    const t = setTimeout(() => {
      const el = visualRef.current;
      if (el && el.scrollHeight > el.clientHeight + 2) setShowReadMore(true);
    }, 30);
    return () => clearTimeout(t);
  }, [visualText]);

  // Fuzzy quote → copy markers, display order.
  const markers = assignCommentMarkers(comments, [
    { key: 'headline', text: champ.headline },
    ...heroOptions.map((t, i) => ({ key: `tl-${i}`, text: t })),
    { key: 'visual', text: visualText },
    { key: 'cta', text: card.cta || champ.cta || '' },
    { key: 'concept', text: champ.concept },
    { key: 'primary', text: champ.primaryText || '' },
    { key: 'why', text: champ.whyItWorks },
    { key: 'compliance', text: champ.complianceCheck },
  ]);

  const cta = card.cta || champ.cta;

  return (
    <div className="flex flex-col">
      {/* Headline */}
      <div data-commentable className="font-serif text-3xl leading-tight text-brand-forest">
        {champ.headline}
        <CommentMarkers indices={markers.headline} comments={comments} />
      </div>

      {/* Hero tagline picker */}
      <SectionHeading>
        Hero tagline{' '}
        <span className="font-normal normal-case tracking-normal text-brand-slate/60">
          — pick the one to build the ad on
        </span>
      </SectionHeading>
      <TaglinePicker
        options={heroOptions}
        value={champ.headline}
        onChange={onHeroChange}
        markers={markers}
        comments={comments}
      />

      {/* Visual direction */}
      {visualText && (
        <>
          <SectionHeading>Visual direction</SectionHeading>
          <div
            ref={visualRef}
            data-commentable
            className={`flex items-start gap-1.5 rounded-lg bg-brand-cream/50 p-3 text-sm leading-relaxed text-brand-navy ${clamped ? 'line-clamp-4' : ''}`}
          >
            <Clapperboard className="mt-0.5 h-4 w-4 shrink-0 text-brand-forest" aria-hidden />
            <span>
              {visualText}
              <CommentMarkers indices={markers.visual} comments={comments} />
            </span>
          </div>
          {showReadMore && (
            <button
              type="button"
              onClick={() => setClamped((c) => !c)}
              className="mt-1 inline-flex items-center gap-1 self-start text-xs font-medium text-brand-forest hover:underline"
            >
              {clamped ? (
                <>
                  Read more <ChevronDown className="h-3 w-3" aria-hidden />
                </>
              ) : (
                <>
                  Show less <ChevronUp className="h-3 w-3" aria-hidden />
                </>
              )}
            </button>
          )}
        </>
      )}

      {/* CTA */}
      {cta && (
        <>
          <SectionHeading>Call to action</SectionHeading>
          <div
            data-commentable
            className="flex items-center gap-1.5 rounded-lg bg-brand-cream/50 p-3 text-sm text-brand-navy"
          >
            <Megaphone className="h-4 w-4 shrink-0 text-brand-forest" aria-hidden />
            <span>
              {cta}
              <CommentMarkers indices={markers.cta} comments={comments} />
            </span>
          </div>
        </>
      )}

      {/* Extended details */}
      <button
        type="button"
        onClick={() => setDetailsOpen((o) => !o)}
        className="mt-4 inline-flex items-center gap-1 self-start text-xs font-medium text-brand-slate hover:text-brand-forest"
      >
        {detailsOpen ? (
          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        )}
        Concept · On-image copy · Why it works · Compliance
      </button>
      {detailsOpen && (
        <div className="mt-1 flex flex-col rounded-xl border border-brand-sage/25 bg-white/70 p-3">
          <SectionHeading>Concept</SectionHeading>
          <div data-commentable className="text-sm leading-relaxed text-brand-navy">
            {champ.concept}
            <CommentMarkers indices={markers.concept} comments={comments} />
          </div>
          {champ.primaryText && (
            <>
              <SectionHeading>On-image copy</SectionHeading>
              <div data-commentable className="text-sm leading-relaxed text-brand-navy">
                {champ.primaryText}
                <CommentMarkers indices={markers.primary} comments={comments} />
              </div>
            </>
          )}
          <SectionHeading>Why it works</SectionHeading>
          <div data-commentable className="text-sm leading-relaxed text-brand-navy">
            {champ.whyItWorks}
            <CommentMarkers indices={markers.why} comments={comments} />
          </div>
          <SectionHeading>Compliance</SectionHeading>
          <div
            data-commentable
            className="flex items-start gap-1.5 text-sm leading-relaxed text-brand-forest"
          >
            <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              {champ.complianceCheck}
              <CommentMarkers indices={markers.compliance} comments={comments} />
            </span>
          </div>
        </div>
      )}

      {/* Inline comments → regenerate the finalized concept */}
      <div className="mt-4">
        {comments.length ? (
          <div className="flex flex-col gap-2">
            <CommentsList
              comments={comments}
              onRemove={(index) =>
                dispatch({ type: 'REMOVE_COMMENT', mode: 'champion', cardId: card.id, index })
              }
            />
            <button
              type="button"
              disabled={refining}
              onClick={onRegen}
              className="inline-flex items-center justify-center gap-1.5 self-start rounded-lg border border-brand-forest/30 bg-brand-cream/60 px-3 py-1.5 text-xs font-medium text-brand-forest hover:bg-brand-cream disabled:opacity-60"
            >
              {refining ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Regenerating…
                </>
              ) : (
                <>
                  <RotateCw className="h-3.5 w-3.5" aria-hidden />
                  Regenerate finalized concept ({comments.length})
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-[10px] italic text-brand-slate/60">
            <Pencil className="h-3 w-3" aria-hidden />
            select any copy above to comment &amp; regenerate this concept
          </div>
        )}
      </div>

      {/* Reference images */}
      <div className="mt-4">
        <ReferenceImagePicker productImages={productImages} />
      </div>

      {/* Build */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Badge variant="secondary">GPT Image-2 · templated</Badge>
        <Button onClick={onBuild} disabled={building} className="gap-1.5">
          {building ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Building ad…
            </>
          ) : (
            <>
              Build ad from template
              <ArrowRight className="h-4 w-4" aria-hidden />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
