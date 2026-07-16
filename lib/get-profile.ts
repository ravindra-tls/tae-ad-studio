import { createClient, createServiceClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function getProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const serviceClient = await createServiceClient();
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('id, full_name, email, role, workspace_id')
    .eq('id', user.id)
    .single();

  return profile;
}
