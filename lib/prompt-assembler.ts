import Anthropic from '@anthropic-ai/sdk';
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

function statLabel(ctx: ProductContext | null, i: number): string {
  return ctx?.stats?.[i - 1]?.label ?? '';
}

/** Tokens that require external campaign/competitor data — never auto-fill these */
export const AI_SKIP_TOKENS = new Set([
  // Promotional — campaign-specific
  '[DISCOUNT like 40%]',
  '[PROMO CODE]',
  '[YOUR OFFER like Free Shipping over $50]',
  '[YOUR OFFER like YOUR FIRST MONTH FREE]',
  '[URGENCY PHRASE like Limited Offer]',
  '[OFFER DETAIL]',
  '[PROMO TEXT like HUGE SALE + FREE GIFTS]',
  '[PROMO like BLACK FRIDAY SPECIAL]',
  // Competitor — requires separate research
  '[COMPETITOR CATEGORY]',
  '[COMPETITOR CATEGORY like Other chocolate bars]',
  '[WEAKNESS 1]', '[WEAKNESS 2]', '[WEAKNESS 3]', '[WEAKNESS 4]', '[WEAKNESS 5]',
  '[WEAKNESS 1-5]',
  '[WEAKNESS 1-4 like 29G SUGAR / FULL OF FRUCTOSE CORN SYRUP / 1G FIBRE / 2G PROTEIN]',
  '[STRENGTH 1]', '[STRENGTH 2]', '[STRENGTH 3]', '[STRENGTH 4]', '[STRENGTH 5]',
  '[STRENGTH 1-5]',
  '[COMPETITOR WEAKNESS like Doesn\'t even taste good.]',
  '[COMPETITOR WEAKNESS like Pesticide corn.]',
  '[COMPETITOR WEAKNESS like Uses seed oils.]',
  '[YOUR ADVANTAGE like Organic corn.]',
  '[YOUR ADVANTAGE like Tastes amazing.]',
  '[YOUR ADVANTAGE like Uses beef tallow.]',
  // UGC credibility — must be real, not generated
  '[CREDENTIAL]',
  '[HELPFULNESS COUNT]',
  '[HELPFULNESS COUNT — e.g., 150 / 2.4K]',
  '[PLATFORM like Reddit]',
  '[PLATFORM like Reddit / Twitter / X]',
  '[POST DETAILS like subreddit name, username, timestamp, upvote count]',
  // Product variants — needs real product variant data
  '[COLOR-CODED VARIANT]',
  '[VARIETY 1-4 like CHICKEN & YAMS / BEEF N\' RICE / SALMON N\' RICE / TURKEY & YAMS]',
  '[PRODUCT VARIANTS like folded pairs of shorts/pants]',
  // Brand assets — cannot be generated from text
  '[BRAND ICON]',
  '[BRAND LOGO]',
  // Requires competitor research
  '[COMPETITOR PRODUCT]',
  // Campaign/promotion-specific — must be set per campaign
  '[OFFER DETAILS]',
  '[VALUE ADDS]',
]);

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

  // Testimonials — pick randomly so each generation pulls a different review
  const testimonials = ctx?.testimonials ?? [];
  const t0Idx = testimonials.length > 0
    ? Math.floor(Math.random() * testimonials.length)
    : -1;
  const t0 = t0Idx >= 0 ? testimonials[t0Idx] : undefined;
  const t1Candidates = testimonials.filter((_, i) => i !== t0Idx);
  const t1 = t1Candidates.length > 0
    ? t1Candidates[Math.floor(Math.random() * t1Candidates.length)]
    : undefined;

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

    // ── Stat labels ────────────────────────────────────────────────────────
    '[LABEL like PROTEIN]':   statLabel(ctx, 1),
    '[METRIC LABEL 1]':       statLabel(ctx, 1),
    '[METRIC LABEL 2]':       statLabel(ctx, 2),
    '[METRIC LABEL 3]':       statLabel(ctx, 3),
    '[METRIC LABEL 4]':       statLabel(ctx, 4),

    // ── Pull-quote highlights ──────────────────────────────────────────────
    '[HIGHLIGHTED PHRASE 1]': t0?.pull_quote ? `"${t0.pull_quote}"` : '',
    '[HIGHLIGHTED PHRASE 2]': t1?.pull_quote
      ? `"${t1.pull_quote}"`
      : (t0?.pull_quote ? `"${t0.pull_quote}"` : ''),

    // ── Problem visual ─────────────────────────────────────────────────────
    '[PROBLEM VISUAL]':                               ctx?.before_state ?? '',
    '[PROBLEM VISUAL like dry cracked skin]':         ctx?.before_state ?? '',

    // ── Before date (editorial/post-it templates) ──────────────────────────
    '[BEFORE DATE like "Before Jan 15"]': `Before ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,

    // ── Person description (derived from target audience) ──────────────────
    '[PERSON]':               ctx?.target_audience ?? 'person',
    '[PERSON\'S HAND]':       ctx?.target_audience ? `hand of a ${ctx.target_audience}` : 'hand',
    '[PERSON DESCRIPTION like woman in her 40s with visible fine lines and tired eyes]':
                              ctx?.target_audience ?? 'person',
    '[LIFESTYLE PHOTO DESCRIPTION like woman in her 40s applying cream in a well-lit bathroom]':
                              ctx?.target_audience
                                ? `${ctx.target_audience} in a ${ctx?.setting ?? 'lifestyle setting'}`
                                : '',

    // ── Color / styling ────────────────────────────────────────────────────
    '[CONTRAST TEXT]':        colorStr(contrastColor ?? primaryColor),
    '[HIGHLIGHT COLOR]':      colorStr(accentColor ?? primaryColor),
    '[BADGE COLOR]':          colorStr(primaryColor),

    // ── Transformation scene ───────────────────────────────────────────────
    '[TRANSFORMATION SCENE]': ctx?.before_state && ctx?.after_state
      ? `transitioning from ${ctx.before_state} to ${ctx.after_state}`
      : (ctx?.after_state ?? ''),

    // ── Action (usage) ─────────────────────────────────────────────────────
    '[ACTION like applying cream]':
      ctx?.product_category
        ? `applying ${ctx.product_category.toLowerCase()}`
        : 'using the product',
    '[ACTION like woman gently applying the product]':
      ctx?.product_category
        ? `gently applying ${ctx.product_category.toLowerCase()}`
        : 'gently applying the product',

    // ── Ingredient visuals ─────────────────────────────────────────────────
    '[INGREDIENT VISUAL like turmeric root]':
      product.ingredients?.filter((i) => i.key).map((i) => i.name).join(', ') || heroIngr,
    '[INGREDIENT VISUAL like turmeric root and black pepper]':
      product.ingredients?.filter((i) => i.key).map((i) => i.name).slice(0, 3).join(' and ') || heroIngr,

    // ── Headline / claim variants (direct-mappable subset) ─────────────────
    '[SUPERLATIVE CLAIM like "The #1 Weight Loss Tea in the US"]':
      ctx?.social_proof ?? topClaim,
    '[VALUE PROP like "Clinically tested. 110 women. 90% saw results."]':
      ctx?.social_proof ?? benefit(ctx, 1),
    '[PROOF STATEMENT like "Backed by 3 clinical studies"]':
      ctx?.social_proof ?? topStat,
    '[BOLD STATEMENT like "I went from barely moving to hiking 10 miles a day"]':
      ctx?.hero_headline ?? topClaim,

    // ── Date / time ───────────────────────────────────────────────────────
    '[DATE]': new Date().toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    }),
    '[DATE like 13 July 2023 10:44]': new Date().toLocaleString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }),
    '[TIME like 10:45]': new Date().toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: false,
    }),
    '[TIMESTAMP like 2d]': '2d',

    // ── Static UI chrome ──────────────────────────────────────────────────
    '[READ MORE like ...Read more]':           '...Read more',
    '[STAR RATING like five gold stars]':      'five gold stars',
    '[VERIFIED ICON like blue checkmark]':     'blue checkmark',

    // ── Additional color variants ──────────────────────────────────────────
    '[HIGHLIGHT COLOR like bright lime green / neon yellow]': colorStr(accentColor ?? primaryColor),
    '[BADGE COLOR like lime green with dark text]':           colorStr(accentColor ?? primaryColor),
    '[LOGO COLOR like black]':                                colorStr(darkColor ?? primaryColor),
    '[ARROW COLOR like black]':                               colorStr(darkColor ?? primaryColor),
    '[TEXT COLOR like dark brown]':                           colorStr(darkColor ?? primaryColor),
    '[TEXT COLOR like white or black]':                       'white',
    '[POST-IT COLOR — yellow default]':                       colorStr(accentColor) || 'yellow',
    '[TAPE COLOR — clear / yellow / white]':                  'clear',

    // ── Additional headline / claim variants ──────────────────────────────
    '[HEADLINE like Join 1,000,000+ Members]':               ctx?.social_proof ?? topClaim,
    '[HEADLINE like 24/7 PEAK FEMALE PERFORMANCE]':          ctx?.hero_headline ?? ctx?.short_headline ?? topClaim,
    '[HEADLINE like INCREDIBLY TASTY BREAKFAST IN 30 SECONDS]': ctx?.hero_headline ?? topClaim,
    '[HEADLINE like So tasty you\'ll forget it\'s actually healthy.]': ctx?.hero_headline ?? topClaim,
    '[HEADLINE like A protein bar that tastes like freshly baked raspberry donuts]': ctx?.hero_headline ?? topClaim,
    '[HEADLINE like Made for the pickiest dogs]':             ctx?.hero_headline ?? topClaim,
    '[CLEAN LABEL CLAIM like NO ARTIFICIAL SWEETENERS]':     topClaim,
    '[BENEFIT STATEMENT like Barista grade coffee. Instant. Affordable.]':
      [benefit(ctx, 1), benefit(ctx, 2), benefit(ctx, 3)].filter(Boolean).join('. ') || topClaim,
    '[CALLOUT 1-4 like NO sugar or calories / Multiple Flavors / Iced, cold or hot / Smooth and delicious]':
      [benefit(ctx,1), benefit(ctx,2), benefit(ctx,3), benefit(ctx,4)].filter(Boolean).join(' / '),
    '[COUNT like 33]':                         ctx?.review_count ?? ctx?.social_proof ?? '',
    '[NUMBER like five]':                      ctx?.stats?.[0]?.value ?? 'five',
    '[NUMBER like three]':                     ctx?.stats?.[1]?.value ?? 'three',
    '[VALUE PROP like ALL IN ONE]':            benefit(ctx, 1) || ctx?.tagline || topClaim,

    // ── Additional label variants ─────────────────────────────────────────
    '[LABEL like 5 STAR REVIEWS]':    ctx?.review_count ? `${ctx.review_count} 5-Star Reviews` : '5 Star Reviews',
    '[LABEL like 5-STAR REVIEWS]':    ctx?.review_count ? `${ctx.review_count} 5-Star Reviews` : '5-Star Reviews',
    '[LABEL like HAPPY CUSTOMERS]':   ctx?.review_count ? `${ctx.review_count} Happy Customers` : 'Happy Customers',
    '[LABEL like CALORIES]':          '',
    '[LABEL like FLAVORS]':           '',

    // ── Description / scene variants ──────────────────────────────────────
    '[DESCRIPTION like crumpled foil-wrapped chocolate bar]':
      ctx?.product_description ?? product.description ?? product.name,
    '[REAL-LIFE SETTING — e.g. warm kitchen floor / bathroom counter / living room coffee table]':
      ctx?.setting ?? 'bathroom counter',

    // ── Highlighted phrase exact variants ─────────────────────────────────
    '[HIGHLIGHTED PHRASE 1 like thyroid removed]':
      t0?.pull_quote ? `"${t0.pull_quote}"` : '',
    '[HIGHLIGHTED PHRASE 2 like This is the best product I have found.]':
      t1?.pull_quote ? `"${t1.pull_quote}"` : (t0?.pull_quote ? `"${t0.pull_quote}"` : ''),

    // ── Product visual variants ───────────────────────────────────────────
    '[YOUR PRODUCT like branded shaker cup]':          ctx?.product_description ?? product.name,
    '[YOUR PRODUCT like the signature bright yellow popper bowl overflowing with fluffy popcorn]':
                                                       ctx?.product_description ?? product.name,
    '[PRODUCTS like supplement jars]':                 ctx?.product_description ?? product.name,
    '[PACKAGING like branded gift box]':               ctx?.product_description ?? product.name,
    '[PACKAGING like retail box]':                     ctx?.product_description ?? product.name,
    '[LOOSE UNITS like gummies / capsules]':           product.ingredients?.filter((i) => i.key)?.[0]?.name ?? 'capsules',

    // ── Generic action (shorthand) ────────────────────────────────────────────
    '[ACTION]': ctx?.product_category
      ? `applying ${ctx.product_category.toLowerCase()}`
      : 'using the product',

    // ── Date variants ─────────────────────────────────────────────────────────
    '[BEFORE DATE]': `Before ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    '[AFTER DATE]':  `After ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,

    // ── Whiteboard template — new label/state variants ────────────────────────
    '[AFTER LABEL like Radiant, lifted, visibly renewed eye contour]':
      ctx?.after_state ?? '',
    '[AFTER STATE like the same eye — brighter, lifted, with smoother under-eye area]':
      ctx?.after_state ?? '',
    '[BEFORE LABEL like Dark circles, fine lines, tired-looking eyes]':
      ctx?.before_state ?? '',
    '[BEFORE STATE like a simple eye outline with under-eye shadow and small radiating fine lines]':
      ctx?.before_state ?? '',

    // ── Audience shorthand ────────────────────────────────────────────────────
    '[AUDIENCE]': ctx?.target_audience ?? '',

    // ── Color palette direct slots ────────────────────────────────────────────
    '[COLOR 1]': cp[0] ? `${cp[0].name} (${cp[0].hex})` : colorStr(primaryColor),
    '[COLOR 2]': cp[1] ? `${cp[1].name} (${cp[1].hex})` : colorStr(accentColor),
    '[COLOR 3]': cp[2] ? `${cp[2].name} (${cp[2].hex})` : colorStr(contrastColor),
    '[DARK]':    colorStr(darkColor ?? primaryColor),

    // ── Ingredient / product detail variants ──────────────────────────────────
    '[DETAIL like chips spilling out]':
      product.ingredients?.filter((i) => i.key).map((i) => i.name).join(', ') || heroIngr,
    '[DETAILS like a few gummies/capsules spilling out at the base]':
      product.ingredients?.filter((i) => i.key).map((i) => i.name).join(', ') || heroIngr,
    '[DETAILS]':
      ctx?.product_description ?? product.description ?? product.name,
    '[DOSAGE]':
      product.ingredients?.find((i) => i.key)?.name ?? 'as directed',
    '[PRODUCT DETAILS like capsules scattered nearby]':
      product.ingredients?.filter((i) => i.key).map((i) => i.name).slice(0, 2).join(' and ') || heroIngr,

    // ── Emoji / market ────────────────────────────────────────────────────────
    '[EMOJI]': ctx?.market_flag ?? '✨',

    // ── Layout position ───────────────────────────────────────────────────────
    '[LEFT / BOTTOM / RIGHT]': 'lower right',

    // ── Number shorthand ──────────────────────────────────────────────────────
    '[NUMBER]': ctx?.stats?.[0]?.value ?? 'five',

    // ── Person description variants (all derive from target_audience) ─────────
    '[PERSON DESCRIPTION like a man in his 30s, friendly smile, casual]':
      ctx?.target_audience ?? 'person',
    '[PERSON DESCRIPTION like a woman\'s hand with clean natural nails]':
      ctx?.target_audience ?? 'person',
    '[PERSON DESCRIPTION like smiling woman, mid-60s, silver wavy hair, wearing blue top]':
      ctx?.target_audience ?? 'person',
    '[PERSON DESCRIPTION like young man in dark textured sweater holding an electric guitar]':
      ctx?.target_audience ?? 'person',
    '[PERSON DETAIL like woman\'s hand]':
      ctx?.target_audience ? `hand of a ${ctx.target_audience}` : 'hand',
    '[PERSON like a blonde woman in her early 30s, wearing a casual zip-up sweater]':
      ctx?.target_audience ?? 'person',
    '[PERSON like a man in mid-20s, beanie, crewneck sweatshirt]':
      ctx?.target_audience ?? 'person',
    '[PERSON like a woman\'s hand with clean natural nails]':
      ctx?.target_audience ? `hand of a ${ctx.target_audience}` : 'hand',

    // ── Problem / before-state shorthand ──────────────────────────────────────
    '[PROBLEM STATEMENT]':
      ctx?.before_state ?? '',
    '[PROBLEM VISUAL like the specific physical symptom or problem the product solves — shown on the subject, no product visible]':
      ctx?.before_state ?? '',

    // ── Product descriptor shorthand ──────────────────────────────────────────
    '[PRODUCT DESCRIPTOR like Flavor Wrapped Popcorn Kernels]':
      ctx?.product_category ?? product.name,

    // ── Result / benefit shorthands ───────────────────────────────────────────
    '[RESULT]':        benefit(ctx, 1),
    '[SECOND RESULT]': benefit(ctx, 2),

    // ── Setting / surface new variants ────────────────────────────────────────
    '[SETTING like a bright modern bathroom or kitchen counter]':
      ctx?.setting ?? 'bright bathroom with natural light',
    '[SURFACE like a marble countertop or wooden shelf]':
      ctx?.surface ?? 'marble countertop',

    // ── Superlative claim shorthand ───────────────────────────────────────────
    '[SUPERLATIVE CLAIM like THE WORLD\'S HEALTHIEST CHOCOLATE]':
      ctx?.social_proof ?? topClaim,
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

// ─── aiEnrichPrompt ──────────────────────────────────────────────────────────

const PLACEHOLDER_RE = /\[[A-Z][A-Za-z0-9 _/—–\-\+\.',:!?()&]+\]/g;

const AI_ENRICH_MODEL =
  process.env.ENRICH_MODEL ?? 'claude-haiku-4-5-20251001';

/**
 * Finds any [PLACEHOLDER] tokens that fillTemplate() left unresolved,
 * skips the ones that require real campaign/competitor data (AI_SKIP_TOKENS),
 * then asks Claude to generate creative, on-brand values for the rest.
 *
 * Returns the prompt with all AI-fillable tokens resolved.
 * Tokens in AI_SKIP_TOKENS are left as-is for the user to fill manually.
 *
 * Server-side only — never call from client components.
 */
export async function aiEnrichPrompt(
  prompt:  string,
  product: Product,
): Promise<string> {
  const remaining = [...new Set(prompt.match(PLACEHOLDER_RE) ?? [])].filter(
    (t) => !AI_SKIP_TOKENS.has(t),
  );

  if (remaining.length === 0) return prompt;

  const ctx = product.context;

  // Build a compact product brief for Claude
  const productBrief = [
    `Product: ${product.name} by ${product.sub_brand ?? product.brand}`,
    ctx?.product_category && `Category: ${ctx.product_category}`,
    ctx?.target_audience  && `Target audience: ${ctx.target_audience}`,
    ctx?.mood             && `Visual mood: ${ctx.mood}`,
    ctx?.setting          && `Scene setting: ${ctx.setting}`,
    ctx?.surface          && `Surface: ${ctx.surface}`,
    ctx?.tagline          && `Tagline: ${ctx.tagline}`,
    ctx?.hero_headline    && `Hero headline: ${ctx.hero_headline}`,
    ctx?.benefits?.length && `Benefits: ${ctx.benefits.slice(0, 3).join('; ')}`,
    ctx?.social_proof     && `Social proof: ${ctx.social_proof}`,
    product.ingredients?.filter((i) => i.key).length &&
      `Key ingredients: ${product.ingredients.filter((i) => i.key).map((i) => i.name).join(', ')}`,
    ctx?.primary_color    && `Primary color: ${ctx.primary_color.name} (${ctx.primary_color.hex})`,
    ctx?.accent_color     && `Accent color: ${ctx.accent_color.name} (${ctx.accent_color.hex})`,
  ]
    .filter(Boolean)
    .join('\n');

  const tokenList = remaining.map((t) => `- ${t}`).join('\n');

  const systemPrompt = `You are a creative director for a premium Ayurvedic beauty and wellness brand.
