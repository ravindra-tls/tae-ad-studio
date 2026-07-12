import { createClient, createServiceClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { PromptWorkspace } from './prompt-workspace';
import { resolveReferenceImages } from '@/lib/storage/reference-images';
import { isEnabled } from '@/lib/feature-flags';
import type { ProductImage } from '@/types';

export default async function PromptsPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Use service client for all data fetching to bypass RLS issues
  const serviceClient = await createServiceClient();

  const { data: session } = await serviceClient
    .from('sessions')
    .select('*, product:products(*)')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (!session) redirect('/dashboard');

  const { data: profile } = await serviceClient
    .from('profiles')
    .select('usage_count, usage_cap')
    .eq('id', user.id)
    .single();

  const { data: templates } = await serviceClient
    .from('prompt_templates')
    .select('*')
    .order('number', { ascending: true });

  const { data: refImages } = await serviceClient
    .from('product_images')
    .select('*')
    .eq('product_id', session.product_id)
    .eq('is_reference', true);

  // For reference rows that live in the private bucket, mint a signed URL and
  // project it onto `url` so PromptWorkspace can treat every row the same.
  // Legacy rows (with `url` already set) pass through unchanged.
  const resolved = await resolveReferenceImages((refImages || []) as ProductImage[]);
  const referenceImages: ProductImage[] = resolved.map((r) => ({
    ...r,
    url: r.resolved_url,
  }));

  // Feature flag: when `concept_forge_ui` is on for this user, surface a link
  // to the Concept Forge entry point alongside the existing template grid.
  const briefFirstEnabled = await isEnabled('concept_forge_ui', user.id);

  return (
    <PromptWorkspace
      session={session}
      product={session.product}
      templates={templates || []}
      referenceImages={referenceImages}
      remainingCredits={Math.max(0, (profile?.usage_cap || 30) - (profile?.usage_count || 0))}
      briefFirstEnabled={briefFirstEnabled}
    />
  );
}
