'use client';

/**
 * One concept on the board. Every copy element is click-to-pin (skipped
 * while the user is selecting text to comment) and commentable via text
 * selection. Background finalize/refine shows the read-only shimmer sweep
 * without blocking the rest of the app.
 */

import {
  Clapperboard,
  Dna,
  HeartPulse,
  Loader2,
  Megaphone,
  Pencil,
  Pin,
  RotateCw,
  Star,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useForgeStore, dedupedChampions } from '../state/forge-store';
import { usePins } from '../state/use-pins';
import { useFinalize } from '../state/use-finalize';
import { useRefine, useDiscard } from '../state/use-refine';
import { assignCommentMarkers } from '../comments/use-text-selection';
import { CommentsList, CommentMarkers } from './comments-list';
import { DnaTags } from './dna-tags';
import { QualityMeter } from './quality-meter';
import type { ConceptCard as ConceptCardData, PinKey } from '../state/types';

function hasTextSelection(): boolean {
  return (window.getSelection()?.toString().trim().length ?? 0) > 0;
}

export function ConceptCard({
  card,
  onVariants,
}: {
  card: ConceptCardData;
  onVariants: (card: ConceptCardData) => void;
}) {
  const { state, dispatch, openConcept } = useForgeStore();
  const { pinPart, pinFrame } = usePins();
  const { finalize } = useFinalize();
  const { refineCard } = useRefine();
  const discard = useDiscard();

  const comments = state.cardComments[card.id] || [];
  const finalizing = !!state.pendingFinalizes[card.id];
  const refining = !!state.pendingRefines[card.id];
  const varianting = !!state.pendingVariants[card.id];
  const streaming = state.streaming;
  const flash = state.ui.flashCardId === card.id;
  const champ = dedupedChampions(state.session).find((c) => c.id === card.id);

  // Fuzzy quote → displayed-copy markers (first match in display order wins).
  const markers = assignCommentMarkers(comments, [
    { key: 'tagline', text: card.tagline },
    { key: 'insight', text: card.emotionalInsight || '' },
    { key: 'angle', text: card.messagingAngle },
    { key: 'visual', text: card.visualIdea || '' },
    { key: 'cta', text: card.cta || '' },
  ]);

  const pinIfNoSelection = (key: PinKey, value: string | undefined) => {
    if (!value || hasTextSelection()) return;
    pinPart(key, value);
  };

  return (
    <div
      data-card-id={card.id}
      data-comment-scope="card"
      data-comment-id={card.id}
      className={cn(
        'relative flex animate-stagger-in flex-col gap-2.5 rounded-xl border border-brand-sage/25 bg-white p-4 shadow-sm',
        (finalizing || refining) && 'forge-busy',
        flash && 'animate-card-flash',
      )}
    >
      <button
        type="button"
        title="Discard this concept"
        onClick={() => void discard(card)}
        className="absolute right-2 top-2 rounded-lg p-1 text-brand-slate/40 hover:bg-brand-wine/10 hover:text-brand-wine"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>

      {/* Tagline (serif display) */}
      <div
        data-commentable
        title="click to add to your Brief"
        onClick={() => pinIfNoSelection('tagline', card.tagline)}
        className="cursor-pointer pr-6 font-serif text-lg leading-snug text-brand-forest"
      >
        {card.tagline}
        <CommentMarkers indices={markers.tagline} comments={comments} />
      </div>

      {/* Emotional insight */}
      {card.emotionalInsight && (
        <div
          data-commentable
          title="the raw human truth this ad is built on"
          className="flex items-start gap-1.5 text-xs italic leading-snug text-brand-slate"
        >
          <HeartPulse className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-wine/70" aria-hidden />
          <span>
            {card.emotionalInsight}
            <CommentMarkers indices={markers.insight} comments={comments} />
          </span>
        </div>
      )}

      {/* Messaging angle */}
      <div
        data-commentable
        title="click to add this angle to your Brief"
        onClick={() => pinIfNoSelection('angle', card.messagingAngle)}
        className="cursor-pointer text-sm leading-snug text-brand-navy"
      >
        &ldquo;{card.messagingAngle}&rdquo;
        <CommentMarkers indices={markers.angle} comments={comments} />
      </div>

      {/* Visual idea */}
      {card.visualIdea && (
        <div
          data-commentable
          title="click to add this visual to your Brief"
          onClick={() => pinIfNoSelection('visualIdea', card.visualIdea)}
          className="flex cursor-pointer items-start gap-1.5 rounded-lg bg-brand-cream/50 p-2 text-xs leading-snug text-brand-slate"
        >
          <Clapperboard className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-forest" aria-hidden />
          <span>
            {card.visualIdea}
            <CommentMarkers indices={markers.visual} comments={comments} />
          </span>
        </div>
      )}

      {/* CTA */}
      {card.cta && (
        <div
          data-commentable
          title="click to add this CTA to your Brief"
          onClick={() => pinIfNoSelection('cta', card.cta)}
          className="flex cursor-pointer items-center gap-1.5 text-xs text-brand-slate"
        >
          <Megaphone className="h-3.5 w-3.5 shrink-0 text-brand-forest" aria-hidden />
          <span>
            <b className="font-semibold text-brand-forest">CTA:</b> {card.cta}
            <CommentMarkers indices={markers.cta} comments={comments} />
          </span>
        </div>
      )}

      {/* DNA tags */}
      <DnaTags
        dna={card.dna}
        onPin={(key, value) => pinIfNoSelection(key, value)}
      />

      {/* Pin parameters */}
      <button
        type="button"
        title="Copy this concept's setup into the Brief"
        onClick={() => pinFrame(card)}
        className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-brand-sage/50 py-1 text-[11px] font-medium text-brand-slate hover:border-brand-forest/50 hover:text-brand-forest"
      >
        <Pin className="h-3 w-3" aria-hidden />
        Pin Parameters
      </button>

      <QualityMeter scores={card.scores || { overall: 0 }} />

      {/* Actions */}
      <div className="mt-auto flex gap-2">
        <button
          type="button"
          title="Generate 3 variations of this concept"
          disabled={streaming || varianting}
          onClick={() => onVariants(card)}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-brand-forest/25 bg-white py-1.5 text-xs font-medium text-brand-forest hover:bg-brand-cream disabled:opacity-50"
        >
          {varianting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Making variants…
            </>
          ) : (
            <>
              <Dna className="h-3.5 w-3.5" aria-hidden />
              Make variants
            </>
          )}
        </button>
        <button
          type="button"
          data-glow=""
          disabled={streaming || finalizing}
          onClick={() => {
            if (champ) openConcept(card.id);
            else void finalize(card);
          }}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-forest py-1.5 text-xs font-medium text-white hover:bg-brand-forest/90 disabled:opacity-50"
        >
          <Star className="h-3.5 w-3.5" aria-hidden />
          {finalizing ? 'Finalizing…' : champ ? 'Open' : 'Finalize'}
        </button>
      </div>

      {/* Inline comments → regenerate */}
      {comments.length ? (
        <>
          <CommentsList
            comments={comments}
            onRemove={(index) =>
              dispatch({ type: 'REMOVE_COMMENT', mode: 'card', cardId: card.id, index })
            }
          />
          <button
            type="button"
            disabled={refining}
            onClick={() => void refineCard(card)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-brand-forest/30 bg-brand-cream/60 py-1.5 text-xs font-medium text-brand-forest hover:bg-brand-cream disabled:opacity-60"
          >
            {refining ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Regenerating…
              </>
            ) : (
              <>
                <RotateCw className="h-3.5 w-3.5" aria-hidden />
                Regenerate with {comments.length} comment{comments.length > 1 ? 's' : ''}
              </>
            )}
          </button>
        </>
      ) : (
        <div className="flex items-center gap-1 text-[10px] italic text-brand-slate/60">
          <Pencil className="h-3 w-3" aria-hidden />
          select any copy above to comment &amp; regenerate
        </div>
      )}
    </div>
  );
}
