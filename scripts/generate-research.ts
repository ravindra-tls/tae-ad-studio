/**
 * scripts/generate-research.ts
 *
 * Local research generation script. Calls Anthropic + web search directly —
 * no HTTP timeout, full response, progress indicators.
 *
 * Saves the result as a TypeScript seed file in lib/research/seed-data/ and
 * optionally upserts to the DB (same pattern as seed-research.ts).
 *
 * Usage:
 *   npx tsx scripts/generate-research.ts \
 *     --product "Shilajit" \
 *     --brand "HERBIUS" \
 *     --market "ME" \
 *     --segment "Men 30-55" \
 *     [--context "Additional context or product description"] \
 *     [--dry-run]    (generates file but does NOT seed to DB)
 *     [--no-file]    (seeds to DB but does NOT write .ts file)
 *
 * Market codes: UK/EU | US | ME | IL
 *
 * Env vars (from .env.local or shell):
 *   ANTHROPIC_API_KEY
 *   NEXT_PUBLIC_SUPABASE_URL      (only needed without --dry-run)
 *   SUPABASE_SERVICE_ROLE_KEY     (only needed without --dry-run)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import type { PositioningResearch } from '../lib/research/types';

// ── Load .env.local (no dotenv dependency) ────────────────────────────────────

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

// ── CLI args ──────────────────────────────────────────────────────────────────

interface Args {
  product:  string;
  brand:    string;
  market:   string;
  segment:  string;
  context?: string;
  dryRun:   boolean;
  noFile:   boolean;
}

function parseArgs(): Args | null {
  const argv = process.argv.slice(2);
  const flag = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i !== -1 && i + 1 < argv.length ? argv[i + 1] : undefined;
  };

  const product = flag('product');
  const brand   = flag('brand');
  const market  = flag('market');
  const segment = flag('segment');

  if (!product || !brand || !market || !segment) return null;

  return {
    product,
    brand,
    market,
    segment,
    context: flag('context'),
    dryRun:  argv.includes('--dry-run'),
    noFile:  argv.includes('--no-file'),
  };
}

// ── File naming helpers ───────────────────────────────────────────────────────

function toSlug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** slug-to-camelCase: "shilajit-me-men" → "shilajitMeMen" */
function toCamelCase(slug: string): string {
  return slug.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `
You are a senior audience research specialist for a DTC wellness supplement brand.
Your job is to conduct deep, empathetic research into a target audience segment
and synthesise your findings into a structured research document.

## Research Methodology

Use web_search to search the following sources:

1. REDDIT COMMUNITIES — Search for authentic, unfiltered consumer voice:
   - Condition-specific subreddits relevant to the segment (e.g. r/menopause, r/testosterone, r/Nootropics)
   - r/supplements, r/Nootropics (supplement attitudes)
   - r/AskWomenOver40, r/TwoXChromosomes (female segments)
   - r/AskMen, r/Testosterone, r/malehealth (male segments)
   - Search: "[product category] reviews reddit", "[segment concern] reddit", "[health issue] natural remedy reddit"

2. AMAZON + TRUSTPILOT REVIEWS
   - Search "[product name] reviews trustpilot site:trustpilot.com"
   - Search "[product category] amazon reviews"
   - Extract real language patterns from reviewer language

3. HEALTHCARE FORUMS
   - HealthTalk.org, Patient.info, Mumsnet Health (UK)
   - WebMD forums, Healthline community (US)
   - Search "[health condition] personal stories forum"

4. CULTURAL + MARKET SOURCES
   - Government health statistics for the target market
   - Market-specific supplement regulations and attitudes
   - Cultural nuances around the health concern in the target market

## Critical Rules

1. VERBATIM QUOTES ONLY — Never invent or paraphrase quotes. Every quote in
   verbatim_quotes must come from an actual source you found. If you cannot
   find quotes for a persona, use fewer quotes rather than fabricating.

2. PERSONA SYNTHESIS — Identify 5-7 distinct emotional archetypes from actual
   patterns you find. Ground each persona in what you observed in search results.

3. HONEST LIMITATIONS — If evidence is sparse for a market or segment, say so
   in executive_summary. Do not extrapolate beyond your findings.

4. LANGUAGE ACCURACY — words_she_uses / words_they_use must be drawn from actual
   forum/review language, not invented marketing language.

5. CULTURAL ACCURACY — cultural_context must reflect actual healthcare systems,
   supplement regulations, and cultural attitudes. Do not project US norms onto
   EU or ME markets.

## CRITICAL Output Rule

Your FINAL response must be ONLY the raw JSON object — no preamble, no explanation,
no markdown fences, no text before or after. Start your response with { and end with }.

Return ONLY valid JSON matching this exact structure:

{
  "product_name": "string",
  "brand": "string",
  "market": "string",
  "segment": "string",
  "executive_summary": "string — 2-3 paragraphs of key findings",
  "key_stats": ["string — stat with source attribution"],
  "personas": [
    {
      "archetype_name": "string — evocative name e.g. 'The Desperate Searcher'",
      "age_range": "string e.g. '44-52'",
      "location": "string e.g. 'UK (London, Manchester)'",
      "tagline": "string — 1-2 sentence characterisation",
      "verbatim_quotes": ["string — exact quote from real source only"],
      "core_characteristics": ["string"],
      "deepest_fears": ["string"],
      "deepest_desires": ["string"],
      "emotional_triggers": [
        { "label": "string", "description": "string" }
      ]
    }
  ],
  "emotional_landscape": {
    "emotional_cycle": [
      { "stage": "string", "description": "string — 2-3 sentences" }
    ],
    "universal_turn_offs": ["string"],
    "universal_desires": ["string"]
  },
  "language_guide": {
    "words_she_uses": ["string — exact phrases from real sources"],
    "sounds_familiar": ["string — sensory/situational details from research"],
    "ad_hook_mapping": [
      { "hook": "string — ad hook concept", "emotional_territory": "string" }
    ]
  },
  "cultural_context": {
    "UK": "string — UK-specific messaging approach",
    "Germany": "string — optional, include if market is EU",
    "France": "string — optional",
    "Italy": "string — optional",
    "Netherlands": "string — optional",
    "UAE": "string — optional, include if market is ME",
    "Saudi Arabia": "string — optional, include if market is ME",
    "Israel": "string — optional, include if market is IL"
  },
  "supplement_landscape": {
    "journey_stages": ["string — what they tried in order"],
    "why_previous_failed": ["string"],
    "positioning_opportunity": "string — where this product fits uniquely",
    "trust_markers": ["string — what they need to see to trust a product"]
  },
  "messaging_framework": {
    "[persona_name]": "string — 1-2 sentence messaging approach for this persona"
  },
  "creative_principles": ["string — executional rules for creative teams"],
  "source_methodology": "string — list of sources searched and methodology used",
  "generated_at": "string — ISO 8601 timestamp",
  "research_type": "ai_generated"
}
`.trim();

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  loadEnvLocal();

  const args = parseArgs();
  if (!args) {
    console.error('Usage: npx tsx scripts/generate-research.ts --product "Shilajit" --brand "HERBIUS" --market "ME" --segment "Men 30-55"');
    console.error('Flags:');
    console.error('  --product    Product name (required)');
    console.error('  --brand      Brand name (required)');
    console.error('  --market     Market code: UK/EU | US | ME | IL (required)');
    console.error('  --segment    Target segment e.g. "Men 30-55" (required)');
    console.error('  --context    Additional product/audience context (optional)');
    console.error('  --dry-run    Generate file only, skip DB seed');
    console.error('  --no-file    Seed to DB only, skip writing .ts file');
    process.exit(1);
  }

  const { product, brand, market, segment, context, dryRun, noFile } = args;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('❌ Missing ANTHROPIC_API_KEY. Set it in .env.local or your shell.');
    process.exit(1);
  }

  // Print job summary
  console.log('\n📊 TAE Ad Studio — Research Generator');
  console.log('─'.repeat(52));
  console.log(`  Product  : ${product}`);
  console.log(`  Brand    : ${brand}`);
  console.log(`  Market   : ${market}`);
  console.log(`  Segment  : ${segment}`);
  if (context) console.log(`  Context  : ${context.slice(0, 80)}${context.length > 80 ? '…' : ''}`);
  console.log(`  Mode     : ${dryRun ? 'DRY RUN (file only)' : noFile ? 'DB only (no file)' : 'File + DB'}`);
  console.log('─'.repeat(52));
  console.log();

  // Build user message
  const userMessage = [
    `## Research brief`,
    `- **Product:** ${product}`,
    `- **Brand:** ${brand}`,
    `- **Market:** ${market}`,
    `- **Target segment:** ${segment}`,
    context ? `\n## Additional context\n${context}` : '',
    `\n## Task`,
    `Conduct thorough web research using the web_search tool to understand this target audience deeply.`,
    `Search Reddit communities, review sites (Amazon, Trustpilot), healthcare forums, and cultural sources.`,
    ``,
    `After gathering your research, synthesise your findings into the structured JSON format specified.`,
    `Return ONLY the raw JSON object — no prose, no fences, no preamble. Start with { and end with }.`,
    ``,
    `Current timestamp for generated_at field: ${new Date().toISOString()}`,
  ].filter(Boolean).join('\n');

  // Progress indicator while waiting for the API
  console.log('🔍 Searching the web and generating research...');
  console.log('   (Claude + web search typically takes 3–6 minutes)\n');

  let dotCount = 0;
  const progressInterval = setInterval(() => {
    process.stdout.write('·');
    dotCount++;
    if (dotCount % 50 === 0) process.stdout.write('\n');
  }, 3000);

  const startTime = Date.now();
  let rawText: string;

  try {
    const anthropic = new Anthropic({ apiKey });

    const response = await (anthropic.beta.messages.create as Function)({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      betas: ['web-search-2025-03-05'],
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    });

    clearInterval(progressInterval);
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    process.stdout.write('\n');
    console.log(`\n✅ API call complete (${elapsed}s). Response length: ${
      JSON.stringify(response.content).length
    } chars`);

    // Extract text blocks (Claude interleaves tool_use and text blocks)
    rawText = (response.content as any[])
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text as string)
      .join('');

    if (!rawText) {
      console.error('❌ No text content in response. Content types received:',
        (response.content as any[]).map((b: any) => b.type).join(', '));
      process.exit(1);
    }

  } catch (err) {
    clearInterval(progressInterval);
    process.stdout.write('\n');
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n❌ Anthropic API call failed: ${msg}`);
    process.exit(1);
  }

  // ── Parse JSON from response ──────────────────────────────────────────────

  let research: PositioningResearch;
  try {
    const trimmed = rawText.trim();

    // Strategy 1: markdown fence
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    let jsonString = fenceMatch ? fenceMatch[1].trim() : '';

    // Strategy 2: find outermost { … } braces
    if (!jsonString) {
      const firstBrace = trimmed.indexOf('{');
      const lastBrace  = trimmed.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        jsonString = trimmed.slice(firstBrace, lastBrace + 1);
      }
    }

    if (!jsonString) {
      throw new Error('No JSON object found in response');
    }

    research = JSON.parse(jsonString) as PositioningResearch;
    console.log(`📝 Parsed successfully:`);
    console.log(`   Personas  : ${research.personas?.length ?? 0}`);
    console.log(`   Key stats : ${research.key_stats?.length ?? 0}`);
    console.log(`   Segment   : ${research.segment}`);
    console.log(`   Market    : ${research.market}`);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n❌ JSON parsing failed: ${msg}`);

    // Save raw output for debugging
    const debugFile = path.join(process.cwd(), 'scripts', `debug-${Date.now()}.txt`);
    fs.writeFileSync(debugFile, rawText, 'utf-8');
    console.error(`\n💾 Raw response saved for debugging: scripts/${path.basename(debugFile)}`);
    console.error('Preview of raw response:\n');
    console.error(rawText.slice(0, 1000));
    process.exit(1);
  }

  // ── Write TypeScript seed file ────────────────────────────────────────────

  if (!noFile) {
    const slug = [
      toSlug(product),
      toSlug(market),
      toSlug(segment.split(/\s+/)[0]),  // e.g. "Men", "Menopausal", "Women"
    ].join('-');
    const varName  = toCamelCase(slug);
    const seedDir  = path.join(process.cwd(), 'lib', 'research', 'seed-data');
    const filePath = path.join(seedDir, `${slug}.ts`);

    fs.mkdirSync(seedDir, { recursive: true });

    const fileContent = [
      `/**`,
      ` * Seed data: ${product} — ${segment} — ${market}`,
      ` *`,
      ` * Generated : ${new Date().toISOString()}`,
      ` * Tool      : scripts/generate-research.ts`,
      ` * Model     : Claude (claude-sonnet-4-6) + web search`,
      ` */`,
      ``,
      `import type { PositioningResearch } from '../types';`,
      ``,
      `export const ${varName}: PositioningResearch = ${JSON.stringify(research, null, 2)};`,
      ``,
    ].join('\n');

    fs.writeFileSync(filePath, fileContent, 'utf-8');
    console.log(`\n💾 Seed file written:`);
    console.log(`   Path   : lib/research/seed-data/${slug}.ts`);
    console.log(`   Export : ${varName}`);
    console.log(`\n   To seed to DB later, add to scripts/seed-research.ts:`);
    console.log(`   import { ${varName} } from '../lib/research/seed-data/${slug}';`);
  }

  // ── Upsert to DB ──────────────────────────────────────────────────────────

  if (dryRun) {
    console.log('\n⏭️  Dry run — skipping DB seed.');
  } else {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      console.error('\n⚠️  Missing Supabase env vars — DB seed skipped.');
      console.error('   Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
      console.error('   Or re-run with --dry-run to suppress this warning.');
    } else {
      console.log('\n📤 Upserting to positioning_research table...');
      const supabase = createClient(supabaseUrl, serviceKey);

      const { data, error } = await supabase
        .from('positioning_research')
        .upsert(
          {
            product_name:  research.product_name,
            brand:         research.brand,
            market:        research.market,
            segment:       research.segment,
            research,
            research_type: 'ai_generated',
            is_active:     true,
          },
          { onConflict: 'product_name,market,segment' },
        )
        .select()
        .single();

      if (error) {
        console.error(`❌ DB upsert failed: ${error.message}`);
        process.exit(1);
      }

      console.log(`✅ Seeded successfully.`);
      console.log(`   Row ID  : ${data.id}`);
      console.log(`   Product : ${data.product_name}`);
      console.log(`   Market  : ${data.market}`);
      console.log(`   Segment : ${data.segment}`);
    }
  }

  console.log('\n🎉 All done!\n');
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