You fill image-generation prompt placeholders with specific, vivid, on-brand values.
Rules:
- Each value must be short (typically 3-12 words) and concrete — suitable for an image-generation model
- Match the brand's mood and visual language described in the product brief
- For person descriptions: match the target audience demographics
- For lighting/texture/gradient: derive from the brand's color palette and mood
- For action descriptions: match the product category and usage context
- For headline/hook text: be emotionally resonant and benefit-led
- Never mention competitors, clinical claims you cannot substantiate, or pricing
- Return ONLY valid JSON — no markdown, no commentary`;

  const userMsg = `Product brief:\n${productBrief}\n\nFill each placeholder below. Return a JSON object where each key is the exact placeholder string (including brackets) and the value is your fill:\n${tokenList}`;

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model:      AI_ENRICH_MODEL,
      max_tokens: 1024,
      messages:   [{ role: 'user', content: userMsg }],
      system:     systemPrompt,
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text : '';

    // Strip markdown fences if Claude wrapped the JSON
    const jsonStr = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    const fills   = JSON.parse(jsonStr) as Record<string, string>;

    let enriched = prompt;
    for (const [token, value] of Object.entries(fills)) {
      if (typeof value === 'string') {
        enriched = enriched.split(token).join(value);
      }
    }
    return enriched;
  } catch (err) {
    // Non-fatal — if AI enrichment fails, return the partially-filled prompt
    console.warn('[aiEnrichPrompt] skipped due to error:', (err as Error).message);
    return prompt;
  }
}
