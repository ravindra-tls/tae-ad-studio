/**
 * Server-side brand configuration access.
 *
 * One row, id = 1. Seeded by migration 008 so reads never return null
 * in a healthy environment.
 *
 * The pipeline calls `getBrandConfig()` at stage boundaries (brief,
 * concept, copy, critique) to pass voice/visual/non-negotiables into
 * the LLM prompts.
 *
 * Writes happen through /api/admin/brand-config (admin-only).
 */

import { createServiceClient } from '@/lib/supabase/server';
import type { BrandConfig } from '@/types';

export type BrandConfigResult =
  | { ok: true; config: BrandConfig }
  | { ok: false; reason: 'table_missing' | 'row_missing' | 'error'; message: string };

/**
 * Strict loader that distinguishes:
 *   - table_missing: migration 008 hasn't run yet
 *   - row_missing:   table exists but no id=1 row (migration seed didn't run)
 *   - error:         any other Postgres/network failure
 *
 * Prefer this inside admin pages so we can surface a specific fix to the
 * operator.
 */
export async function getBrandConfigStrict(): Promise<BrandConfigResult> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from('brand_config')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (error) {
    // 42P01 = undefined_table
    const code = (error as { code?: string }).code;
    if (code === '42P01') {
      return { ok: false, reason: 'table_missing', message: error.message };
    }
    console.error('[brand-config] getBrandConfigStrict failed:', error.message);
    return { ok: false, reason: 'error', message: error.message };
  }

  if (!data) return { ok: false, reason: 'row_missing', message: 'No row with id=1' };
  return { ok: true, config: data as BrandConfig };
}

/**
 * Convenience loader for pipeline code that just wants the config or null.
 * Swallows all errors — callers that need to distinguish failure modes
 * should use `getBrandConfigStrict` instead.
 */
export async function getBrandConfig(): Promise<BrandConfig | null> {
  const result = await getBrandConfigStrict();
  return result.ok ? result.config : null;
}
