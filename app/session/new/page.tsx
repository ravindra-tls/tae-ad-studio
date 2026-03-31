import { createClient, createServiceClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ProductSelector } from './product-selector';
import { Breadcrumb } from '@/components/Breadcrumb';

export default async function NewSessionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('usage_count, usage_cap')
    .eq('id', user.id)
    .single();

  // Use service client to bypass RLS for global product data
  const serviceClient = await createServiceClient();
  const { data: products, error: productsError } = await serviceClient
    .from('products')
    .select('*')
    .order('brand', { ascending: true });

  if (productsError) console.error('Products fetch error:', productsError);

  const remaining = Math.max(0, (profile?.usage_cap || 30) - (profile?.usage_count || 0));

  return (
    <div className="animate-fade-in">
      <Breadcrumb crumbs={[{ label: 'New Session' }]} />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-forest">New Session</h1>
        <p className="text-sm text-brand-slate mt-1">
          Select a product to generate ad images.{' '}
          <span className="font-medium text-brand-forest">{remaining} generations remaining</span>
        </p>
      </div>
      <ProductSelector products={products || []} />
    </div>
  );
}
