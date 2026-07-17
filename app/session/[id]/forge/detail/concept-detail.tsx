'use client';

/**
 * Full-plane finalized-concept detail — takes over the main column (the
 * board hides underneath; "Back to board" or browser Back returns). Three
 * steps: 1 Concept → 2 Template & Prompt → 3 Image. Navigation is
 * `?concept=<cardId>` via native history (state-driven and idempotent — the
 * open/closed state derives from useSearchParams in the store).
 */

import { useMemo, useState } from 'react';
import { ArrowLeft, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { forgeFetch } from '../state/api';
import { useForgeStore, dedupedChampions } from '../state/forge-store';
import { useRefine } from '../state/use-refine';
import { StepCrumbs } from './step-crumbs';
import { StepConcept } from './step-concept';
import { StepTemplate } from './step-template';
import { StepImage, type GenState } from './step-image';
import type {
  Champion,
  ChampionEntry,
  DetailCardLike,
  ExportRecord,
  ExportResponse,
  ForgeTemplate,
  GenerateImageResponse,
  ImageQuality,
  ProductRefImage,
  TemplatesResponse,
} from '../state/types';

export function ConceptDetail({ productImages }: { productImages: ProductRefImage[] }) {
  const { state, detailId, closeConcept } = useForgeStore();
  const entry = dedupedChampions(state.session).find((c) => c.id === detailId);

  if (!entry) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-start gap-4 px-4 py-10">
        <div className="flex items-center gap-2 text-sm text-brand-slate">
          <Star className="h-4 w-4 text-brand-sage" aria-hidden />
          This finalized concept isn&rsquo;t available in this session anymore.
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={closeConcept}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to board
        </Button>
      </div>
    );
  }

  // key: switching concepts inside the detail resets every step/export state.
  return <DetailInner key={entry.id} entry={entry} productImages={productImages} />;
}

