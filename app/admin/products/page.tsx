import { createServiceClient } from '@/lib/supabase/server';
import { ProductContextViewer } from './product-context-viewer';
import type { ProductDeckRow } from './forge-deck-panel';
import type { Product } from '@/types';
import type { PositioningResearch } from '@/lib/research/types';

export const dynamic = 'force-dynamic';

export type ResearchRow = {
  id: string;
  product_name: string;
  brand: string;
  market: string;
  segment: string;
  research: PositioningResearch;
  research_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export default async function AdminProductsPage() {
  const supabase = await createServiceClient();

  const [{ data: products }, { data: researchRows }, { data: deckRows }] = await Promise.all([
    supabase.from('products').select('*').order('brand'),
    supabase.from('positioning_research').select('*').eq('is_active', true),
    supabase.from('product_decks').select('product_id, deck, overrides, source_hash, model_id, distilled_at'),
  ]);

  // Build a map keyed by product_name (lowercase) for fast lookup
  const researchByProduct: Record<string, ResearchRow> = {};
  for (const row of (researchRows ?? []) as ResearchRow[]) {
    researchByProduct[row.product_name.toLowerCase()] = row;
  }

  // Concept Forge grounding decks, keyed by product id
  const decksByProduct: Record<string, ProductDeckRow> = {};
  for (const row of (deckRows ?? []) as ProductDeckRow[]) {
    decksByProduct[row.product_id] = row;
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-4 flex items-center justify-between stagger-item" style={{ animationDelay: '40ms' }}>
        <h1 className="text-xl font-bold text-brand-forest">Products</h1>
        <span className="text-xs text-brand-slate bg-brand-cream px-2 py-1 rounded">
          {(products || []).length} product{(products || []).length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="stagger-item" style={{ animationDelay: '100ms' }}>
        <ProductContextViewer
          products={(products || []) as Product[]}
          researchByProduct={researchByProduct}
          decksByProduct={decksByProduct}
        />
      </div>
    </div>
  );
}
