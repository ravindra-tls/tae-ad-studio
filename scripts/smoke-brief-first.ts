/**
 * End-to-end smoke for the brief-first pipeline.
 *
 * Runs stages 1 (brief) and 2 (concept with dual sameness) against real Claude
 * using a realistic TAE product + freeform objective. No DB writes — we call
 * the stages directly, not the HTTP routes, so nothing lands in Supabase.
 *
 * Usage:   npx tsx scripts/smoke-brief-first.ts
 * Env:     ANTHROPIC_API_KEY loaded from .env.local (read and exported below)
 *
 * Exit 0 on pass; exit 1 + printed reason on any failure.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ── Load .env.local manually (no dotenv dep in this repo) ───────────────────
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
loadEnvLocal();

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('✗ ANTHROPIC_API_KEY missing from env');
  process.exit(1);
}

// Delay imports until after env is loaded — stages read the key at call time,
// but being explicit about ordering keeps debugging obvious.
import { briefStage } from '@/lib/pipeline/stages/brief';
import { conceptStage } from '@/lib/pipeline/stages/concept';
import { copyStage } from '@/lib/pipeline/stages/copy';
import { visualStage } from '@/lib/pipeline/stages/visual';
import {
  BriefStructured as BriefStructuredSchema,
  type BriefStructured,
} from '@/lib/pipeline/schemas/brief';
import { ConceptStructured as ConceptStructuredSchema } from '@/lib/pipeline/schemas/concept';
import { CopyStructured as CopyStructuredSchema } from '@/lib/pipeline/schemas/copy';
import { VisualStructured as VisualStructuredSchema } from '@/lib/pipeline/schemas/visual';
import type { StageProgress } from '@/lib/pipeline/types';
import type { BrandConfig, Product, Brief, Concept } from '@/types';

// ── Fake product (shape must match `products` row — no insert happens) ──────
const FAKE_PRODUCT: Product = {
  id: 'smoke-product-00000000-0000-0000-0000-000000000000',
  name: 'Ashwagandha Root Extract',
  brand: 'The Ayurveda Experience',
  sub_brand: 'Nyumi',
  ingredients: ['KSM-66 Ashwagandha Root Extract 600mg', 'Black pepper extract'],
  claims: [
    'Clinical dose of KSM-66 (600mg)',
    'Daily-dose adaptogen for stress + sleep',
    'Third-party tested for heavy metals',
  ],
  context:
    'Competes with gummies + cheap powder blends. Our differentiator is the root-form extract at clinical dose, backed by KSM-66 studies.',
  // extra columns (product_images, variants, etc.) are ignored by the stage
} as unknown as Product;

const FAKE_BRAND: BrandConfig = {
  id: 1,
  name: 'The Ayurveda Experience',
  voice: {
    archetype: 'Sage meets warm friend',
    do: ['speak with quiet authority', 'cite specifics', 'respect the reader'],
    dont: ['hype', 'miracle language', 'fear mongering'],
  },
  visual: {
    palette: ['forest green', 'lime', 'teal', 'cream'],
    mood: 'calm, rooted, modern, ayurvedic-but-not-dated',
  },
  non_negotiables: [
    'Never imply instant results',
    'Never mock competitors by name',
  ],
  default_strictness: 'loose',
} as unknown as BrandConfig;

const OBJECTIVE = `Convince 30-45 year-old urban Indian women who tried ashwagandha gummies and felt nothing that our clinical-dose root extract actually works by day 14. They're skeptical of wellness hype and want to see mechanism + proof, not vibes.`;

// ── Helpers ─────────────────────────────────────────────────────────────────
function log(label: string, obj: unknown) {
  console.log(`\n── ${label} ` + '─'.repeat(Math.max(0, 70 - label.length)));
  console.log(typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2));
}

function ms(start: number): string {
  return `${(Date.now() - start).toFixed(0)}ms`;
}

async function main() {
  const trace: StageProgress[] = [];

  console.log('▶ TAE brief-first E2E smoke\n');
  console.log(`  product     : ${FAKE_PRODUCT.name}`);
  console.log(`  strictness  : loose`);
  console.log(`  wild_card   : false`);
  console.log(`  objective   : ${OBJECTIVE.slice(0, 80)}…`);

  // ── Stage 1: Brief ────────────────────────────────────────────────────────
  const t1 = Date.now();
  let briefOut;
  try {
    briefOut = await briefStage.run(
      {
        objective: OBJECTIVE,
        strictness: 'loose',
        wild_card: false,
        source: 'freeform',
        brand: FAKE_BRAND,
        product: FAKE_PRODUCT,
      },
      trace,
    );
  } catch (err) {
    console.error(`\n✗ Brief stage threw: ${(err as Error).message}`);
    process.exit(1);
  }

  // Validate shape with zod at runtime (belt + suspenders on top of the
  // stage's own validation — catches regressions where the stage starts
  // returning a field the schema doesn't know about).
  const briefParse = BriefStructuredSchema.safeParse(briefOut.structured);
  if (!briefParse.success) {
    console.error('\n✗ Brief output failed schema validation:');
    console.error(briefParse.error.message);
    process.exit(1);
  }
  const brief: BriefStructured = briefParse.data;

  console.log(`\n✓ Stage 1 Brief (${ms(t1)})`);
  log('brief.audience.primary',       brief.audience.primary);
  log('brief.audience.pains',         brief.audience.pains);
  log('brief.offer.core_promise',     brief.offer.core_promise);
  log('brief.offer.proof_points',     brief.offer.proof_points);
  log('brief.hypothesis',             brief.hypothesis);
  log('brief.tone_direction',         brief.tone_direction);

  // Sanity: pains should be a non-empty array for a brief this meaty
  if (brief.audience.pains.length === 0) {
    console.warn('⚠ brief.audience.pains is empty — surprising for this objective');
  }

  // ── Stage 2: Concept (needs a `Brief` row shape) ─────────────────────────
  const fakeBriefRow: Brief = {
    id: 'smoke-brief-00000000-0000-0000-0000-000000000000',
    session_id: 'smoke-session-00000000-0000-0000-0000-000000000000',
    product_id: FAKE_PRODUCT.id,
    objective: OBJECTIVE,
    audience: brief.audience,
    offer: brief.offer,
    hypothesis: brief.hypothesis,
    structured: {
      ...brief,
      _meta: { prompt_version: briefOut.prompt_version, model: briefOut.model },
    } as unknown as Brief['structured'],
    source: 'freeform',
    strictness: 'loose',
    wild_card: false,
    approved_at: null,
    created_at: new Date().toISOString(),
  };

  const t2 = Date.now();
  let conceptOut;
  try {
    conceptOut = await conceptStage.run(
      {
        count: 4,
        brief: fakeBriefRow,
        product: FAKE_PRODUCT,
        brand: FAKE_BRAND,
      },
      trace,
    );
  } catch (err) {
    console.error(`\n✗ Concept stage threw: ${(err as Error).message}`);
    process.exit(1);
  }

  // Validate each concept
  for (let i = 0; i < conceptOut.concepts.length; i++) {
    const c = conceptOut.concepts[i];
    const p = ConceptStructuredSchema.safeParse(c);
    if (!p.success) {
      console.error(`\n✗ Concept #${i} failed schema validation: ${p.error.message}`);
      process.exit(1);
    }
  }

  console.log(`\n✓ Stage 2 Concepts (${ms(t2)}) — ${conceptOut.concepts.length} concepts, ${conceptOut.sameness_retries} retries`);

  for (let i = 0; i < conceptOut.concepts.length; i++) {
    const c = conceptOut.concepts[i];
    console.log(`\n  #${i} [${c.hook_archetype}] ${c.title}`);
    console.log(`     ${c.description.slice(0, 140)}${c.description.length > 140 ? '…' : ''}`);
  }

  // Archetype diversity (non-fatal but reported) — the concept prompt says
  // archetypes must not repeat in a batch.
  const archetypes = conceptOut.concepts.map((c) => c.hook_archetype);
  const uniqueArchs = new Set(archetypes);
  if (uniqueArchs.size < archetypes.length) {
    console.warn(
      `\n⚠ Repeated hook archetypes: ${archetypes.join(', ')}. Prompt says these should be unique.`,
    );
  } else {
    console.log(`\n✓ All ${archetypes.length} archetypes unique: ${[...uniqueArchs].join(', ')}`);
  }

  // ── Sameness rounds inspection ───────────────────────────────────────────
  console.log(`\n✓ Sameness rounds (${conceptOut.sameness_rounds.length}):`);
  for (const [idx, round] of conceptOut.sameness_rounds.entries()) {
    console.log(`\n  Round ${idx + 1}:`);
    for (const check of round.checks) {
      const verdict = check.verdict;
      if (verdict.status === 'pass') {
        console.log(`    ${check.method.padEnd(14)} → pass`);
      } else {
        console.log(
          `    ${check.method.padEnd(14)} → regenerate [${verdict.items
            .map((i) => `#${i.index}`)
            .join(', ')}]`,
        );
      }
    }
    const cosineDetails = round.checks.find(
      (c) => c.method === 'cosine_tfidf',
    )?.details;
    if (cosineDetails?.pairwise_scores) {
      const top = cosineDetails.pairwise_scores.slice(0, 3);
      console.log(
        `    cosine top pairs (threshold ${cosineDetails.threshold}): ${top
          .map((p) => `${p.i}×${p.j}=${p.score}`)
          .join(', ')}`,
      );
    }
    if (round.regenerate.length > 0) {
      console.log(`    → merged regen list: #${round.regenerate.map((r) => r.index).join(', #')}`);
    }
  }

  // ── Stage 3: Copy (run on first concept — parity with "user selected one") ─
  const fakeConceptRow: Concept = {
    id: 'smoke-concept-00000000-0000-0000-0000-000000000000',
    brief_id: fakeBriefRow.id,
    title: conceptOut.concepts[0].title,
    hook_archetype: conceptOut.concepts[0].hook_archetype,
    description: conceptOut.concepts[0].description,
    structured: conceptOut.concepts[0] as unknown as Record<string, unknown>,
    selected_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  const t3 = Date.now();
  let copyOut;
  try {
    copyOut = await copyStage.run(
      {
        brief: fakeBriefRow,
        concept: fakeConceptRow,
        product: FAKE_PRODUCT,
        brand: FAKE_BRAND,
        alternates: 3,
      },
      trace,
    );
  } catch (err) {
    console.error(`\n✗ Copy stage threw: ${(err as Error).message}`);
    process.exit(1);
  }

  const copyParse = CopyStructuredSchema.safeParse(copyOut.structured);
  if (!copyParse.success) {
    console.error(
      `\n✗ Copy output failed schema validation: ${copyParse.error.message}`,
    );
    process.exit(1);
  }
  const copy = copyParse.data;

  console.log(
    `\n✓ Stage 3 Copy (${ms(t3)}) — for concept [${fakeConceptRow.hook_archetype}] "${fakeConceptRow.title}"`,
  );
  log('copy.headline',            `"${copy.headline.text}"  — ${copy.headline.rationale}`);
  if (copy.headline_alternates.length > 0) {
    log(
      `copy.headline_alternates (${copy.headline_alternates.length})`,
      copy.headline_alternates.map((h, i) => `  ${i + 1}. "${h.text}"  — ${h.rationale}`).join('\n'),
    );
  }
  log('copy.subhead',              copy.subhead ?? '(null)');
  log('copy.body',                 copy.body);
  log('copy.cta',                  copy.cta);
  log('copy.disclosure',           copy.disclosure ?? '(null)');
  log('copy.leaning_on',           copy.leaning_on);

  // Headline sanity — ≤ 10 words per prompt. Warn, don't fail.
  const headlineWords = copy.headline.text.trim().split(/\s+/).length;
  if (headlineWords > 10) {
    console.warn(`⚠ Headline is ${headlineWords} words — prompt asks for ≤ 10.`);
  }

  // ── Stage 4: Visual (with the copy block for text-zone anchoring) ────────
  const t4 = Date.now();
  let visualOut;
  try {
    visualOut = await visualStage.run(
      {
        brief: fakeBriefRow,
        concept: fakeConceptRow,
        copy: { structured: copy as unknown as Record<string, unknown> },
        product: FAKE_PRODUCT,
        brand: FAKE_BRAND,
        aspect_ratio: '4:5',
      },
      trace,
    );
  } catch (err) {
    console.error(`\n✗ Visual stage threw: ${(err as Error).message}`);
    process.exit(1);
  }

  const visualParse = VisualStructuredSchema.safeParse(visualOut.structured);
  if (!visualParse.success) {
    console.error(
      `\n✗ Visual output failed schema validation: ${visualParse.error.message}`,
    );
    process.exit(1);
  }
  const visual = visualParse.data;

  console.log(
    `\n✓ Stage 4 Visual (${ms(t4)}) — aspect_ratio=${visual.aspect_ratio}, text_zones=${visual.text_zones.length}`,
  );
  log('visual.scene',            visual.scene);
  log('visual.subject',          visual.subject);
  log('visual.setting',          visual.setting);
  log('visual.lighting_mood',    visual.lighting_mood);
  log('visual.style',            visual.style);
  log('visual.palette',          visual.palette);
  log('visual.composition',      visual.composition);
  log('visual.text_zones',       visual.text_zones);
  log('visual.negative_prompts', visual.negative_prompts);
  log('visual.prompt_text',      visual.prompt_text);

  // Sanity: prompt_text length target 80-180 words. Warn outside range.
  const promptWords = visual.prompt_text.trim().split(/\s+/).length;
  if (promptWords < 60 || promptWords > 220) {
    console.warn(
      `⚠ prompt_text is ${promptWords} words — prompt asks for 80-180. Not fatal.`,
    );
  } else {
    console.log(`\n✓ prompt_text length: ${promptWords} words (target 80-180)`);
  }

  // Sanity: text_zones should cover every copy element that exists.
  const expectedZones = new Set<string>();
  expectedZones.add('headline');
  if (copy.subhead) expectedZones.add('subhead');
  expectedZones.add('cta');
  if (copy.disclosure) expectedZones.add('disclosure');
  const actualZones = new Set(visual.text_zones.map((z) => z.element));
  const missing = [...expectedZones].filter((e) => !actualZones.has(e as 'headline'));
  if (missing.length > 0) {
    console.warn(`⚠ Missing text_zones for copy elements: ${missing.join(', ')}`);
  } else {
    console.log(`✓ text_zones cover all present copy elements`);
  }

  // ── Trace summary (proves progress events are emitted) ───────────────────
  console.log(`\n✓ Trace events: ${trace.length}`);
  for (const ev of trace) {
    const dur = 'durationMs' in ev ? ` (${(ev as { durationMs?: number }).durationMs}ms)` : '';
    console.log(`    ${ev.stage.padEnd(8)} ${ev.status}${dur}`);
  }

  console.log('\n✓ E2E smoke passed');
  process.exit(0);
}

main().catch((err) => {
  console.error('\n✗ Unhandled smoke failure:', err);
  process.exit(1);
});
