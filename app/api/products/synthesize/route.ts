import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 120;  // allow up to 2 min for multi-source synthesis

// ─── Schema description sent to Claude ────────────────────────────────────────

const PRODUCT_SCHEMA_PROMPT = `
You are a product intelligence analyst for a DTC Ayurvedic / wellness brand.
Given one or more input sources (text descriptions, scraped web pages, and/or
product images), synthesize a structured product profile.

Return ONLY valid JSON matching this exact schema — no markdown, no explanation:

{
  "name": "string — full product name",
  "brand": "string — parent brand",
  "sub_brand": "string | null — sub-brand if any",
  "description": "string — 2-3 sentence product description for internal use",
  "ingredients": [{ "name": "string", "key": true/false, "description": "string — what it does" }],
  "claims": [{ "text": "string — marketing claim", "source": "string | null", "stat": "string | null — e.g. 92% saw improvement" }],
  "color_palette": [{ "name": "string", "hex": "#RRGGBB", "usage": "string — e.g. primary, accent, background" }],
  "compliance_rules": ["string — things to never say or claim about this product"],
  "prompt_modifier": "string — brand DNA prefix for image generation prompts (2-3 sentences)",
  "context": {
    "primary_color": { "name": "string", "hex": "#RRGGBB" } | null,
    "accent_color": { "name": "string", "hex": "#RRGGBB" } | null,
    "contrast_color": { "name": "string", "hex": "#RRGGBB" } | null,
    "tint_color": { "name": "string", "hex": "#RRGGBB" } | null,
    "dark_color": { "name": "string", "hex": "#RRGGBB" } | null,
    "background_color": { "name": "string", "hex": "#RRGGBB" } | null,
    "tagline": "string | null",
    "product_description": "string | null — packaging/visual description for image gen",
    "product_category": "string | null — e.g. Eye Contour Cream",
    "price": "string | null — e.g. $28",
    "website": "string | null",
    "target_audience": "string | null — e.g. Women 40-65+",
    "market_flag": "string | null — emoji flag",
    "benefits": ["string — ordered list of up to 5 benefits"],
    "stats": [{ "value": "string", "label": "string", "context": "string | null" }],
    "review_count": "string | null — e.g. 64+",
    "social_proof": "string | null — e.g. 110 women tested",
    "before_state": "string | null",
    "after_state": "string | null",
    "timeframe": "string | null — e.g. 8 weeks",
    "surface": "string | null — e.g. marble countertop",
    "setting": "string | null — e.g. bright bathroom",
    "mood": "string | null — e.g. warm, aspirational",
    "cta": "string | null",
    "short_headline": "string | null",
    "hero_headline": "string | null",
    "educational_hook": "string | null",
    "testimonials": [{ "name": "string", "age": "string | null", "headline": "string | null", "quote": "string", "pull_quote": "string | null", "flag": "string | null", "verified": true/false }] | null
  }
}

CRITICAL RULES — read carefully before filling any field:

SOURCE FIDELITY (most important rule):
- ONLY populate a field if the information is EXPLICITLY present in the provided sources (text, scraped pages, or images).
- Do NOT infer, assume, guess, or extrapolate values that are not directly stated or clearly visible.
- If a field's value is not clearly supported by the sources, set it to null or an empty array — even if it seems like a reasonable guess.
- This especially applies to: surface, setting, mood, before_state, after_state, timeframe, cta, short_headline, hero_headline, educational_hook, testimonials, social_proof, review_count, market_flag, price, target_audience.
- Only infer compliance_rules from product category (supplements: no "treat/cure/diagnose"). That is the ONE exception to the source-fidelity rule.
- Only generate prompt_modifier from what you can visually and factually confirm about the product.

COLOR PALETTE — strict extraction rules:
- Extract colors ONLY from the actual product: packaging, label, bottle, cap, product texture, brand logo.
- If images are provided, use an eyedropper approach: identify the dominant packaging color, the accent/highlight color, the text/label color, any tint/secondary color, and the background color.
- If no images but a product page URL is given, look for hex codes, CSS colors, or color names mentioned in the page content.
- Each color must have a descriptive "name" (e.g. "Turmeric Gold", "Deep Forest Green"), accurate hex code, and a "usage" tag (primary, accent, contrast, tint, dark, background).
- Also populate context.primary_color, accent_color, contrast_color, tint_color, dark_color, and background_color to match.
- NEVER generate random/generic colors. If you cannot determine the colors, return an empty array.

GENERAL:
- Benefits should be ordered by importance/prominence as stated in the source.
- Keep all extracted text concise and marketing-ready.
- Name and brand are required — if genuinely not found, use your best inference and flag it in description.
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function scrapeUrl(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'TAE-Ad-Studio/1.0 ProductContextBot',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return `[Failed to fetch ${url}: HTTP ${res.status}]`;

    const html = await res.text();

    // Strip scripts, styles, and tags — keep readable text
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Cap at ~8k chars per URL to stay within context limits
    return text.slice(0, 8000);
  } catch (err: any) {
    return `[Failed to fetch ${url}: ${err.message}]`;
  }
}

function buildContentBlocks(
  text: string | undefined,
  urls: string[],
  scrapedTexts: string[],
  imageBase64s: Array<{ data: string; mediaType: string }>,
): Anthropic.ContentBlockParam[] {
  const blocks: Anthropic.ContentBlockParam[] = [];

  // User-provided text
  if (text?.trim()) {
    blocks.push({
      type: 'text',
      text: `## User-provided description:\n${text.trim()}`,
    });
  }

  // Scraped URL content
  urls.forEach((url, i) => {
    if (scrapedTexts[i] && !scrapedTexts[i].startsWith('[Failed')) {
      blocks.push({
        type: 'text',
        text: `## Content from ${url}:\n${scrapedTexts[i]}`,
      });
    }
  });

  // Images via vision
  imageBase64s.forEach((img, i) => {
    blocks.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: img.mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
        data: img.data,
      },
    });
    blocks.push({
      type: 'text',
      text: `(Image ${i + 1} above — CAREFULLY analyze: 1) Extract exact colors from packaging/label/bottle/cap — note the hex values as precisely as possible. 2) Read all visible text: product name, ingredient lists, claims, dosage, brand name. 3) Note visual details: bottle shape, label design, texture, background.)`,
    });
  });

  // Final instruction
  blocks.push({
    type: 'text',
    text: 'Now synthesize ALL sources above into the JSON schema. Return ONLY valid JSON.',
  });

  return blocks;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const {
    text,
    urls = [],
    images = [],          // Array of { data: base64, mediaType: string }
    existingProductId,     // Optional — if editing an existing product
  } = body as {
    text?: string;
    urls?: string[];
    images?: Array<{ data: string; mediaType: string }>;
    existingProductId?: string;
  };

  // Validate at least one input source
  if (!text?.trim() && urls.length === 0 && images.length === 0) {
    return NextResponse.json(
      { error: 'At least one input source (text, URL, or image) is required.' },
      { status: 400 },
    );
  }

  // Check API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not configured.' },
      { status: 500 },
    );
  }

  try {
    // 1. Scrape URLs in parallel
    const scrapedTexts = await Promise.all(urls.map(scrapeUrl));

    // 2. Build Claude message content
    const contentBlocks = buildContentBlocks(text, urls, scrapedTexts, images);

    // 3. Call Claude API
    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: PRODUCT_SCHEMA_PROMPT,
      messages: [
        {
          role: 'user',
          content: contentBlocks,
        },
      ],
    });

    // 4. Extract JSON from response
    const responseText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    // Try to parse — Claude might wrap in ```json ... ```
    let jsonStr = responseText.trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();

    const synthesized = JSON.parse(jsonStr);

    // 5. If editing, fetch existing product for diff
    let existingProduct = null;
    if (existingProductId) {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('id', existingProductId)
        .single();
      existingProduct = data;
    }

    return NextResponse.json({
      synthesized,
      existingProduct,
    });

  } catch (err: any) {
    console.error('[synthesize] error:', err);
    return NextResponse.json(
      { error: err.message || 'Synthesis failed' },
      { status: 500 },
    );
  }
}
