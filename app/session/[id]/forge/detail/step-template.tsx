'use client';

/**
 * Step 2 — Template & Prompt: the export record. Template box with swap
 * Select (shortlist of the 15 best matches for THIS concept, or all
 * templates grouped by category), the final prompt (read-only + copy),
 * negatives, trust elements, placed copy, references, and the quality
 * select + Generate action.
 */

import { useState } from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import {
  Ban,
  Copy,
  Loader2,
  Palette,
  PenLine,
  ShieldCheck,
  Star,
  TriangleAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { rankTemplatesForConcept, sceneNeedsPerson } from '@/lib/templates/ranking';
import { useForgeStore } from '../state/forge-store';
import { ProgressPill } from '../board/board-tabs';
import type {
  DetailCardLike,
  ExportRecord,
  ForgeTemplate,
  ImageQuality,
} from '../state/types';

const SHORTLIST = 15;

const SelectGroup = SelectPrimitive.Group;

function SelectGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <SelectPrimitive.Label className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-brand-slate/70">
      {children}
    </SelectPrimitive.Label>
  );
}

function WarnRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 text-[11px] leading-snug text-amber-800">
      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-brand-slate/80">
      {children}
    </div>
  );
}

export function StepTemplate({
  card,
  rec,
  stale,
  templates,
  swapping,
  swappingKind,
  onSwap,
  quality,
  onQuality,
  onGenerate,
  exportWarn,
}: {
  card: DetailCardLike;
  rec: ExportRecord;
  stale: boolean;
  templates: ForgeTemplate[] | null;
  swapping: boolean;
  swappingKind: 'freeform' | number | null;
  onSwap: (templateNumber: number | 'freeform') => void;
  quality: ImageQuality;
  onQuality: (q: ImageQuality) => void;
  onGenerate: () => void;
  exportWarn: string | null;
}) {
  const { showSnack } = useForgeStore();
  const [showAll, setShowAll] = useState(false);

  const tpl = rec.template || { number: null };
  const isFreeform = tpl.number == null;
  const settings = rec.settings || {};
  const refs = rec.reference_images || [];
  const zones = rec.text_zones || [];
  const badges = rec.enhancers || [];

  const needsPerson = sceneNeedsPerson(rec._concept_forge?.visualIdea || card.visualIdea);
  const ranked = templates ? rankTemplatesForConcept(card, rec, templates) : [];

  // Shortlist: the 15 best matches; keep the current pick visible.
  let shortlist = ranked.slice(0, SHORTLIST);
  if (!isFreeform && templates && !shortlist.some((t) => t.number === tpl.number)) {
    const cur = templates.find((t) => t.number === tpl.number);
    if (cur) shortlist = [cur, ...shortlist];
  }

  const byCategory: Record<string, ForgeTemplate[]> = {};
  if (showAll && templates) {
    for (const t of templates) (byCategory[t.category] = byCategory[t.category] || []).push(t);
  }

  const optionRow = (t: ForgeTemplate) => (
    <SelectItem key={t.number} value={String(t.number)}>
      <span className="inline-flex items-center gap-1.5">
        #{t.number} {t.name} ({t.aspect_ratio})
        {needsPerson && t.people_ok === false && (
          <span className="inline-flex items-center gap-0.5 text-brand-wine">
            <Ban className="h-3 w-3" aria-hidden />
            product-only
          </span>
        )}
        {t.has_headline_slot === false && (
          <span className="inline-flex items-center gap-0.5 text-amber-600">
            <TriangleAlert className="h-3 w-3" aria-hidden />
            no headline slot
          </span>
        )}
      </span>
    </SelectItem>
  );

  const currentValue = isFreeform ? 'freeform' : String(tpl.number);

  const copyPrompt = () => {
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(rec.prompt || '')
        .then(() => showSnack({ message: 'Prompt copied' }))
        .catch(() => showSnack({ message: 'Copy failed', tone: 'error' }));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {stale && (
        <WarnRow>
          Hero tagline changed — this prompt was built with the previous line. Click &ldquo;Build
          ad from template&rdquo; on step 1 (or swap a template) to rebuild before generating.
        </WarnRow>
      )}

      {swapping && (
        <div className="flex items-center gap-2 text-xs text-brand-slate">
          <ProgressPill />
          <span>
            {swappingKind === 'freeform'
              ? 'Composing the ad around your concept — no template…'
              : 'Rebuilding the ad from the chosen template…'}
          </span>
        </div>
      )}

      {/* Template box */}
      <div className="flex gap-3 rounded-xl border border-brand-sage/25 bg-white p-3">
        {tpl.preview_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tpl.preview_image_url}
            alt="template preview"
            className="h-28 w-24 shrink-0 rounded-lg border border-brand-sage/20 object-cover"
          />
        ) : (
          <div className="flex h-28 w-24 shrink-0 items-center justify-center rounded-lg border border-dashed border-brand-sage/40 text-[10px] text-brand-slate/60">
            no preview
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-forest">
              {tpl.number == null ? (
                <>
                  <PenLine className="h-3.5 w-3.5" aria-hidden />
                  {tpl.name || 'Concept-first (no template)'}
                </>
              ) : (
                <>
                  Template #{tpl.number} · {tpl.name || ''}
                </>
              )}
            </span>
            {tpl.auto_suggested ? (
              <Badge variant="secondary">auto-matched</Badge>
            ) : (
              <Badge variant="outline">your pick</Badge>
            )}
          </div>
          <div className="text-[11px] text-brand-slate">
            {[tpl.category, tpl.aspect_ratio || settings.aspect_ratio].filter(Boolean).join(' · ')}
          </div>

          <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-brand-slate/80">
            Swap layout template{' '}
            <span className="font-normal normal-case tracking-normal text-brand-slate/60">
              {templates
                ? showAll
                  ? `(all ${templates.length})`
                  : `(${Math.min(SHORTLIST, ranked.length)} best of ${templates.length})`
                : '(loading…)'}
            </span>
          </div>
          <Select
            value={currentValue}
            disabled={swapping || !templates}
            onValueChange={(v) => {
              if (v === currentValue) return;
              if (v === 'freeform') {
                if (tpl.number != null) onSwap('freeform');
                return;
              }
              const num = Number(v);
              if (num && num !== tpl.number) onSwap(num);
            }}
          >
            <SelectTrigger className="w-full max-w-md">
              <span className="truncate">
                <SelectValue placeholder={templates ? 'Pick a template' : 'loading templates…'} />
              </span>
            </SelectTrigger>
            <SelectContent className="max-h-80 overflow-y-auto">
              <SelectItem value="freeform">
                <span className="inline-flex items-center gap-1.5">
                  <PenLine className="h-3 w-3" aria-hidden />
                  Concept-first — compose from the concept (no template)
                </span>
              </SelectItem>
              {templates &&
                (showAll ? (
                  Object.keys(byCategory)
                    .sort()
                    .map((cat) => (
                      <SelectGroup key={cat}>
                        <SelectGroupLabel>{cat}</SelectGroupLabel>
                        {byCategory[cat]
                          .slice()
                          .sort((a, b) => a.number - b.number)
                          .map(optionRow)}
                      </SelectGroup>
                    ))
                ) : (
                  <SelectGroup>
                    <SelectGroupLabel>
                      <Star className="h-3 w-3" aria-hidden />
                      Best matches for this concept
                    </SelectGroupLabel>
                    {shortlist.map(optionRow)}
                  </SelectGroup>
                ))}
            </SelectContent>
          </Select>
          <label className="mt-1 flex cursor-pointer items-center gap-1.5 text-[11px] text-brand-slate">
            <input
              type="checkbox"
              className="accent-brand-forest"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
            />
            show all templates
          </label>
        </div>
      </div>

      <div className="text-[11px] text-brand-slate">
        {[rec.format, settings.aspect_ratio, settings.model].filter(Boolean).join(' · ')}
      </div>

      {(rec.warnings || []).map((w, i) => (
        <WarnRow key={i}>{w}</WarnRow>
      ))}
      {exportWarn && <WarnRow>{exportWarn}</WarnRow>}

      {/* Final prompt */}
      <FieldLabel>Final prompt (auto-sent to GPT Image-2)</FieldLabel>
      <textarea
        readOnly
        value={rec.prompt || ''}
        rows={8}
        className="w-full resize-y rounded-xl border border-brand-sage/30 bg-white p-3 font-mono text-[11px] leading-relaxed text-brand-navy focus:outline-none"
      />

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2.5">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={copyPrompt}>
          <Copy className="h-3.5 w-3.5" aria-hidden />
          Copy prompt
        </Button>
        <Select value={quality} onValueChange={(v) => onQuality(v as ImageQuality)}>
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low (fast)</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>
        <Button
          className={cn('gap-1.5', swapping && 'opacity-60')}
          disabled={swapping}
          onClick={onGenerate}
        >
          {swapping ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Palette className="h-4 w-4" aria-hidden />
          )}
          Generate image
        </Button>
      </div>

      {/* Negatives */}
      {rec.negative_prompt && (
        <>
          <FieldLabel>Negative prompt (folded into the &ldquo;Avoid:&rdquo; line)</FieldLabel>
          <div className="rounded-xl border border-brand-sage/25 bg-brand-cream/40 p-3 text-[11px] leading-relaxed text-brand-slate">
            {rec.negative_prompt}
          </div>
        </>
      )}

      {/* Trust elements */}
      {badges.length > 0 && (
        <>
          <FieldLabel>Trust elements woven into the layout</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {badges.map((b, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full bg-brand-forest/10 px-2 py-0.5 text-[11px] font-medium text-brand-forest"
              >
                <ShieldCheck className="h-3 w-3" aria-hidden />
                {b}
              </span>
            ))}
          </div>
        </>
      )}

      {/* Copy placed in the ad */}
      {zones.length > 0 && (
        <>
          <FieldLabel>Copy placed in the ad</FieldLabel>
          <div className="flex flex-col gap-1 rounded-xl border border-brand-sage/25 bg-brand-cream/40 p-3 text-[11px] leading-relaxed text-brand-slate">
            {zones.map((z, i) => (
              <div key={i}>
                <b className="font-semibold text-brand-forest">{z.element}</b> @ {z.position}:{' '}
                &ldquo;{z.text}&rdquo;
              </div>
            ))}
          </div>
        </>
      )}

      {/* Reference images */}
      {refs.length > 0 ? (
        <>
          <FieldLabel>Reference images (used for image-to-image)</FieldLabel>
          <div className="rounded-xl border border-brand-sage/25 bg-brand-cream/40 p-3 text-[11px] leading-relaxed text-brand-slate">
            {refs.map((r, i) => (
              <div key={i} className="truncate">
                {r}
              </div>
            ))}
          </div>
        </>
      ) : (
        <WarnRow>
          No product reference image — go back to step 1 (Concept), add reference images, and
          rebuild for accurate product fidelity.
        </WarnRow>
      )}
    </div>
  );
}
