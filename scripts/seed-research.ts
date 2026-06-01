/**
 * Seed script: insert positioning research into the DB.
 *
 * Run with:
 *   npx tsx scripts/seed-research.ts
 *
 * Requires environment variables (from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Each entry is upserted on (product_name, market, segment) — safe to re-run.
 *
 * ── Status ──────────────────────────────────────────────────────────────────
 *   ✅  Shilajit          / UK/EU / Menopausal Women 45-65+  (from source DOCX)
 *   ✅  Flex & Fine       / US    / Active Adults 50+          (AI generated)
 *
 *   ── Add per-product entries below as they are generated ──────────────────
 *   🔄  Manjish Glow Elixir     / ME  / [segment]
 *   🔄  Manjish Glow Elixir     / IL  / [segment]
 *   🔄  Kesaradi Daily Glow     / ME  / [segment]
 *   🔄  Kesaradi Daily Glow     / IL  / [segment]
 *   🔄  Balaayah Black Gold     / ME  / [segment]
 *   🔄  Blavana Body Lotion     / [market] / [segment]
 *   🔄  Firm-Focus Neck Cream   / [market] / [segment]
 *   🔄  Rufolia Pro Perioral    / [market] / [segment]
 *   🔄  TonEQ                   / [market] / [segment]
 *   🔄  Ayuttva Sleep Guide     / [market] / [segment]
 * ────────────────────────────────────────────────────────────────────────────
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createClient } from '@supabase/supabase-js';

import { shilajitMenopausalEU } from '../lib/research/seed-data/shilajit-menopausal-eu';
import { flexFineUsAdults }      from '../lib/research/seed-data/flex-fine-us-adults';
import type { PositioningResearch } from '../lib/research/types';

// ── Load .env.local ───────────────────────────────────────────────────────────

function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    const [, k, v] = m;
    if (process.env[k]) continue;
    process.env[k] = v.replace(/^['"]|['"]$/g, '');
  }
}

// ── Confirmed research to seed ────────────────────────────────────────────────
// Only entries whose product_name exactly matches products.name in the DB.

const ALL_RESEARCH: PositioningResearch[] = [
  shilajitMenopausalEU,  // product_name: 'Shilajit'
  flexFineUsAdults,       // product_name: 'Flex & Fine'

  // Add new per-product entries here as they are generated:
  // e.g. manjishGlowElixirMe,
  // e.g. kesaradiDailyGlowMe,
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  loadEnvLocal();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  console.log(`\n📊 TAE Ad Studio — Research Seeder`);
  console.log(`   Seeding ${ALL_RESEARCH.length} research documents...\n`);

  let passed = 0;
  let failed = 0;

  for (const research of ALL_RESEARCH) {
    const label = `${research.product_name} / ${research.market} / ${research.segment}`;
    process.stdout.write(`  → ${label} ... `);

    const { data, error } = await supabase
      .from('positioning_research')
      .upsert(
        {
          product_name:  research.product_name,
          brand:         research.brand,
          market:        research.market,
          segment:       research.segment,
          research,
          research_type: research.research_type,
          is_active:     true,
        },
        { onConflict: 'product_name,market,segment' },
      )
      .select('id')
      .single();

    if (error) {
      console.log(`❌ FAILED`);
      console.error(`     ${error.message}`);
      failed++;
    } else {
      console.log(`✅  (id: ${data.id})`);
      passed++;
    }
  }

  console.log(`\n─────────────────────────────────────────`);
  console.log(`  Seeded:  ${passed}/${ALL_RESEARCH.length}`);
  if (failed > 0) {
    console.log(`  Failed:  ${failed}`);
    process.exit(1);
  }
  console.log(`\n🎉 All done!\n`);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