function DetailInner({
  entry,
  productImages,
}: {
  entry: ChampionEntry;
  productImages: ProductRefImage[];
}) {
  const { state, sessionId, closeConcept, mutate, notifyError, showSnack } = useForgeStore();
  const { refineChampion } = useRefine();

  // Prefer the full board card (richer copy for ranking + export); fall back
  // to a champion-derived stand-in when the card left the board.
  const boardCard = state.session?.board.find((b) => b.id === entry.id);
  const card: DetailCardLike = boardCard ?? {
    id: entry.id,
    dna: entry.dna,
    visualIdea: entry.champion.visualIdea || '',
    cta: entry.champion.cta || '',
  };

  const [champ, setChamp] = useState<Champion>(entry.champion);
  const [step, setStepState] = useState(1);
  const [champReached, setChampReached] = useState(1);
  const [record, setRecord] = useState<ExportRecord | null>(null);
  const [exportWarn, setExportWarn] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [swappingKind, setSwappingKind] = useState<'freeform' | number | null>(null);
  const [templates, setTemplates] = useState<ForgeTemplate[] | null>(null);
  const [quality, setQuality] = useState<ImageQuality>('medium');
  const [gen, setGen] = useState<GenState>({ status: 'idle' });
  const [refining, setRefining] = useState(false);

  const setStep = (n: number) => {
    setChampReached((r) => Math.max(r, n));
    setStepState(n);
  };

  // Hero options: headline + tagline variants, de-duplicated. Memoized on the
  // variant list so picking a different hero doesn't reshuffle the order.
  const heroOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: string[] = [];
    [champ.headline, ...(champ.taglines || [])].forEach((t) => {
      const v = (t || '').trim();
      if (v && !seen.has(v.toLowerCase())) {
        seen.add(v.toLowerCase());
        opts.push(v);
      }
    });
    return opts.length ? opts : champ.headline ? [champ.headline] : [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [champ.taglines]);

  const ensureTemplates = async () => {
    if (templates) return;
    try {
      const d = await forgeFetch<TemplatesResponse>('GET', '/api/forge/templates');
      setTemplates(d.templates || []);
    } catch {
      setTemplates([]);
    }
  };

  /** Build / rebuild the export record. `templateNumber` set = a swap from step 2. */
  const buildAd = async (templateNumber?: number | 'freeform') => {
    if (exporting) return;
    setExporting(true);
    if (templateNumber !== undefined) setSwappingKind(templateNumber);
    try {
      const data = await mutate(() =>
        forgeFetch<ExportResponse>('POST', '/api/forge/export', {
          sessionId,
          card,
          champion: champ,
          ...(templateNumber !== undefined ? { templateNumber } : {}),
        }),
      );
      setRecord(data.record);
      setExportWarn(data.error ?? null);
      setStale(false);
      setStep(2);
      void ensureTemplates();
    } catch (err) {
      notifyError(err);
    } finally {
      setExporting(false);
      setSwappingKind(null);
    }
  };

  /** Switching the hero updates the headline used everywhere downstream. */
  const onHeroChange = (headline: string) => {
    setChamp((c) => ({ ...c, headline }));
    if (record) {
      setStale(true);
      showSnack({ message: 'Hero tagline changed — rebuild the ad to use it.' });
    }
  };

  const onRegenChampion = async () => {
    if (refining) return;
    setRefining(true);
    const next = await refineChampion(card, champ);
    if (next) setChamp(next);
    setRefining(false);
  };

  const generateImage = async (rec: ExportRecord) => {
    setGen({ status: 'loading' });
    try {
      const data = await forgeFetch<GenerateImageResponse>('POST', '/api/forge/generate-image', {
        sessionId,
        cardId: card.id,
        prompt: rec.prompt,
        aspectRatio: rec.settings?.aspect_ratio,
        quality,
      });
      setGen({ status: 'done', url: data.imageUrl });
      showSnack({ message: 'Image generated' });
    } catch (err) {
      setGen({
        status: 'error',
        error: err instanceof Error ? err.message : 'Image generation failed.',
      });
    }
  };

  const onGenerate = () => {
    if (!record) return;
    setStep(3);
    void generateImage(record);
  };

  return (
    <div className="flex animate-detail-in flex-col" data-comment-scope="champion" data-comment-id={card.id}>
      {/* Detail head */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-brand-forest/10 bg-brand-cream/95 px-4 py-2.5 backdrop-blur">
        <Button variant="ghost" size="sm" className="gap-1.5 shrink-0" onClick={closeConcept}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to board
        </Button>
        <span className="truncate font-serif text-sm text-brand-forest">{champ.headline}</span>
      </div>

      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <h2 className="mb-3 flex items-center gap-2 font-serif text-xl text-brand-forest">
          <Star className="h-5 w-5 text-brand-lime" aria-hidden />
          Finalized concept
        </h2>

        <div className="mb-5">
          <StepCrumbs step={step} reached={champReached} onStep={setStep} />
        </div>

        {step === 1 && (
          <StepConcept
            card={card}
            champ={champ}
            heroOptions={heroOptions}
            onHeroChange={onHeroChange}
            refining={refining}
            onRegen={() => void onRegenChampion()}
            onBuild={() => void buildAd()}
            building={exporting && swappingKind === null}
            productImages={productImages}
          />
        )}

        {step === 2 && record && (
          <StepTemplate
            card={card}
            rec={record}
            stale={stale}
            templates={templates}
            swapping={exporting && swappingKind !== null}
            swappingKind={swappingKind}
            onSwap={(n) => void buildAd(n)}
            quality={quality}
            onQuality={setQuality}
            onGenerate={onGenerate}
            exportWarn={exportWarn}
          />
        )}

        {step === 3 && record && (
          <StepImage
            gen={gen}
            aspectRatio={record.settings?.aspect_ratio}
            onBack={() => setStep(2)}
            onRegenerate={() => void generateImage(record)}
            resultsHref={`/session/${sessionId}/results`}
          />
        )}
      </div>
    </div>
  );
}
