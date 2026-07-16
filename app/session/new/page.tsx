import { redirect } from 'next/navigation';
import { requirePageMember } from '@/lib/auth/guards';
import { ProductSelector } from './product-selector';
import { Breadcrumb } from '@/components/Breadcrumb';

export default async function NewSessionPage({
  searchParams,
}: {
  searchParams?: { flow?: string };
}) {
  const { profile, service: serviceClient, workspaceId } = await requirePageMember();
  if (!workspaceId) redirect('/dev'); // dev without an acting workspace

  const flow = searchParams?.flow === 'brief' ? 'brief' : 'templates';

  // Products are workspace-private; exclude archived.
  const { data: products, error: productsError } = await serviceClient
    .from('products')
    .select('*')
    .eq('workspace_id', workspaceId)
    .is('archived_at', null)
    .order('brand', { ascending: true });

  if (productsError) console.error('Products fetch error:', productsError);

  const remaining = Math.max(0, (profile.usage_cap || 30) - (profile.usage_count || 0));

  const pageTitle = flow === 'brief' ? 'Start with a Brief' : 'Use a Template';
  const pageDesc  = flow === 'brief'
    ? 'Select a product to build your brief around.'
    : 'Select a product to generate ad images.';

  return (
    <div className="animate-fade-in">
      <Breadcrumb crumbs={[{ label: pageTitle }]} />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-forest">{pageTitle}</h1>
        <p className="text-sm text-brand-slate mt-1">
          {pageDesc}{' '}
          <span className="font-medium text-brand-forest">{remaining} generations remaining</span>
        </p>
      </div>
      <ProductSelector products={products || []} flow={flow} />
    </div>
  );
}
