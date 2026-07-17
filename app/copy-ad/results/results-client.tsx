'use client';

/**
 * CopyAdResults — client half of the copy-ad results page.
 *
 * Cards are the canonical ImageCard at their natural aspect ratio
 * (aspect_ratio column) — completed cards get Download + flip-to-prompt,
 * pending cards render the queued tile and are polled every 2.5s against
 * /api/generate/{id}/status until terminal (no more "refresh the page"),
 * failed/nsfw cards render the wine tile.
 *
 * Layout (grouping by reference ad, header copy, SubmitAsTemplateButton,
 * "Open in gallery" links) is carried over from the old server-rendered page.
 */

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ImageCard } from '@/components/ImageCard';
import { cn, downloadImage } from '@/lib/utils';
import { SubmitAsTemplateButton } from './submit-as-template-button';
import type { GeneratedImage } from '@/types';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CopyAdProduct {
  id:            string;
  name:          string;
  brand:         string | null;
  sub_brand:     string | null;
  thumbnail_url: string | null;
}

export interface CopyAdSessionRow {
  id:                  string;
  reference_image_url: string | null;
  product:             CopyAdProduct | null;
}

interface CopyAdResultsProps {
  groupId:  string;
  sessions: CopyAdSessionRow[];
  /** Latest generated image per session id (missing = row not created yet). */
  imageBySession: Record<string, GeneratedImage | undefined>;
}

const POLL_INTERVAL_MS = 2500;

