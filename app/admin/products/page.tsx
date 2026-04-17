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
      <div className="mb-4 flex items-center justify-between stagger-item" style={{ animationDelay: '40ms' }}>
        <h1 className="text-xl font-bold text-brand-forest">Products</h1>
        <span className="text-xs text-brand-slate bg-brand-cream px-2 py-1 rounded">
          {(products || []).length} product{(products || []).length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="stagger-item" style={{ animationDelay: '100ms' }}>
        <ProductContextViewer products={(products || []) as Product[]} />
      </div>
    </div>
  );
}
