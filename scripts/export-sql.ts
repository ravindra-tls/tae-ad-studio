/**
 * scripts/export-sql.ts
 *
 * Reads all seed data files and outputs a single SQL file with UPSERT
 * statements ready to paste into Supabase SQL Editor.
 *
 * Run with:
 *   ./node_modules/.bin/tsx scripts/export-sql.ts > research-seed.sql
 */

import { shilajitMenopausalEU }   from '../lib/research/seed-data/shilajit-menopausal-eu';
import { flexFineUsAdults }        from '../lib/research/seed-data/flex-fine-us-adults';
import { manjishGlowElixirMe }     from '../lib/research/seed-data/manjish-glow-elixir-me';
import { kesaradiDailyGlowMe }     from '../lib/research/seed-data/kesaradi-daily-glow-me';
import { balaayahBodyBoosterMe }   from '../lib/research/seed-data/balaayah-body-booster-me';
import { toneqUs }                 from '../lib/research/seed-data/toneq-us';
import { ayuttvaSleeGummiesUs }    from '../lib/research/seed-data/ayuttva-sleep-gummies-us';
import { firmFocusNeckMaskUs }     from '../lib/research/seed-data/firm-focus-neck-mask-us';
import { blavanaBodyLotionUs }     from '../lib/research/seed-data/blavana-body-lotion-us';
import { rufoliaEyemulsionSg }     from '../lib/research/seed-data/rufolia-eyemulsion-sg';
import type { PositioningResearch } from '../lib/research/types';

const ALL: PositioningResearch[] = [
  shilajitMenopausalEU,    // Shilajit / UK/EU / Menopausal Women 45-65+
  flexFineUsAdults,         // Flex & Fine / US / Active Adults 50+
  manjishGlowElixirMe,      // Manjish Glow Elixir / ME
  kesaradiDailyGlowMe,      // Kesaradi Daily Glow / ME
  balaayahBodyBoosterMe,    // Balaayah Black Gram Body Booster / ME
  toneqUs,                  // TonEQ / US
  ayuttvaSleeGummiesUs,     // Ayuttva Sleep Gummies / US
  firmFocusNeckMaskUs,      // Firm-Focus Neck Mask / US
  blavanaBodyLotionUs,      // Blavana Body Lotion / US
  rufoliaEyemulsionSg,      // Rufolia Pro Periorbital Eyemulsion / SG
];

const lines: string[] = [
  '-- ============================================================',
  '-- TAE Ad Studio — positioning_research seed',
  `-- Generated: ${new Date().toISOString()}`,
  `-- Records: ${ALL.length}`,
  '-- Run in: Supabase Dashboard → SQL Editor',
  '-- ============================================================',
  '',
];

for (const r of ALL) {
  const json = JSON.stringify(r);
  lines.push(`-- ${r.product_name} / ${r.market} / ${r.segment}`);
  lines.push(`INSERT INTO positioning_research`);
  lines.push(`  (product_name, brand, market, segment, research, research_type, is_active)`);
  lines.push(`VALUES (`);
  lines.push(`  '${r.product_name.replace(/'/g, "''")}',`);
  lines.push(`  '${r.brand.replace(/'/g, "''")}',`);
  lines.push(`  '${r.market.replace(/'/g, "''")}',`);
  lines.push(`  '${r.segment.replace(/'/g, "''")}',`);
  lines.push(`  $research$${json}$research$::jsonb,`);
  lines.push(`  '${r.research_type}',`);
  lines.push(`  true`);
  lines.push(`)`);
  lines.push(`ON CONFLICT (product_name, market, segment) DO UPDATE SET`);
  lines.push(`  brand         = EXCLUDED.brand,`);
  lines.push(`  research      = EXCLUDED.research,`);
  lines.push(`  research_type = EXCLUDED.research_type,`);
  lines.push(`  is_active     = EXCLUDED.is_active,`);
  lines.push(`  updated_at    = now();`);
  lines.push('');
}

lines.push('-- Done.');
process.stdout.write(lines.join('\n'));
