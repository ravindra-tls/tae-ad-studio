/**
 * POST /api/admin/research/generate
 *
 * Admin-only route. Uses Claude with the web_search tool (Anthropic beta
 * header `anthropic-beta: web-search-2025-03-05`) to generate a new
 * PositioningResearch document for a product/market/segment combination.
 *
 * The model searches Reddit, review sites, healthcare forums, and cultural
 * sources, then synthesises findings into the PositioningResearch schema.
 * The result is upserted into the `positioning_research` table.
 *
 * Request body:
 *   {
 *     product_name:       string
 *     brand:              string
 *     market:             string   // "UK/EU" | "US" | "ME" | "IL"
 *     segment:            string   // e.g. "Menopausal Women 45-65+"
 *     additional_context: string?  // optional extra guidance for Claude
 *   }
 *
 * Auth: admin role required.
 *
 * Note: max_tokens 8000 + web search make this slow (30-60s). maxDuration
 * is set to 120s to accommodate that.
 */

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import type { PositioningResearch } from '@/lib/research/types';

export const maxDuration = 120;

// ── Auth helper ──────────────────────────────────────────────────────────────

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const service = await createServiceClient();
  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { user, service };
}

// ── Request schema ────────────────────────────────────────────────────────────

const RequestBody = z.object({
  product_name: z.string().min(1).max(200),
  brand: z.string().min(1).max(200),
  market: z.string().min(1).max(100),
  segment: z.string().min(1).max(200),
  additional_context: z.string().max(2000).optional(),
});

// ── System prompt ─────────────────────────────────────────────────────────────