function isTerminal(status: GeneratedImage['status'] | undefined): boolean {
  return status === 'completed' || status === 'failed' || status === 'nsfw';
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CopyAdResults({ groupId, sessions, imageBySession }: CopyAdResultsProps) {
  const router = useRouter();

  // Live patches keyed by image id — the poll promotes queued/in_progress
  // rows to their terminal state without a page refresh.
  const [overrides, setOverrides] = useState<Record<string, Partial<GeneratedImage>>>({});

  // Effective image per session = server row + any live patch.
  const images = useMemo(() => {
    const map: Record<string, GeneratedImage | undefined> = {};
    for (const s of sessions) {
      const base = imageBySession[s.id];
      map[s.id] = base ? (overrides[base.id] ? { ...base, ...overrides[base.id] } : base) : undefined;
    }
    return map;
  }, [sessions, imageBySession, overrides]);

  // ── Group sessions by their reference image URL ───────────────────────────
  const refGroups = useMemo(() => {
    const map = new Map<string, CopyAdSessionRow[]>();
    for (const s of sessions) {
      const key = s.reference_image_url ?? '';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries()).map(([refUrl, grpSessions]) => ({
      refUrl:   refUrl || null,
      sessions: grpSessions,
    }));
  }, [sessions]);

  const isMultiRef        = refGroups.length > 1;
  const referenceImageUrl = refGroups[0]?.refUrl ?? null;

  // ── Poll non-terminal images every 2.5s until everything settles ──────────
  const pendingIds = useMemo(
    () => sessions
      .map((s) => images[s.id])
      .filter((img): img is GeneratedImage => !!img && !isTerminal(img.status))
      .map((img) => img.id),
    [sessions, images],
  );
  // Sessions whose image row hasn't landed yet — nothing to poll by id, so
  // re-fetch server data until the rows exist.
  const missingRows = sessions.some((s) => !imageBySession[s.id]);

  useEffect(() => {
    if (pendingIds.length === 0 && !missingRows) return;

    const tick = async () => {
      if (missingRows) router.refresh();
      if (pendingIds.length === 0) return;

      const results = await Promise.all(
        pendingIds.map(async (id) => {
          try {
            const res  = await fetch(`/api/generate/${id}/status`);
            const data = await res.json();
            return {
              id,
              status:   data.status as GeneratedImage['status'],
              imageUrl: data.imageUrl as string | null | undefined,
              error:    data.error as string | null | undefined,
            };
          } catch {
            return null;
          }
        }),
      );

      const patches: Record<string, Partial<GeneratedImage>> = {};
      for (const r of results) {
        if (!r) continue;
        if (r.status === 'completed' && r.imageUrl) {
          patches[r.id] = { status: 'completed', image_url: r.imageUrl };
        } else if (r.status === 'failed' || r.status === 'nsfw') {
          patches[r.id] = { status: r.status, error_message: r.error ?? null };
        }
      }
      if (Object.keys(patches).length > 0) {
        setOverrides((prev) => ({ ...prev, ...patches }));
      }
    };

    const id = setInterval(tick, POLL_INTERVAL_MS);
    tick();
    return () => clearInterval(id);
  // Re-arm only when the set of pending ids (or the missing-row flag) changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingIds.join(','), missingRows]);

  const pendingCount = sessions.filter((s) => !isTerminal(images[s.id]?.status)).length;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in max-w-5xl mx-auto">
      {/* ── Header ── */}
      <div className="mb-8 flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Dashboard
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-brand-forest">Copy-Ad Results</h1>
          <p className="text-sm text-brand-slate mt-0.5">
            {sessions.length} product{sessions.length !== 1 ? 's' : ''} generated from your reference ad
          </p>
        </div>

        <SubmitAsTemplateButton groupId={groupId} />
      </div>

      {/* ── Reference image(s) header ── */}
      {isMultiRef ? (
        /* Multi-reference: compact strip showing all refs */
        <div className="mb-8 rounded-2xl border border-brand-forest/10 bg-brand-cream/30 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-slate mb-3">
            Reference Ads Used ({refGroups.length})
          </p>
          <div className="flex flex-wrap gap-3">
            {refGroups.map((g, i) => g.refUrl && (
              <div key={i} className="flex items-center gap-2">
                <div className="relative h-14 w-14 shrink-0 rounded-lg overflow-hidden border border-brand-forest/10 bg-white">
                  <Image src={g.refUrl} alt={`Reference ${i + 1}`} fill className="object-contain" />
                </div>
                <span className="text-[11px] text-brand-slate">
                  Ref {i + 1} · {g.sessions.length} product{g.sessions.length !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : referenceImageUrl ? (
        /* Single reference: original expanded layout */
        <div className="mb-8 rounded-2xl border border-brand-forest/10 bg-brand-cream/30 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-slate mb-3">Reference Ad Used</p>
          <div className="flex items-start gap-4">
            <div className="relative h-36 w-36 shrink-0 rounded-xl overflow-hidden border border-brand-forest/10 bg-white">
              <Image src={referenceImageUrl} alt="Reference ad" fill className="object-contain" />
            </div>
            <div className="pt-1">
              <p className="text-sm font-medium text-brand-forest mb-1">
                AI extracted the creative pattern from this ad
              </p>
              <p className="text-xs text-brand-slate leading-relaxed max-w-xs">
                The composition, visual style, and layout were extracted and then adapted for each of your selected products — without copying any hardcoded text or exact visuals.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Live progress note while generating ── */}
      {pendingCount > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-2 text-sm text-amber-800">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          {pendingCount} image{pendingCount !== 1 ? 's' : ''} still generating — results appear here automatically.
        </div>
      )}

      {/* ── Results grid (grouped by reference when multi-ref) ── */}
      {isMultiRef ? (
        /* Multi-reference: one section per reference */
        <div className="space-y-10">
          {refGroups.map((group, gIdx) => (
            <div key={gIdx}>
              {/* Section header */}
              <div className="flex items-center gap-3 mb-4">
                {group.refUrl && (
                  <div className="relative h-10 w-10 shrink-0 rounded-lg overflow-hidden border border-brand-forest/10">
                    <Image src={group.refUrl} alt={`Reference ${gIdx + 1}`} fill className="object-cover" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-brand-forest">Reference {gIdx + 1}</p>
                  <p className="text-xs text-brand-slate">{group.sessions.length} product{group.sessions.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                {group.sessions.map((session, i) => (
                  <ResultCard key={session.id} session={session} image={images[session.id]} index={i} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Single reference: original flat grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
          {sessions.map((session, i) => (
            <ResultCard key={session.id} session={session} image={images[session.id]} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Result card ──────────────────────────────────────────────────────────────

function ResultCard({
  session,
  image,
  index,
}: {
  session: CopyAdSessionRow;
  image:   GeneratedImage | undefined;
  index:   number;
}) {
  const product = session.product;
  const done    = image?.status === 'completed';
  const failed  = image?.status === 'failed' || image?.status === 'nsfw';

  // Sessions whose image row hasn't landed yet render as queued.
  const cardImage: GeneratedImage = image ?? {
    id:            `pending-${session.id}`,
    session_id:    session.id,
    prompt_used:   '',
    aspect_ratio:  '1:1',
    image_url:     null,
    api_provider:  '',
    model_id:      null,
    request_id:    null,
    template_id:   null,
    status:        'queued',
    error_message: null,
    created_at:    '',
  };

  const handleDownload = () => {
    if (!image?.image_url) return;
    const slug = (product?.name ?? 'ad').toLowerCase().replace(/\s+/g, '-');
    downloadImage(image.image_url, `tae-copy-ad-${slug}-${image.id.slice(0, 6)}.png`);
  };

  return (
    <div className="flex flex-col">
      <ImageCard
        image={cardImage}
        index={index}
        status={cardImage.status}
        onDownload={done ? handleDownload : undefined}
      />

      {/* Info footer */}
      <div className="mt-2.5 px-1">
        <div className="flex items-center gap-2">
          {product?.thumbnail_url && (
            <div className="relative h-6 w-6 shrink-0 rounded overflow-hidden border border-brand-forest/10">
              <Image src={product.thumbnail_url} alt="" fill className="object-cover" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-brand-forest truncate">
              {product?.name || 'Unknown product'}
            </p>
            <p className="text-[11px] text-brand-slate truncate">
              {product?.sub_brand || product?.brand}
            </p>
          </div>
          <Badge
            variant="secondary"
            className={cn(
              'text-[10px] shrink-0',
              done   ? 'bg-green-50 text-green-700' :
              failed ? 'bg-red-50 text-red-700'     :
                       'bg-amber-50 text-amber-700',
            )}
          >
            {done ? 'Ready' : failed ? 'Failed' : 'Generating'}
          </Badge>
        </div>

        <Link
          href={`/session/${session.id}/results`}
          className="mt-2 flex items-center gap-1 text-[11px] text-brand-teal hover:underline"
        >
          Open in gallery <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
