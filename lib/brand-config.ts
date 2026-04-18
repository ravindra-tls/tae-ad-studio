/**
 * Server-side brand configuration access.
 *
 * One row, id = 1. Seeded by migration 008 so reads never return null.
 * The pipeline calls `getBrandConfig()` at stage boundaries (brief,
 * concept, copy, critique) to pass voice/visual/non-negotiables into
 * the LLM prompts.
 *
 * Writes happen through /api/admin/brand-config (admin-only).
 */

import { createServiceClient } from '@/lib/supabase/server';
import type { BrandConfig } from '@/types';

export async function getBrandConfig(): Promise<BrandConfig | null> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from('brand_config')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (error) {
    console.error('[brand-config] getBrandConfig failed:', error.message);
    return null;
  }
  return (data as BrandConfig | null) ?? null;
}
