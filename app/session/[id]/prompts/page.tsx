import { redirect } from 'next/navigation';
import { requirePageMember } from '@/lib/auth/guards';
import { PromptWorkspace } from './prompt-workspace';
import { resolveReferenceImages } from '@/lib/storage/reference-images';
import { isEnabled } from '@/lib/feature-flags';
import type { ProductImage } from '@/types';

export default async function PromptsPage({ params }: { params: { id: string } }) {
  // Cached guard — the session layout already resolved auth this request.
  // Service client for all data fetching bypasses RLS (house pattern).
  const { user, profile, service: serviceClient } = await requirePageMember();

  // `*` includes workspace_id — the session's workspace scopes which
  // templates are visible below. Must resolve first: everything after
  // depends on the session row (workspace, product).
  const { data: session } = await serviceClient
    .from('sessions')
    .select('*, product:products(*)')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (!session) redirect('/dashboard');

  const workspaceId: string | null = session.workspace_id ?? null;

  // Union catalog: universal templates + this session's workspace's own,
  // active only. Rows keep workspace_id so the client can badge scope.
  let templatesQuery = serviceClient
    .from('prompt_templates')
    .select('*')
    .eq('is_active', true);
  templatesQuery = workspaceId
    ? templatesQuery.or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`)
    : templatesQuery.is('workspace_id', null);

  // ── One parallel stage: templates + reference images + feature flag ──────
  const [{ data: templates }, { data: refImages }, briefFirstEnabled] = await Promise.all([
    templatesQuery.order('number', { ascending: true }),
    serviceClient
      .from('product_images')
      .select('*')
      .eq('product_id', session.product_id)
      .eq('is_reference', true),
    // Feature flag: when `concept_forge_ui` is on for this user, surface a link
    // to the Concept Forge entry point alongside the existing template grid.
    isEnabled('concept_forge_ui', user.id),
  ]);

  // For reference rows that live in the private bucket, mint a signed URL and
  // project it onto `url` so PromptWorkspace can treat every row the same.
  // Legacy rows (with `url` already set) pass through unchanged.
  const resolved = await resolveReferenceImages((refImages || []) as ProductImage[]);
  const referenceImages: ProductImage[] = resolved.map((r) => ({
    ...r,
    url: r.resolved_url,
  }));

  return (
    <PromptWorkspace
      session={session}
      product={session.product}
      templates={templates || []}
      referenceImages={referenceImages}
      remainingCredits={Math.max(0, (profile.usage_cap || 30) - (profile.usage_count || 0))}
      briefFirstEnabled={briefFirstEnabled}
    />
  );
}
