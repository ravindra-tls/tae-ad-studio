/**
 * POST /api/admin/templates/[id]/preview
 *
 * Generates a single preview image for a prompt template using a hardcoded
 * demo product (Sulwhasoo Concentrated Ginseng Rejuvenating Cream). The
 * resulting image URL is saved to prompt_templates.preview_image_url so
 * users can visually understand the ad layout before selecting a template.
 *
 * Admin-only. Idempotent — calling it again regenerates the preview.
 */
import { requireAdmin } from '@/lib/auth/guards';
import { NextResponse } from 'next/server';
import { fillTemplate, aiEnrichPrompt, assemblePrompt } from '@/lib/prompt-assembler';
import { imageProvider, getGeneratedFileExtension } from '@/lib/image-providers';
import type { Product } from '@/types';

// ─── Demo product — Sulwhasoo Concentrated Ginseng Rejuvenating Cream ────────
// Used as a neutral, visually rich reference product to demonstrate each
// template's layout and style without exposing internal TAE product data.

const DEMO_PRODUCT: Product = {
  id:               'demo-sulwhasoo-ginseng-cream',
  name:             'Concentrated Ginseng Rejuvenating Cream',
  brand:            'Sulwhasoo',
  sub_brand:        null,
  description:      'A luxury anti-aging face cream powered by Ginsenomics™ technology. Harvested from 6-year-old red ginseng roots, it visibly renews skin, boosts radiance, and restores firmness.',
  ingredients:      [
    { name: 'Red Ginseng Root Extract', key: true,  description: 'Ginsenomics™ — concentrated ginseng actives for skin renewal' },
    { name: 'Ginseng Berry',            key: true,  description: 'Brightening and antioxidant' },
    { name: 'White Ginseng',            key: false, description: 'Skin-calming and hydrating' },
  ],
  claims: [
    { text: 'Visibly younger-looking skin in 4 weeks',  stat: '94%' },
    { text: 'Improved skin firmness and elasticity',    stat: '89%' },
    { text: 'Radiance and luminosity boost',            stat: '92%' },
  ],
  color_palette: [
    { name: 'Rich Gold',     hex: '#C9963F', usage: 'primary'    },
    { name: 'Deep Burgundy', hex: '#6B1E2B', usage: 'accent'     },
    { name: 'Warm Cream',    hex: '#F5EFE0', usage: 'background' },
    { name: 'Ivory White',   hex: '#FAF7F2', usage: 'contrast'   },
    { name: 'Dark Umber',    hex: '#3A2410', usage: 'dark'       },
  ],
  prompt_modifier: null,
  compliance_rules: [],
  thumbnail_url: 'https://us.sulwhasoo.com/cdn/shop/products/sulwhasoo-concentrated-ginseng-rejuvenating-cream-ex-60ml_1.jpg',
  context: {
    product_category:    'Luxury Anti-Aging Face Cream',
    tagline:             'Timeless wisdom. Ageless skin.',
    product_description: 'Elegant cylindrical glass jar with a deep gold lid and rich dark-burgundy label. Packaging exudes Korean luxury — lacquered, weighty, architectural.',
    price:               '$185',
    website:             'sulwhasoo.com',
    target_audience:     'Women 40–65 who invest in luxury skincare rituals',
    market_flag:         '🇺🇸',

    primary_color:    { name: 'Rich Gold',     hex: '#C9963F' },
    accent_color:     { name: 'Deep Burgundy', hex: '#6B1E2B' },
    contrast_color:   { name: 'Ivory White',   hex: '#FAF7F2' },
    dark_color:       { name: 'Dark Umber',    hex: '#3A2410' },
    background_color: { name: 'Warm Cream',    hex: '#F5EFE0' },
    tint_color:       { name: 'Blush Gold',    hex: '#E8D5A3' },

    benefits: [
      'Visibly renews skin texture',
      'Restores firmness and elasticity',
      'Boosts radiance and luminosity',
      'Reduces the look of fine lines and wrinkles',
    ],
    stats: [
      { value: '94%', label: 'saw younger-looking skin in 4 weeks' },
      { value: '89%', label: 'improved firmness'                   },
      { value: '92%', label: 'boosted radiance'                    },
    ],
    review_count:  '2,400+',
    social_proof:  '2,400+ five-star reviews',

    surface:  'polished marble countertop',
    setting:  'a serene, softly lit luxury vanity',
    mood:     'luxurious, timeless, refined, quietly confident',

    cta:            'Shop Now',
    short_headline: 'Ageless in 4 Weeks',
    hero_headline:  'The Ginseng Secret to Younger-Looking Skin',

    before_state: 'dull, uneven skin that looks tired',
    after_state:  'luminous, firm, visibly renewed complexion',
    timeframe:    '4 weeks',

    testimonials: [
      {
        name:       'Catherine M.',
        age:        58,
        headline:   'Worth every penny',
        quote:      'My skin looks 10 years younger. People keep asking what I\'ve been doing differently — this is my answer.',
        pull_quote: 'People keep asking what I\'ve been doing differently.',
        verified:   true,
      },
    ],
  },
  created_at: new Date().toISOString(),
};

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await requireAdmin();
  if (!ctx.ok) return ctx.response;
  const service = ctx.service;

  const { id: templateId } = params;

  // Fetch template
  const { data: template, error: tplErr } = await service
    .from('prompt_templates').select('*').eq('id', templateId).single();
  if (tplErr || !template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  // ── Return cached preview immediately — never regenerate unless force=true ──
  const body = await _request.json().catch(() => ({})) as { force?: boolean };
  if (template.preview_image_url && !body.force) {
    return NextResponse.json({ preview_image_url: template.preview_image_url, cached: true });
  }

  // Derive provider + model (same as test/route.ts)
  const activeProvider = (process.env.IMAGE_PROVIDER || 'openai').toLowerCase();
  const modelId =
    activeProvider === 'xai'    ? (process.env.XAI_MODEL_ID        || 'grok-imagine-image')        :
    activeProvider === 'vertex' ? (process.env.VERTEX_AI_MODEL_ID  || 'gemini-3-pro-image-preview') :
                                  (process.env.OPENAI_MODEL_ID     || 'gpt-image-2');
  const apiProvider = activeProvider === 'vertex' ? 'vertex-ai' : activeProvider;

  // Fill + enrich the template prompt using the demo product
  const filled      = fillTemplate(template.template, DEMO_PRODUCT);
  const enriched    = await aiEnrichPrompt(filled, DEMO_PRODUCT);
  const finalPrompt = assemblePrompt(DEMO_PRODUCT, enriched, template.default_aspect_ratio);

  // Submit to image provider — no session/generated_images record needed for previews.
  // We only store the final URL on the template row itself.
  const result = await imageProvider.submitGeneration({
    prompt:      finalPrompt,
    aspectRatio: template.default_aspect_ratio,
    modelId,
  });

  if (result.status !== 'completed' || !result.image) {
    return NextResponse.json(
      { error: result.error ?? `Generation status: ${result.status}` },
      { status: 500 },
    );
  }

  // Upload to storage
  const imageBytes = Buffer.from(result.image.data, 'base64');
  const fileExt    = getGeneratedFileExtension(result.image.mimeType);
  const filePath   = `previews/${templateId}.${fileExt}`;

  const { error: upErr } = await service.storage
    .from('generated-images')
    .upload(filePath, imageBytes, {
      contentType: result.image.mimeType,
      upsert: true,
    });

  if (upErr) {
    return NextResponse.json({ error: `Storage upload failed: ${upErr.message}` }, { status: 500 });
  }

  const { data: pub } = service.storage
    .from('generated-images')
    .getPublicUrl(filePath);

  const previewUrl = pub.publicUrl;

  // Persist preview URL on the template record
  const { data: updated, error: updateErr } = await service
    .from('prompt_templates')
    .update({ preview_image_url: previewUrl })
    .eq('id', templateId)
    .select()
    .single();

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ preview_image_url: previewUrl, template: updated });
}
