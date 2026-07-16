/**
 * POST /api/admin/research/trigger
 *
 * Admin-only. Automatically generates positioning research for a product
 * by fetching the product from DB and passing its data to Claude with web search.
 * Claude determines the market and segment from the product data.
 *
 * Called fire-and-forget after a new product is created.
 *
 * Request body: { product_id: string }
 */

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/guards';
import type { PositioningResearch } from '@/lib/research/types';

export const maxDuration = 120;

const RequestBody = z.object({
  product_id: z.string().uuid(),
});

const SYSTEM_PROMPT = `
You are a senior audience research specialist for a DTC wellness/beauty supplement brand.
Your job is to:
1. Determine the primary market and target segment for a product based on its data
2. Conduct deep web research into that audience
3. Synthesise findings into a structured research document

CRITICAL: Your FINAL response must be ONLY the raw JSON object — no preamble, no explanation, no markdown fences, no text before or after the JSON. Start your response with { and end with }.

## Market codes to use
- "UK/EU" — UK and/or mainland Europe
- "US" — United States
- "ME" — Middle East (Saudi, UAE, etc.)
- "IL" — Israel

## Research Methodology
Use web_search to search Reddit communities, Amazon/Trustpilot reviews, healthcare forums, and cultural sources.

## Output Format
Return ONLY valid JSON — no markdown fences, no prose:

{
  "product_name": "string",
  "brand": "string",
  "market": "string — one of: UK/EU, US, ME, IL",
  "segment": "string — e.g. 'Menopausal Women 45-65+'",
  "executive_summary": "string — 2-3 paragraphs",
  "key_stats": ["string"],
  "personas": [
    {
      "archetype_name": "string",
      "age_range": "string",
      "location": "string",
      "tagline": "string",
      "verbatim_quotes": ["string — real quotes only, never invented"],
      "core_characteristics": ["string"],
      "deepest_fears": ["string"],
      "deepest_desires": ["string"],
      "emotional_triggers": [{ "label": "string", "description": "string" }]
    }
  ],
  "emotional_landscape": {
    "emotional_cycle": [{ "stage": "string", "description": "string" }],
    "universal_turn_offs": ["string"],
    "universal_desires": ["string"]
  },
  "language_guide": {
    "words_she_uses": ["string"],
    "sounds_familiar": ["string"],
    "ad_hook_mapping": [{ "hook": "string", "emotional_territory": "string" }]
  },
  "cultural_context": { "UK": "string", "Germany": "string (optional)", "France": "string (optional)" },
  "supplement_landscape": {
    "journey_stages": ["string"],
    "why_previous_failed": ["string"],
    "positioning_opportunity": "string",
    "trust_markers": ["string"]
  },
  "messaging_framework": { "[persona_name]": "string — messaging approach" },
  "creative_principles": ["string"],
  "source_methodology": "string",
  "generated_at": "string — ISO 8601",
  "research_type": "ai_generated"
}
`.trim();

export async function POST(request: Request) {
  const ctx = await requireAdmin();
  if (!ctx.ok) return ctx.response;

  let parsed: z.infer<typeof RequestBody>;
  try {
    parsed = RequestBody.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });

  // Fetch product
  const { data: product, error: productError } = await ctx.service
    .from('products')
    .select('*')
    .eq('id', parsed.product_id)
    .single();

  if (productError || !product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  const ctx2 = product.context as any;
  const targetAudience = ctx2?.target_audience ?? 'not specified';
  const marketFlag = ctx2?.market_flag ?? '';
  const ingredients = (product.ingredients as any[] ?? []).map((i: any) => i.name).join(', ') || 'N/A';
  const claims = (product.claims as any[] ?? []).map((c: any) => c.text).join('; ') || 'N/A';

  const userMessage = [
    `## Product to research`,
    `- **Name:** ${product.name}`,
    `- **Brand:** ${product.brand}`,
    `- **Sub-brand:** ${product.sub_brand ?? 'N/A'}`,
    `- **Description:** ${product.description ?? 'N/A'}`,
    `- **Target audience:** ${targetAudience}`,
    `- **Market indicator (emoji flag):** ${marketFlag || 'not specified'}`,
    `- **Key ingredients:** ${ingredients}`,
    `- **Claims:** ${claims}`,
    ``,
    `## Task`,
    `1. From the product data above, determine the correct market code (UK/EU, US, ME, or IL) and target segment string.`,
    `2. Conduct thorough web research (Reddit, reviews, forums) for this audience.`,
    `3. Return the full research JSON as specified.`,
    ``,
    `Current timestamp: ${new Date().toISOString()}`,
  ].join('\n');

  const anthropic = new Anthropic({ apiKey });
  let rawText: string;

  try {
    const response = await (anthropic.beta.messages.create as Function)({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      betas: ['web-search-2025-03-05'],
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    });

    rawText = response.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/admin/research/trigger] Claude call failed:', msg);
    return NextResponse.json({ error: `Research generation failed: ${msg}` }, { status: 502 });
  }

  let research: PositioningResearch;
  try {
    const trimmed = rawText.trim();
    // 1. Markdown fence
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    let jsonString = fenceMatch ? fenceMatch[1].trim() : '';
    // 2. Bare JSON object anywhere in the text (Claude sometimes prefixes with prose)
    if (!jsonString) {
      const firstBrace = trimmed.indexOf('{');
      const lastBrace  = trimmed.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        jsonString = trimmed.slice(firstBrace, lastBrace + 1);
      }
    }
    if (!jsonString) throw new Error('No JSON object found in response');
    research = JSON.parse(jsonString) as PositioningResearch;
  } catch (parseErr) {
    console.error('[api/admin/research/trigger] Non-JSON response:', rawText.slice(0, 500));
    return NextResponse.json({ error: 'Research generation produced an invalid response.' }, { status: 502 });
  }

  const { data: row, error: dbError } = await ctx.service
    .from('positioning_research')
    .upsert(
      {
        product_name: product.name,
        brand: product.brand,
        market: research.market,
        segment: research.segment,
        research,
        research_type: 'ai_generated',
        is_active: true,
      },
      { onConflict: 'product_name,market,segment' },
    )
    .select()
    .single();

  if (dbError || !row) {
    return NextResponse.json({ error: `Failed to save: ${dbError?.message}` }, { status: 500 });
  }

  return NextResponse.json({ research: row }, { status: 201 });
}
