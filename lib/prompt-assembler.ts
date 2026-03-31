import type { Product, ProductContext } from '@/types';

// ─── helpers ────────────────────────────────────────────────────────────────

function colorStr(c?: { name: string; hex: string } | null): string {
  return c ? `${c.name} (${c.hex})` : '';
}

function benefit(ctx: ProductContext | null, i: number): string {
  return ctx?.benefits?.[i - 1] ?? '';
}

function stat(ctx: ProductContext | null, i: number): string {
  const s = ctx?.stats?.[i - 1];
  return s ? `${s.value} ${s.label}` : '';
}

// ─── fillTemplate ────────────────────────────────────────────────────────────

/**
 * Replaces all [VARIABLE] placeholders in a template string with
 * values derived from the Product object and its rich ProductContext.
 */
export function fillTemplate(template: string, product: Product): string {
  const ctx = product.context ?? null;
  const cp  = product.color_palette ?? [];

  // Resolve colors — context takes priority, then color_palette array
  const primaryColor    = ctx?.primary_color    ?? (cp[0] ? { name: cp[0].name, hex: cp[0].hex } : null);
  const accentColor     = ctx?.accent_color     ?? (cp[1] ? { name: cp[1].name, hex: cp[1].hex } : null);
  const contrastColor   = ctx?.contrast_color   ?? (cp[2] ? { name: cp[2].name, hex: cp[2].hex } : null);
  const darkColor       = ctx?.dark_color       ?? null;
  const tintColor       = ctx?.tint_color       ?? accentColor;
  const backgroundColor = ctx?.background_color ?? (cp[3] ? { name: cp[3].name, hex: cp[3].hex } : primaryColor);

  // Top claim & stat
  const topClaim = product.claims?.[0]?.text ?? '';
  const topStat  = product.claims?.[0]?.stat ?? product.claims?.[1]?.stat ?? '';
  const heroIngr = product.ingredients?.find((i) => i.key)?.name ?? 'natural botanicals';

  // Testimonials
  const t0 = ctx?.testimonials?.[0];
  const t1 = ctx?.testimonials?.[1];

  // ── replacement map ───────────────────────────────────────────────────────

  const map: Record<string, string> = {

    // ── Product identity ──────────────────────────────────────────────────
    '[PRODUCT]':            product.name,
    '[YOUR PRODUCT]':       product.name,
    '[PRODUCT NAME]':       product.name,
    '[YOUR PRODUCT like cream jar with lid]':              product.name,
    '[YOUR PRODUCT like supplement bottle]':               product.name,
    '[YOUR PRODUCT like supplement jar]':                  product.name,
    '[YOUR PRODUCT like single stand-up pouch]':           product.name,
    '[YOUR PRODUCT like product box and bar/bottle]':      product.name,
    '[YOUR PRODUCT with key packaging details]':           ctx?.product_description ?? product.name,
    '[YOUR PRODUCT — full packaging description]':         ctx?.product_description ?? product.name,
    '[FULL PRODUCT DESCRIPTION — packaging colors, key label text, distinguishing visual features]':
                                                           ctx?.product_description ?? product.description ?? product.name,
    '[PRODUCT DESCRIPTION — shape, color, label details, key typography on packaging]':
                                                           ctx?.product_description ?? product.description ?? product.name,
    '[BRAND]':              product.sub_brand ?? product.brand,
    '[YOUR BRAND]':         product.sub_brand ?? product.brand,
    '[BRAND NAME]':         product.sub_brand ?? product.brand,
    '[PRODUCT CATEGORY]':   ctx?.product_category ?? 'Skincare',
    '[PRODUCT DESCRIPTOR]': ctx?.product_category ?? 'Eye Contour Cream',
    '[WEBSITE]':            ctx?.website ?? 'theayurvedaexperience.com',
    '[brand url]':          ctx?.website ?? 'theayurvedaexperience.com',
    '[PRICE]':              ctx?.price ?? '',
    '[PRICE POINT like AS LOW AS $2.63 PER MEAL!]': ctx?.price ?? '',

    // ── Colors ────────────────────────────────────────────────────────────
    '[PRIMARY BRAND COLOR]':                              colorStr(primaryColor),
    '[PRIMARY BRAND COLOR like deep indigo/purple]':      colorStr(primaryColor),
    '[PRIMARY BRAND COLOR like vibrant teal]':            colorStr(primaryColor),
    '[BRAND COLOR]':                                      colorStr(primaryColor),
    '[BRAND COLOR with hex — a soft, muted tone works best]': colorStr(primaryColor),
    '[BRAND COLOR like chocolate brown]':                 colorStr(primaryColor),
    '[BRAND COLOR like dark navy]':                       colorStr(primaryColor),
    '[BRAND COLOR like dark purple]':                     colorStr(primaryColor),
    '[BRAND COLOR like periwinkle/lavender blue]':        colorStr(primaryColor),
    '[ACCENT COLOR]':                                     colorStr(accentColor),
    '[ACCENT COLOR like coral/red]':                      colorStr(accentColor),
    '[ACCENT COLOR like gold/white]':                     colorStr(accentColor),
    '[ACCENT COLOR like gold/yellow]':                    colorStr(accentColor),
    '[ACCENT COLOR like periwinkle blue]':                colorStr(accentColor),
    '[ACCENT COLOR like purple/violet]':                  colorStr(accentColor),
    '[ACCENT COLOR like purple]':                         colorStr(accentColor),
    '[ACCENT COLOR like soft pink / brand secondary color]': colorStr(accentColor),
    '[CONTRAST COLOR]':                                   colorStr(contrastColor),
    '[CONTRAST COLOR like deep navy]':                    colorStr(contrastColor),
    '[CONTRAST COLOR like pale cream/beige]':             colorStr(contrastColor),
    '[CONTRAST COLOR like warm cream]':                   colorStr(contrastColor),
    '[DARK BRAND COLOR]':                                 colorStr(darkColor ?? primaryColor),
    '[DARK COLOR like deep brown/black]':                 colorStr(darkColor ?? primaryColor),
    '[DARK COLOR]':                                       colorStr(darkColor ?? primaryColor),
    '[BACKGROUND]':                                       colorStr(backgroundColor),
    '[BACKGROUND like dark charcoal/moody gray]':         colorStr(backgroundColor),
    '[BACKGROUND like soft pink-to-hot-pink gradient]':   colorStr(backgroundColor),
    '[BACKGROUND like warm cream/light yellow textured]': colorStr(backgroundColor),
    '[BACKGROUND like warm cream]':                       colorStr(backgroundColor),
    '[BACKGROUND COLOR like warm sand/beige/cream]':      colorStr(backgroundColor),
    '[SOFT BRAND COLOR like lavender/light purple]':      colorStr(accentColor),
    '[BRIGHT ACCENT COLOR like neon green/lime]':         colorStr(accentColor),
    '[BRIGHT ACCENT COLOR]':                              colorStr(accentColor),
    '[LIGHT GRADIENT COLOR like warm golden beige]':      colorStr(backgroundColor ?? accentColor),

    // ── Key ingredient ─────────────────────────────────────────────────────
    '[KEY INGREDIENT]': heroIngr,

    // ── Claims ─────────────────────────────────────────────────────────────
    '[CLAIM]':          topClaim,
    '[STAT]':           topStat,
    '[SOCIAL PROOF]':                                   ctx?.social_proof ?? '',
    '[SOCIAL PROOF like OVER 300K+ LIVES CHANGED]':     ctx?.social_proof ?? '',
    '[REVIEW COUNT]':                                   ctx?.review_count ?? '',
    '[REVIEW COUNT like 10,000+ REVIEWS]':              ctx?.review_count ?? '',
    '[REVIEW COUNT like 3,600+]':                       ctx?.review_count ?? '',

    // ── Benefits ───────────────────────────────────────────────────────────
    '[BENEFIT 1-3 like Head turning aroma / No additives, flavors, or preservatives / Ready to serve from the pouch]':
      [benefit(ctx,1), benefit(ctx,2), benefit(ctx,3)].filter(Boolean).join(' / '),
    '[BENEFIT 1-4]': [benefit(ctx,1), benefit(ctx,2), benefit(ctx,3), benefit(ctx,4)].filter(Boolean).join(' / '),
    '[BENEFIT 1-5]': [benefit(ctx,1), benefit(ctx,2), benefit(ctx,3), benefit(ctx,4), benefit(ctx,5)].filter(Boolean).join(' / '),
    '[BENEFIT 1 like Morning Energy]':                    benefit(ctx, 1),
    '[BENEFIT 1 like More Vitamin D than 800 mushrooms]': benefit(ctx, 1),
    '[BENEFIT 2 like Focus Amplifier]':                   benefit(ctx, 2),
    '[BENEFIT 2 like More Folate than 4 cups of spinach]': benefit(ctx, 2),
    '[BENEFIT 3 like Deep Sleep]':                        benefit(ctx, 3),
    '[BENEFIT 3 like More Vitamin B1 than 7 cups of broccoli]': benefit(ctx, 3),
    '[BENEFIT 4 like Ultimate Beauty]':                   benefit(ctx, 4),
    '[BENEFIT 5 like Metabolism Booster]':                benefit(ctx, 5),

    // ── Stats ──────────────────────────────────────────────────────────────
    '[STAT 1 like 12G OF PROTEIN]':      stat(ctx, 1),
    '[STAT 1 like 15g PROTEIN]':         stat(ctx, 1),
    '[STAT 1 like 20g]':                 stat(ctx, 1),
    '[STAT 2 like 280]':                 stat(ctx, 2),
    '[STAT 2 like 2g SUGAR]':            stat(ctx, 2),
    '[STAT 2 like 900K]':                stat(ctx, 2),
    '[STAT 2 like ≤2G OF SUGAR]':        stat(ctx, 2),
    '[STAT 3 like 180 CALORIES]':        stat(ctx, 3),
    '[STAT 3 like 20+]':                 stat(ctx, 3),
    '[STAT 3 like 900k+]':               stat(ctx, 3),
    '[STAT 3 like ≤3G OF NET CARBS]':    stat(ctx, 3),
    '[STAT 4 like 30K]':                 stat(ctx, 4),
    '[STAT 4 like 30k+]':                stat(ctx, 4),

    // ── Audience ───────────────────────────────────────────────────────────
    '[FLAG EMOJI like 🇺🇸]':                       ctx?.market_flag ?? '🌍',
    '[FLAG EMOJI matching target market — e.g., 🇺🇸]': ctx?.market_flag ?? '🌍',
    '[FLAG EMOJI]':                                 ctx?.market_flag ?? '🌍',

    // ── Transformation ─────────────────────────────────────────────────────
    '[BEFORE STATE]':                                           ctx?.before_state ?? '',
    '[BEFORE STATE like a bloated midsection outline with dots/texture]': ctx?.before_state ?? '',
    '[AFTER STATE]':                                            ctx?.after_state ?? '',
    '[AFTER STATE like a flatter, smoother midsection outline]': ctx?.after_state ?? '',
    '[TIMEFRAME]':                                              ctx?.timeframe ?? '8 weeks',
    '[TIMEFRAME like 4w]':                                      ctx?.timeframe ?? '8 weeks',

    // ── Scene / setting / surface ──────────────────────────────────────────
    '[SURFACE]':                        ctx?.surface ?? 'marble countertop',
    '[SURFACE like a marble countertop]': ctx?.surface ?? 'marble countertop',
    '[SURFACE — e.g. light wood floor / raw wood shelf / marble counter]': ctx?.surface ?? 'marble countertop',
    '[SURFACE/SETTING like a clean white desk with lifestyle props]':
      `${ctx?.setting ?? 'bright bathroom'} with ${ctx?.surface ?? 'marble countertop'}`,
    '[SETTING like a bright modern kitchen]':     ctx?.setting ?? 'bright bathroom with natural light',
    '[SETTING like bright bathroom / kitchen]':   ctx?.setting ?? 'bright bathroom with natural light',
    '[SETTING like golf course with palm trees]': ctx?.setting ?? 'bright bathroom with natural light',

    // ── CTA / copy ─────────────────────────────────────────────────────────
    '[CTA]':                           ctx?.cta ?? 'Shop Now',
    '[CTA like EXPLORE NOW]':          ctx?.cta ?? 'Shop Now',
    '[CTA like SHOP NOW]':             ctx?.cta ?? 'Shop Now',
    '[SHORT HEADLINE]':                ctx?.short_headline ?? product.name,
    '[YOUR HEADLINE, under 10 words]': ctx?.hero_headline ?? ctx?.short_headline ?? product.name,
    '[YOUR SUBHEAD, one sentence]':    ctx?.tagline ?? topClaim,
    '[EDUCATIONAL HOOK — a surprising stat or mechanism about why this category matters]':
                                       ctx?.educational_hook ?? '',

    // ── Social proof / testimonials ────────────────────────────────────────
    '[FIRST NAME + LAST INITIAL like Alan R.]':  t0?.name ?? '',
    '[FIRST NAME + LAST INITIAL]':               t0?.name ?? '',
    '[REVIEWER NAME like Dawn K.]':              t0?.name ?? '',
    '[REVIEWER NAME like Elaine McLean]':        t0?.name ?? '',
    '[REVIEWER NAME like Veronica B.]':          t0?.name ?? '',
    '[NAME]':                                    t0?.name ?? '',
    '[ATTRIBUTION like - Erin D.]':              t0?.name ? `— ${t0.name}` : '',
    '[ATTRIBUTION]':                             t0?.name ? `— ${t0.name}` : '',
    '[PULL-QUOTE — the most emotional 4-8 word phrase from the review, e.g., "I finally found something that works!"]':
                                        t0?.pull_quote ? `"${t0.pull_quote}"` : '',
    '[HEADLINE QUOTE like "I finally found something that works!"]':
                                        t0?.pull_quote ? `"${t0.pull_quote}"` : '',
    '[FULL QUOTE 2-3 sentences]':      t0?.quote ?? '',
    '[FULL QUOTE, 3-5 sentences]':     t0?.quote ?? '',
    '[FULL REVIEW TEXT, 3-4 sentences, conversational and emotional]': t0?.quote ?? '',
    '[TESTIMONIAL 2-3 sentences touching on a specific problem and the product being a game-changer]': t0?.quote ?? '',
    '[TESTIMONIAL]':                   t0?.quote ?? '',
    '[REVIEW]':                        t1?.quote ?? t0?.quote ?? '',
    '[SHORT REVIEW QUOTE like "I will never get drive-thru coffee again"]':
                                       t0?.pull_quote ? `"${t0.pull_quote}"` : '',
    '[REVIEW TITLE]':                  t0?.headline ?? '',
    '[VERIFIED REVIEWER / VERIFIED BUYER]': 'Verified Buyer',
    '[VERIFIED BADGE TEXT like Verified Reviewer]': 'Verified Buyer',

    // ── Misc ───────────────────────────────────────────────────────────────
    '[MOOD]':                           ctx?.mood ?? 'warm, aspirational, clinically credible',
    '[MOOD like confident, athletic, aspirational but accessible]': ctx?.mood ?? '',
    '[MOOD like warm, skin-toned, soft-focus]':                     ctx?.mood ?? 'warm, skin-toned, soft-focus',
    '[MOOD — 3 adjectives]':                                        ctx?.mood ?? 'warm, luminous, confident',
    '[DISCLAIMER like Results may vary based on individual. No results guaranteed.]':
                                        'Results may vary. Individual results not guaranteed.',
    '[TRUST BADGE like "100% MONEY BACK / 90 DAYS / 100% GUARANTEE"]': '30-Day Money-Back Guarantee',
    '[TRUST BADGE like circular seal reading "Happiness 60 DAY Guaranteed"]': '30-Day Money-Back Guarantee',
  };

  let filled = template;
  for (const [placeholder, value] of Object.entries(map)) {
    filled = filled.split(placeholder).join(value);
  }
  return filled;
}

