import { requirePageMember } from '@/lib/auth/guards';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ImageGallery } from '@/components/ImageGallery';
import { Button } from '@/components/ui/button';
import { Plus, Pencil } from 'lucide-react';
import { Breadcrumb } from '@/components/Breadcrumb';

export default async function ResultsPage({ params }: { params: { id: string } }) {
  // Cached guard — layout already resolved auth; profile rides along, so the
  // separate usage query is gone.
  const { user, profile, service: serviceClient } = await requirePageMember();

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

  const remaining = Math.max(0, (profile.usage_cap || 30) - (profile.usage_count || 0));

  return (
    <div className="animate-fade-in">

      <Breadcrumb
        crumbs={[
          { label: session.name, href: `/session/${params.id}/prompts` },
          { label: 'Results' },
        ]}
        actions={
          <>
            <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs h-7">
              <Link href={`/session/${params.id}/prompts`}>
                <Pencil className="h-3 w-3" /> Back to Templates
              </Link>
            </Button>
            <Button asChild size="sm" className="gap-1.5 bg-brand-forest hover:bg-brand-forest/90 text-xs h-7">
              <Link href={`/session/${params.id}/prompts`}>
                <Plus className="h-3 w-3" /> Generate More
              </Link>
            </Button>
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

      <ImageGallery
        images={images || []}
        userId={user.id}
        sessionId={params.id}
        productId={session.product_id}
      />
    </div>
  );
}