const RESEARCH_SYSTEM_PROMPT = `
You are a senior audience research specialist for a DTC wellness supplement brand.
Your job is to conduct deep, empathetic research into a target audience segment
and synthesise your findings into a structured research document.

## Research Methodology

Use web_search to search the following sources in order:

1. REDDIT COMMUNITIES — Search these communities for authentic, unfiltered consumer voice:
   - r/menopause, r/perimenopause, r/menopauseuk (if menopause segment)
   - r/supplements, r/Nootropics (for supplement attitudes)
   - Condition-specific subreddits relevant to the segment
   - r/AskWomenOver40, r/TwoXChromosomes, r/womenover50
   - Search queries: "[product category] reviews reddit", "[segment symptom] reddit", "[health concern] supplement reddit"

2. AMAZON + TRUSTPILOT REVIEWS — Search for competitor product reviews:
   - Search "[product category] reviews trustpilot site:trustpilot.com"
   - Search "[product category] reviews amazon" to find common complaints and desires
   - Extract real language patterns from reviewer language

3. HEALTHCARE FORUMS — Search patient narrative sources:
   - HealthTalk.org, Patient.info, Mumsnet Health
   - NHS community forums, condition-specific charities
   - Search "[health condition] personal stories forum"

4. CULTURAL SOURCES — For market-specific context:
   - Local language health journalism (use English search terms for EU markets)
   - Government health statistics
   - Menopause/health charity reports

## Critical Rules for Research Quality

1. VERBATIM QUOTES ONLY — Never invent or paraphrase quotes. Every quote in
   verbatim_quotes must come from an actual source you found. If you cannot
   find quotes for a persona, use fewer quotes rather than fabricating them.
   Mark the source briefly in parentheses if useful.

2. PERSONA SYNTHESIS — Identify 5-7 distinct emotional archetypes based on
   actual patterns you find. Do not invent personas from prior knowledge alone.
   Each persona must be grounded in what you actually found in search results.

3. HONEST LIMITATIONS — If evidence is sparse for a market, say so in
   executive_summary. Do not extrapolate beyond your findings.

4. LANGUAGE ACCURACY — words_she_uses must be drawn from actual forum/review
   language, not invented marketing language.

5. CULTURAL ACCURACY — cultural_context must reflect actual healthcare systems,
   supplement regulations, and cultural attitudes for each country. Do not
   project US cultural norms onto EU markets.

## Output Format

Return ONLY valid JSON matching this exact structure. No markdown fences,
no explanatory prose, no commentary before or after the JSON:

{
  "product_name": "string",
  "brand": "string",
  "market": "string",
  "segment": "string",
  "executive_summary": "string — 2-3 paragraph summary of key findings",
  "key_stats": ["string — stat with source attribution"],
  "personas": [
    {
      "archetype_name": "string — evocative name e.g. 'The Desperate Searcher'",
      "age_range": "string e.g. '44-52'",
      "location": "string e.g. 'UK (London, Manchester)'",
      "tagline": "string — 1-2 sentence characterisation",
      "verbatim_quotes": ["string — exact quote from source"],
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
      { "hook": "string — ad hook concept", "emotional_territory": "string — which emotion + persona it targets" }
    ]
  },
  "cultural_context": {
    "UK": "string — UK-specific messaging approach",
    "Germany": "string — optional, include if market is EU",
    "France": "string — optional",
    "Italy": "string — optional",
    "Netherlands": "string — optional"
  },
  "supplement_landscape": {
    "journey_stages": ["string — what supplements she tried in order"],
    "why_previous_failed": ["string"],
    "positioning_opportunity": "string — where this product fits uniquely",
    "trust_markers": ["string — what she needs to see to trust a product"]
  },
  "messaging_framework": {
    "[persona_name]": "string — 1-2 sentence messaging approach for this persona"
  },
  "creative_principles": ["string — executional rules for creative teams"],
  "source_methodology": "string — list of sources searched and methodology",
  "generated_at": "string — ISO 8601 timestamp",
  "research_type": "ai_generated"
}
`.trim();

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // Auth
  const ctx = await requireAdmin();
  if ('error' in ctx) return ctx.error;

  // Parse body
  let parsed: z.infer<typeof RequestBody>;
  try {
    const json = await request.json();
    parsed = RequestBody.parse(json);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid request body';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Check API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not configured.' },
      { status: 500 },
    );
  }

  // Build user message
  const userMessage = [
    `## Research brief`,
    `- **Product:** ${parsed.product_name}`,
    `- **Brand:** ${parsed.brand}`,
    `- **Market:** ${parsed.market}`,
    `- **Target segment:** ${parsed.segment}`,
    parsed.additional_context
      ? `\n## Additional context\n${parsed.additional_context}`
      : '',
    `\n## Task`,
    `Conduct thorough web research using the web_search tool to understand this target audience deeply.`,
    `Search Reddit communities, review sites (Amazon, Trustpilot), healthcare forums, and cultural sources`,
    `as described in your instructions.`,
    ``,
    `After gathering your research, synthesise your findings into the structured JSON format specified.`,
    `Return ONLY the JSON — no prose, no fences, no explanation.`,
    ``,
    `Current timestamp for generated_at field: ${new Date().toISOString()}`,
  ]
    .filter(Boolean)
    .join('\n');

  // Call Claude with web search beta
  const anthropic = new Anthropic({ apiKey });

  let rawText: string;
  try {
    const response = await (anthropic.beta.messages.create as Function)({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      betas: ['web-search-2025-03-05'],
      system: RESEARCH_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
        },
      ],
    });

    // Extract text from the final message (after tool use turns)
    rawText = response.content
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/research/generate] Claude call failed:', msg);

    const friendlyError = msg.includes('usage limits') || msg.includes('rate_limit') || msg.includes('429')
      ? 'AI service usage limit reached. Please try again after your billing period resets.'
      : msg.includes('401') || msg.includes('authentication')
      ? 'AI service authentication error. Check the ANTHROPIC_API_KEY environment variable.'
      : msg.includes('overloaded') || msg.includes('529')
      ? 'AI service is temporarily overloaded. Please try again in a moment.'
      : `Research generation failed: ${msg}`;

    return NextResponse.json({ error: friendlyError }, { status: 502 });
  }

  // Parse JSON response — Claude sometimes prefixes JSON with prose
  let research: PositioningResearch;
  try {
    const trimmed = rawText.trim();
    // 1. Markdown fence
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    let jsonString = fenceMatch ? fenceMatch[1].trim() : '';
    // 2. Bare JSON object anywhere in the text
    if (!jsonString) {
      const firstBrace = trimmed.indexOf('{');
      const lastBrace  = trimmed.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        jsonString = trimmed.slice(firstBrace, lastBrace + 1);
      }
    }
    if (!jsonString) throw new Error('No JSON object found in response');
    research = JSON.parse(jsonString) as PositioningResearch;
  } catch (err) {
    console.error('[api/admin/research/generate] Non-JSON response from Claude:', rawText.slice(0, 500));
    return NextResponse.json(
      {
        error: 'Research generation produced an invalid response. Please try again.',
        debug_preview: rawText.slice(0, 300),
      },
      { status: 502 },
    );
  }

  // Upsert into DB
  const { data: row, error: dbError } = await ctx.service
    .from('positioning_research')
    .upsert(
      {
        product_name: parsed.product_name,
        brand: parsed.brand,
        market: parsed.market,
        segment: parsed.segment,
        research,
        research_type: 'ai_generated',
        is_active: true,
      },
      {
        onConflict: 'product_name,market,segment',
      },
    )
    .select()
    .single();

  if (dbError || !row) {
    console.error('[api/admin/research/generate] DB upsert failed:', dbError?.message);
    return NextResponse.json(
      { error: `Failed to save research: ${dbError?.message ?? 'Unknown DB error'}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ research: row }, { status: 201 });
}
