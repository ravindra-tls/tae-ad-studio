/**
 * Concept Forge workspace (gated by feature flag `concept_forge_ui`).
 *
 * Server shell: auth → flag gate → session ownership + `source === 'forge'`
 * check → resolved product reference images. The client store then fetches
 * GET /api/forge/session/[id] + GET /api/forge/taxonomies on mount (with a
 * loading skeleton) — this page never imports lib/forge server modules.
 *
 * `?concept=<cardId>` deep-links the finalized-concept detail; the client
 * derives it from useSearchParams.
 */

import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { isEnabled } from '@/lib/feature-flags';
import { resolveReferenceImages } from '@/lib/storage/reference-images';
import { ForgeWorkspace } from './forge-workspace';
import type { ProductImage } from '@/types';
import type { DeckPain, DeckPersona, ProductRefImage, TrimmedDeck } from './state/types';

export default async function ForgePage({
  params,
}: {
  params: { id: string };
  searchParams?: { concept?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // ── Flag gate: off → users land on the template flow ─────────────────────
  const flagOn = await isEnabled('concept_forge_ui', user.id);
  if (!flagOn) redirect(`/session/${params.id}/prompts`);

  // ── Session (service client + explicit ownership — house pattern) ────────
  const service = await createServiceClient();
  const { data: sessionRow } = await service
    .from('sessions')
    .select('*, product:products(*)')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (!sessionRow) redirect('/dashboard');
  // Only forge sessions render this workspace.
  if (sessionRow.source !== 'forge') redirect(`/session/${params.id}/prompts`);

  const product = sessionRow.product as { name?: string; thumbnail_url?: string | null } | null;

  // ── Product reference images, resolved to fetchable URLs ─────────────────
  const { data: refImages } = await service
    .from('product_images')
    .select('*')
    .eq('product_id', sessionRow.product_id)
    .eq('is_reference', true);

  const resolved = await resolveReferenceImages((refImages || []) as ProductImage[]);
  let productImages: ProductRefImage[] = resolved.map((r) => ({
    url: r.resolved_url,
    label: r.label,
  }));
  if (!productImages.length && product?.thumbnail_url) {
    productImages = [{ url: product.thumbnail_url, label: 'Product thumbnail' }];
  }

  // ── Best-effort deck snapshot (fallback if GET session/[id] omits `deck`;
  //    composer selects degrade gracefully if neither source has it) ────────
  let initialDeck: TrimmedDeck | null = null;
  try {
    const { data: deckRow } = await service
      .from('product_decks')
      .select('deck')
      .eq('product_id', sessionRow.product_id)
      .maybeSingle();
    const deck = (deckRow?.deck ?? null) as Record<string, unknown> | null;
    if (deck) {
      initialDeck = {
        brand: String(deck.brand ?? product?.name ?? ''),
        product: typeof deck.product === 'string' ? deck.product : undefined,
        oneLiner: typeof deck.oneLiner === 'string' ? deck.oneLiner : undefined,
        anchorType: typeof deck.anchorType === 'string' ? deck.anchorType : undefined,
        personas: Array.isArray(deck.personas) ? (deck.personas as DeckPersona[]) : [],
        pains: Array.isArray(deck.pains) ? (deck.pains as DeckPain[]) : [],
        approvedLanguage: Array.isArray(deck.approvedLanguage)
          ? (deck.approvedLanguage as string[])
          : undefined,
      };
    }
  } catch {
    /* table may not exist yet in a fresh env — client fetch covers it */
  }

  return (
    <Suspense fallback={null}>
      <ForgeWorkspace
        sessionId={params.id}
        productName={product?.name || 'Product'}
        productImages={productImages}
        initialDeck={initialDeck}
      />
    </Suspense>
  );
}
