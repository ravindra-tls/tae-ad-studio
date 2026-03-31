import { createClient, createServiceClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ImageGallery } from '@/components/ImageGallery';
import { Button } from '@/components/ui/button';
import { Plus, Pencil } from 'lucide-react';
import { Breadcrumb } from '@/components/Breadcrumb';

export default async function ResultsPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const serviceClient = await createServiceClient();

  const { data: session } = await serviceClient
    .from('sessions')
    .select('*, product:products(name, brand)')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (!session) redirect('/dashboard');

  const { data: images } = await serviceClient
    .from('generated_images')
    .select('*')
    .eq('session_id', params.id)
    .order('created_at', { ascending: false });

  const { data: profile } = await serviceClient
    .from('profiles')
    .select('usage_count, usage_cap')
    .eq('id', user.id)
    .single();

  const remaining = Math.max(0, (profile?.usage_cap || 30) - (profile?.usage_count || 0));

  return (
    <div className="animate-fade-in">

      <Breadcrumb
        crumbs={[
          { label: session.name, href: `/session/${params.id}/prompts` },
          { label: 'Results' },
        ]}
        actions={
          <>
            <Link href={`/session/${params.id}/prompts`}>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7">
                <Pencil className="h-3 w-3" /> Back to Templates
              </Button>
            </Link>
            <Link href={`/session/${params.id}/prompts`}>
              <Button size="sm" className="gap-1.5 bg-brand-forest hover:bg-brand-forest/90 text-xs h-7">
                <Plus className="h-3 w-3" /> Generate More
              </Button>
            </Link>
          </>
        }
      />

      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-brand-forest">{session.name}</h1>
        <p className="text-sm text-brand-slate mt-0.5">
          {images?.length || 0} image{images?.length !== 1 ? 's' : ''} generated · {remaining} credits remaining
        </p>
      </div>

      <ImageGallery images={images || []} />
    </div>
  );
}
