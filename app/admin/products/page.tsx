import { createServiceClient } from '@/lib/supabase/server';
import { ProductContextViewer } from './product-context-viewer';
import type { Product } from '@/types';

export default async function AdminProductsPage() {
  const supabase = await createServiceClient();

  const { data: products } = await supabase
    .from('products')
    .select('*')
    .order('brand');

  return (
    <div className="animate-fade-in">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-brand-forest">Products</h1>
        <span className="text-xs text-brand-slate bg-brand-cream px-2 py-1 rounded">
          {(products || []).length} products
        </span>
      </div>
      <ProductContextViewer products={(products || []) as Product[]} />
    </div>
  );
}