// ─── assemblePrompt ──────────────────────────────────────────────────────────

/**
 * Builds the final prompt sent to the image generator.
 * Prepends brand DNA + product context to the user's edited template.
 */
export function assemblePrompt(
  product: Product,
  userPrompt: string,
  aspectRatio: string
): string {
  const parts: string[] = [];

  if (product.prompt_modifier) {
    parts.push(product.prompt_modifier);
  }

  parts.push(`Product: ${product.name} by ${product.sub_brand ?? product.brand}.`);

  const heroIngr = product.ingredients?.filter((i) => i.key).map((i) => i.name);
  if (heroIngr?.length) {
    parts.push(`Key ingredients: ${heroIngr.join(', ')}.`);
  }

  const claimTexts = product.claims?.map((c) => c.stat ? `${c.text} (${c.stat})` : c.text);
  if (claimTexts?.length) {
    parts.push(`Product claims: ${claimTexts.join('; ')}.`);
  }

  if (product.compliance_rules?.length) {
    parts.push(`Never say or imply: ${product.compliance_rules.join(', ')}.`);
  }

  parts.push(userPrompt);
  parts.push(`Output: ${aspectRatio} aspect ratio, high-resolution, photorealistic product advertising.`);

  return parts.filter(Boolean).join('\n\n');
}
