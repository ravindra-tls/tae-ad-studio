import { createClient, createServiceClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { PromptWorkspace } from './prompt-workspace';

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

  return (
    <PromptWorkspace
      session={session}
      product={session.product}
      templates={templates || []}
      referenceImages={refImages || []}
      remainingCredits={Math.max(0, (profile?.usage_cap || 30) - (profile?.usage_count || 0))}
    />
  );
}
