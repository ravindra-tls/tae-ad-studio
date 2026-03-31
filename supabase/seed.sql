-- TAE Ad Studio — Seed Data
-- Run after migrations

-- ═══════════════════════════════════════════════════════
-- PRODUCTS
-- ═══════════════════════════════════════════════════════

-- Rufolia Pro (A. Modernica Naturalis)
insert into public.products (name, brand, sub_brand, description, ingredients, claims, color_palette, prompt_modifier, compliance_rules, thumbnail_url, context)
values (
  'Rufolia Pro Periorbital Eyemulsion',
  'The Ayurveda Experience',
  'A. Modernica Naturalis',
  'Eye Contour Cream with Manjistha (Rubia Cordifolia) and Niacinamide. The ONLY Concealing Eye Contour Cream — natural Manjistha-pink tint conceals dark circles while actively brightening, firming eyelids, and reducing crow''s feet. Deep wine-red tube (0.53 oz / 15g) with matching carton box and circular A. Modernica Naturalis badge.',
  '[
    {"name": "Manjistha (Rubia Cordifolia)", "key": true, "description": "5000-year-old Ayurvedic hero — clinically proven brightening, natural peachy-pink tint, complexion enhancer (Varn Krit), moisturizing (Snighda)"},
    {"name": "Sacred Lotus Seed", "key": true, "description": "Skin brightening activity, anti-aging, multi-faceted botanical"},
    {"name": "Niacinamide", "key": true, "description": "Vitamin B3 — brightening, toning, and firming. Manjistha''s perfect partner"},
    {"name": "Aloe Vera Gel Extract", "key": false, "description": "Ayurvedic miracle plant — helps cream melt into delicate eye skin"},
    {"name": "Shea Butter", "key": false, "description": "Deep moisturization, skin-melting texture"},
    {"name": "Sesame Seed Oil", "key": false, "description": "Nourishing base oil"},
    {"name": "Licorice Extract", "key": false, "description": "Brightening support"},
    {"name": "Rose Flower Oil", "key": false, "description": "Natural aroma note"},
    {"name": "Geranium Flower Oil", "key": false, "description": "Natural aroma note"}
  ]'::jsonb,
  '[
    {"text": "Visibly reduces the appearance of Dark Circles", "stat": "100% of women in consumer study"},
    {"text": "Eyelids look Firmer and Smoother", "stat": "100% of women in consumer study"},
    {"text": "Improved Smoothness around the eye area", "stat": "99% of women in consumer study"},
    {"text": "Reduced appearance of Crow''s Feet Wrinkles", "stat": ">98% of women in consumer study"},
    {"text": "Overall Lifted look and feel around the eye area", "stat": ">97% of women in consumer study"},
    {"text": "Up to 12 hours of moisturization around the eye area", "stat": "100% of women — instant benefit"},
    {"text": "Soothing sensation immediately after application", "stat": "100% of women — instant benefit"}
  ]'::jsonb,
  '[
    {"name": "Wine Red", "hex": "#7B1E1E", "usage": "Primary / packaging"},
    {"name": "Manjistha Peach", "hex": "#D4947A", "usage": "Product tint / accent — natural Manjistha pink"},
    {"name": "Warm Cream", "hex": "#FFF9EE", "usage": "Contrast / background"},
    {"name": "Dark Charcoal", "hex": "#1A1A1A", "usage": "Dark / text on light"},
    {"name": "Gold", "hex": "#C9A85C", "usage": "Badge accent"}
  ]'::jsonb,
  'Luxurious Ayurvedic skincare aesthetic: warm cream and terracotta backgrounds, botanical accents, soft studio lighting with gentle shadows, premium packaging feel, muted jewel-tone palette (wine red, peachy-pink, cream, gold), photorealistic product hero shots with natural ingredients artfully scattered (manjistha roots/powder, lotus petals), clean serif typography with generous white-space, sophisticated market sensibility blending ancient Ayurvedic herbal wisdom with modern clinical credibility. Skin tone: warm to medium-deep. Eye area close-ups allowed. Never show dark circles — only show improvement.',
  ARRAY['100% natural', 'cure', 'treat', 'anti-aging', 'remove wrinkles', 'permanent results'],
  null,
  '{
    "primary_color":    {"name": "Wine Red",        "hex": "#7B1E1E"},
    "accent_color":     {"name": "Manjistha Peach", "hex": "#D4947A"},
    "contrast_color":   {"name": "Warm Cream",      "hex": "#FFF9EE"},
    "dark_color":       {"name": "Dark Charcoal",   "hex": "#1A1A1A"},
    "tint_color":       {"name": "Manjistha Peach", "hex": "#D4947A"},
    "background_color": {"name": "Warm Cream",      "hex": "#FFF9EE"},
    "tagline": "The ONLY Concealing Eye Contour Cream — Ancient Tint, Modern Brightness",
    "product_description": "Deep wine-red/burgundy cream tube (0.53 oz / 15g) with circular A. Modernica Naturalis badge in dark teal and gold. Cream inside is a warm peachy-pink tone — looks like a concealer. Premium, clinical-yet-Ayurvedic aesthetic.",
    "product_category": "Eye Contour Cream",
    "price": "SGD 59",
    "website": "sg.theayurvedaexperience.com",
    "target_audience": "Women 40–65+, post-menopausal, concerned about dark circles, droopy eyelids, crow''s feet",
    "market_flag": "🇸🇬",
    "benefits": [
      "Visibly reduces the appearance of Dark Circles",
      "Firms and Smooths Droopy Eyelids",
      "Reduces Crow''s Feet Wrinkles",
      "12 Hours of Intense Moisturization",
      "Natural Concealing Pink Tint — no white cast, blends into all skin tones"
    ],
    "stats": [
      {"value": "100%", "label": "Women saw Dark Circles reduce", "context": "Consumer study, 110 women, 40–65, 8 weeks"},
      {"value": "100%", "label": "Women reported Firmer, Smoother Eyelids", "context": "Consumer study, 110 women, 40–65, 8 weeks"},
      {"value": "99%",  "label": "Women saw improved Smoothness around eyes", "context": "Consumer study, 8 weeks"},
      {"value": ">98%", "label": "Women saw reduced Crow''s Feet Wrinkles", "context": "Consumer study, 8 weeks"},
      {"value": ">97%", "label": "Women agreed eye area had an overall Lifted look", "context": "Consumer study, 8 weeks"}
    ],
    "review_count": "64+ verified reviews",
    "social_proof": "110 women tested, aged 40–65, used twice daily for 8 weeks",
    "before_state": "dark circles, droopy eyelids, crow''s feet wrinkles",
    "after_state": "brightened, firmed, lifted eye area",
    "timeframe": "8 weeks",
    "surface": "marble bathroom vanity",
    "setting": "bright, airy bathroom with soft natural window light",
    "mood": "warm, luminous, confident, age-positive",
    "cta": "Shop Now",
    "short_headline": "The Concealing Eye Cream",
    "hero_headline": "The ONLY ''Concealing'' Eye Contour Cream You''ll Ever Need",
    "educational_hook": "The eye area is the first to show aging — and concealers only hide the problem. Manjistha, used for 5000 years in Ayurveda, actively brightens while its natural pink tint provides real coverage.",
    "testimonials": [
      {
        "name": "Jennifer D.",
        "age": 64,
        "headline": "Miraculous",
        "quote": "I have purchased every cream, ointment, serum, you name it for 40 years. I no longer need concealer — and I''ve purchased every concealer available from drugstore to Internet. My biggest fear now is that this product will be out of stock!",
        "pull_quote": "I no longer need concealer",
        "flag": "🇺🇸",
        "verified": true
      },
      {
        "name": "Kay B.",
        "age": 74,
        "headline": "WORKS, EVEN ON OLD EYELIDS!",
        "quote": "At 74, my eyelids were beginning to get very wrinkly. I have huge eyelids, so it was quite noticeable. This eye cream makes my eyes look years younger.",
        "pull_quote": "Makes my eyes look years younger",
        "flag": "🇺🇸",
        "verified": true
      },
      {
        "name": "Meagan N.",
        "age": 52,
        "headline": "AMAZING EYEMULSION!",
        "quote": "This ''eyemulsion'' product is incredible. I used to have dark circles under my eyes quite often. A must have for women of any age.",
        "pull_quote": "A must have for women of any age",
        "flag": "🇺🇸",
        "verified": true
      },
      {
        "name": "Lori",
        "age": 51,
        "headline": "AMAZING EYE CREAM",
        "quote": "I absolutely love this product. The pale pink color helps camouflage my dark under eyes. It is so hydrating and smells intoxicating. Its matte finish makes it perfect under makeup.",
        "pull_quote": "pale pink color camouflages my dark under eyes",
        "flag": "🇺🇸",
        "verified": true
      },
      {
        "name": "Beverly C.",
        "age": 72,
        "headline": "This Product is a Serious Game Changer!",
        "quote": "I can''t believe I finally found something... the eye treatment is like nothing else I''ve tried!",
        "pull_quote": "This Product is a Serious Game Changer",
        "flag": "🇺🇸",
        "verified": true
      },
      {
        "name": "Georgina A.",
        "age": 82,
        "headline": "OLD EYES",
        "quote": "Very good — I am almost 83 years old and I find firming results with Rufolia.",
        "pull_quote": "firming results at almost 83",
        "flag": "🇺🇸",
        "verified": true
      }
    ]
  }'::jsonb
);

-- Manjish Glow Elixir (iYURA)
insert into public.products (name, brand, sub_brand, description, ingredients, claims, color_palette, prompt_modifier, compliance_rules, thumbnail_url, context)
values (
  'Manjish Glow Elixir',
  'The Ayurveda Experience',
  'iYURA',
  'Ayurveda''s Pink Power Potion — a glow-giving, even-toning and complexion-restoring night-time facial massage oil. Brick-red elixir with Indian Madder (Manjistha), Lemon, and Butter Tree Bark. Hand-painted Madhubani artwork on cylindrical packaging. 50 ml (1.69 fl oz). Use 4 drops, 5 minutes every night for 7 consecutive nights for best results.',
  '[
    {"name": "Manjistha (Indian Madder)", "key": true, "description": "Rubia Cordifolia — celebrated Ayurvedic rejuvenative and complexion enhancer, lends the oil its pink-red color, helps balance uneven skin tone and blemishes"},
    {"name": "Lemon (Jambheer)", "key": true, "description": "Pitta-pacifier — cooling, balancing, soothing, helps brighten complexion"},
    {"name": "Butter Tree Bark (Mahua)", "key": true, "description": "Madhuca longifolia bark — used for thousands of years for rejuvenation and youthful appearance, helps tone down appearance of wrinkles and restore radiance"},
    {"name": "Sesame Seed Oil", "key": false, "description": "Tila Taila — nourishing base oil"},
    {"name": "Milk Extract", "key": false, "description": "Godugdha — traditional Ayurvedic ingredient for skin nourishment"},
    {"name": "Licorice", "key": false, "description": "Yashtimadhu — brightening and soothing support"},
    {"name": "Citrus Limon (Lemon) Juice Extract", "key": false, "description": "Natural brightening"}
  ]'::jsonb,
  '[
    {"text": "Imparts a natural, gold-like glow reminiscent of the radiance described in ancient Ayurvedic text Chakradutt", "source": "Ayurvedic classical text"},
    {"text": "Evens skin tone and restores complexion with regular nightly use", "source": "Consumer feedback"},
    {"text": "Clearer looking complexion, balanced skin tone, eased appearance of age spots", "source": "Product benefits"}
  ]'::jsonb,
  '[
    {"name": "Saffron Gold", "hex": "#D4A843", "usage": "Primary / accent"},
    {"name": "Deep Plum", "hex": "#4A1942", "usage": "Accent / Madhubani art"},
    {"name": "Brick Red", "hex": "#A0522D", "usage": "Oil color / product identity"},
    {"name": "Ivory", "hex": "#FFFFF0", "usage": "Background / contrast"},
    {"name": "Copper", "hex": "#B87333", "usage": "Warm accent"}
  ]'::jsonb,
  'Luxurious Ayurvedic skincare aesthetic: warm cream and terracotta backgrounds, botanical accents, soft studio lighting with gentle shadows, premium glass packaging with hand-painted Madhubani cylindrical artwork, muted jewel-tone palette (plum, saffron, brick-red, ivory, copper), photorealistic product hero shots with manjistha roots/powder, fresh lemons, bark pieces artfully scattered, clean serif typography with generous white-space, sophisticated sensibility blending ancient herbal wisdom with modern beauty credibility. Skin tone: warm to medium. Evening/nighttime mood.',
  ARRAY['cure', 'treat', 'anti-aging', 'bleach'],
  null,
  '{
    "primary_color":    {"name": "Saffron Gold",   "hex": "#D4A843"},
    "accent_color":     {"name": "Deep Plum",      "hex": "#4A1942"},
    "contrast_color":   {"name": "Ivory",          "hex": "#FFFFF0"},
    "dark_color":       {"name": "Deep Plum",      "hex": "#4A1942"},
    "tint_color":       {"name": "Brick Red",      "hex": "#A0522D"},
    "background_color": {"name": "Ivory",          "hex": "#FFFFF0"},
    "tagline": "Ayurveda''s Pink Power Potion — 4 Drops, 5 Minutes, Gold-Like Glow",
    "product_description": "Brick-red facial oil in glass bottle with hand-painted Madhubani artwork cylindrical packaging. Classical-Inspirations Collection from iYURA. 50 ml (1.69 fl oz). Premium, artisanal Ayurvedic aesthetic.",
    "product_category": "Night-Time Facial Massage Oil",
    "price": "$45",
    "website": "theayurvedaexperience.com",
    "target_audience": "Women 40–65+, concerned about dull/uneven skin tone, patchy complexion, age spots, loss of radiance",
    "benefits": [
      "Clearer looking complexion",
      "Balanced, even skin tone",
      "Deep, natural gold-like glow",
      "Eased appearance of age spots and aging skin",
      "Non-sticky softness with a dewy finish",
      "Compliments on well-maintained, youthful, dewy skin"
    ],
    "stats": [],
    "review_count": "Thousands of verified reviews",
    "social_proof": "iYURA bestselling night oil with Madhubani artwork packaging",
    "before_state": "dull, uneven, patchy skin tone, age spots, loss of radiance",
    "after_state": "glowing, even-toned, clear, radiant complexion",
    "timeframe": "7 consecutive nights for visible results",
    "surface": "copper tray or dark wood vanity",
    "setting": "warm, intimate nighttime ritual setting with soft candlelight",
    "mood": "luxurious, ritualistic, intimate, golden-hour warmth",
    "cta": "Try Manjish for yourself, NOW!",
    "short_headline": "The Pink Power Potion",
    "hero_headline": "4 Drops, 5 Minutes Every Night and You Won''t Want Makeup!",
    "educational_hook": "Ancient Ayurvedic text Chakradutt says: One who massages her face with it regularly for 7 consecutive nights gets skin with a glow reminiscent of the attractive radiance of gold. Manjistha, the herb that gives this oil its pink color, is a celebrated complexion enhancer in 5000-year-old Ayurveda.",
    "testimonials": [
      {
        "name": "Sandra C.",
        "age": 67,
        "headline": "Skin Tone Evened Out",
        "quote": "I am 67 years old and my skin tone has become uneven. I noticed within a week that my skin tone was becoming more even.",
        "pull_quote": "noticed within a week",
        "flag": "🇺🇸",
        "verified": true
      },
      {
        "name": "Laurie C.",
        "headline": "Multiple Compliments",
        "quote": "Since adding this to my nighttime routine, I''ve had multiple people comment on my skin. Several asked what I was using differently.",
        "pull_quote": "multiple people comment on my skin",
        "flag": "🇺🇸",
        "verified": true
      },
      {
        "name": "Cheri W.",
        "headline": "Smooth and Vibrant",
        "quote": "I''m very pleased with the quality of products. This Elixir has made my skin feel so smooth and vibrant looking.",
        "pull_quote": "smooth and vibrant looking",
        "flag": "🇺🇸",
        "verified": true
      },
      {
        "name": "Elaine W.",
        "headline": "LOVE It",
        "quote": "I absolutely LOVE this on my face! I use it every night and can''t say enough good things about it.",
        "pull_quote": "can''t say enough good things",
        "flag": "🇺🇸",
        "verified": true
      }
    ]
  }'::jsonb
);

-- Balaayah Black Gram Body Booster (iYURA)
insert into public.products (name, brand, sub_brand, description, ingredients, claims, color_palette, prompt_modifier, compliance_rules, thumbnail_url, context)
values (
  'Balaayah Black Gram Body Booster',
  'The Ayurveda Experience',
  'iYURA',
  'The Black Gold of Skincare — an ultra-rich but non-sticky Ayurvedic body oil for aging, dehydrated, dry skin. Powered by Black Gram Lentil (Vigna Mungo) with Frankincense and Vanilla essential oils. Transforms saggy, crepey, dry skin on arms, legs, stomach into firm, velvet-soft, glossy skin. 100 ml (3.38 fl oz). 100% natural, vegan, not tested on animals.',
  '[
    {"name": "Black Gram Lentil (Vigna Mungo)", "key": true, "description": "The biggest power-bomb of Balaayah — extremely nutritious lentil rich in protein and iron, uniquely prized in Ayurveda for its moisturizing and volumizing quality for skin"},
    {"name": "Sesame Seed Oil", "key": false, "description": "Sesamum Indicum — warming, nourishing base oil"},
    {"name": "Himalayan Rock Salt", "key": true, "description": "Enables triple-effect moisturization: hydrates, moisturizes and protects moisture loss. Gives this oil the ability to hydrate as well as moisturize"},
    {"name": "Velvet Beans (Mucuna Pruriens)", "key": true, "description": "Leguminous tropical plant — supports skin firmness and tone"},
    {"name": "Nut Grass (Cyperus Rotundus)", "key": false, "description": "Perennial sedge plant — supports skin tone and complexion"},
    {"name": "Castor Oil (Ricinus Communis)", "key": false, "description": "Rich in ricinoleic acid — provides deep hydration"},
    {"name": "Frankincense Essential Oil", "key": false, "description": "Natural aroma — meditative, relaxing scent note"},
    {"name": "Vanilla Essential Oil", "key": false, "description": "Natural aroma — warm, comforting scent note"},
    {"name": "Country Mallow (Abutilon Indicum)", "key": false, "description": "Traditional Ayurvedic herb for skin nourishment"}
  ]'::jsonb,
  '[
    {"text": "Instant, day-long, intense moisture that keeps skin comfortable through the day", "source": "Product benefits"},
    {"text": "Transforms saggy, crepey, dry skin into firm, velvet-soft, glossy skin", "source": "Consumer feedback"},
    {"text": "Freedom to wear sleeveless clothes, shorts, short dresses without self-consciousness", "source": "Consumer testimonials"}
  ]'::jsonb,
  '[
    {"name": "Dark Amber/Black Gold", "hex": "#4A3728", "usage": "Primary / product color"},
    {"name": "Warm Amber", "hex": "#B8860B", "usage": "Accent / gold tones"},
    {"name": "Deep Brown", "hex": "#3E2723", "usage": "Dark accent"},
    {"name": "Cream", "hex": "#FFF9EE", "usage": "Background / contrast"},
    {"name": "Rich Gold", "hex": "#C9A85C", "usage": "Premium accent"}
  ]'::jsonb,
  'Luxurious Ayurvedic body care aesthetic: warm amber and cream backgrounds, black gram lentils scattered as props, soft studio lighting with gentle shadows, premium dark glass bottle packaging, warm earthy tones (amber, brown, gold, cream), photorealistic product hero shots with black gram lentils, himalayan salt crystals, vanilla pods, frankincense resin artfully arranged, clean serif typography with generous white-space, confident body-positive imagery of women 50+ in sleeveless wear, sophisticated sensibility blending ancient Ayurvedic body-care wisdom with modern self-care luxury. Body skin focus — arms, legs, knees.',
  ARRAY['cure', 'treat', 'anti-aging', 'weight loss'],
  null,
  '{
    "primary_color":    {"name": "Dark Amber",     "hex": "#4A3728"},
    "accent_color":     {"name": "Warm Amber",     "hex": "#B8860B"},
    "contrast_color":   {"name": "Cream",          "hex": "#FFF9EE"},
    "dark_color":       {"name": "Deep Brown",     "hex": "#3E2723"},
    "tint_color":       {"name": "Rich Gold",      "hex": "#C9A85C"},
    "background_color": {"name": "Cream",          "hex": "#FFF9EE"},
    "tagline": "The Black Gold of Skincare — Turn Saggy, Crepey Skin into Firm, Velvet-Soft, Glossy Skin",
    "product_description": "Dark amber body oil in premium glass bottle. 100 ml (3.38 fl oz). Rich, balm-like oil with subtle Frankincense and Vanilla aroma. iYURA sub-brand. 100% natural, vegan, no mineral oil, no parabens.",
    "product_category": "Body Oil / Body Booster",
    "price": "$45",
    "website": "theayurvedaexperience.com",
    "target_audience": "Women 50–80+, concerned about dry/crepey/saggy skin on arms, legs, knees, stomach, wanting to wear sleeveless and shorts confidently",
    "benefits": [
      "Instant, day-long intense moisture",
      "Firms and tones saggy, crepey skin on arms and legs",
      "Velvet-soft, glossy skin texture",
      "Freedom to wear sleeveless clothes and shorts confidently",
      "Soothing after-shower ritual for body connection",
      "Triple-effect moisturization: hydrates, moisturizes, protects"
    ],
    "stats": [],
    "review_count": "Thousands of verified reviews",
    "social_proof": "iYURA flagship body oil — the Black Gold phenomenon",
    "before_state": "saggy, crepey, dry, itchy skin on arms and legs, tissue-paper texture, alligator skin, hiding under long sleeves",
    "after_state": "firm, velvet-soft, glossy, moisturized skin, wearing sleeveless confidently, beach-ready",
    "timeframe": "Noticeable improvement within days of regular use",
    "surface": "warm wood bathroom shelf or marble vanity",
    "setting": "luxurious bathroom with warm natural light, post-shower ritual",
    "mood": "empowering, liberating, body-positive, warm, self-care luxury",
    "cta": "Experience the Black-Gram Balaayah Transformation!",
    "short_headline": "The Black Gold of Skincare",
    "hero_headline": "Turn Saggy, Crepey, Dry Skin on Arms & Legs into Firm, Velvet-Soft, Glossy Skin",
    "educational_hook": "Black Gram Lentil has a unique quality prized in Ayurveda — it is naturally moisturizing and volumizing for skin. Combined with Himalayan Rock Salt for triple-effect moisturization (hydrates + moisturizes + protects), this is no ordinary body oil.",
    "testimonials": [
      {
        "name": "Nancy E.",
        "age": 80,
        "headline": "A Pleasant Surprise!",
        "quote": "Experienced an unbelievable tightening of loose aged skin over all four extremities. Had aged well until the last few years.",
        "pull_quote": "unbelievable tightening of loose aged skin",
        "flag": "🇺🇸",
        "verified": true
      },
      {
        "name": "Barbara V.",
        "age": 58,
        "headline": "Excellent for Crepey Skin!",
        "quote": "I absolutely love this product and now I can''t live without it! It''s made such a HUGE difference in my skin.",
        "pull_quote": "can''t live without it",
        "flag": "🇺🇸",
        "verified": true
      },
      {
        "name": "Darlene P.",
        "age": 67,
        "headline": "Going Sleeveless!",
        "quote": "I am 67 and would not have even considered going sleeveless before trying this product. I have been using it for 2 months and my arms look so much better.",
        "pull_quote": "would not have considered going sleeveless before",
        "flag": "🇺🇸",
        "verified": true
      },
      {
        "name": "Janice V.",
        "headline": "Dramatic Change in 4 Days",
        "quote": "Love, love this oil. In just 4 days of using this oil my skin changed dramatically for the better.",
        "pull_quote": "skin changed dramatically in just 4 days",
        "flag": "🇺🇸",
        "verified": true
      },
      {
        "name": "Barbara M.",
        "headline": "Truly Amazing",
        "quote": "This stuff is truly amazing! I assumed it was just another oil and my legs would look dull the next day — but they didn''t!",
        "pull_quote": "This stuff is truly amazing",
        "flag": "🇺🇸",
        "verified": true
      }
    ]
  }'::jsonb
);

-- Flex & Fine (HERBIUS / Ayuttva) — US supplements
insert into public.products (name, brand, sub_brand, description, ingredients, claims, color_palette, prompt_modifier, compliance_rules, thumbnail_url, context)
values (
  'Flex & Fine Joint Support',
  'The Ayurveda Experience',
  'HERBIUS',
  'Ayurvedic supplement for healthy and strong joints. Targets lubricin — the hidden protein that stops joints from drying out. 8 clinically studied herbs at their researched doses. 100% natural, vegan, gluten-free, non-GMO. 4 capsules daily after a meal. $28 per bottle (1-month supply). Third-party tested, manufactured in US FDA-registered GMP facility.',
  '[
    {"name": "Guggul", "key": true, "description": "Commiphora mukul resin — blocks cytokines IL-1β and TNF-α, limits cartilage and collagen loss, clinically studied dose"},
    {"name": "Winged Treebine (Cissus)", "key": true, "description": "Hadjod / bone-setter — unique bone-shaped stem plant, suppresses oxidative stress and pro-inflammatory cytokines, clinically studied dose"},
    {"name": "Turmeric (95% Curcuminoids)", "key": true, "description": "Golden spice — curcumin compound for joint comfort and synovial fluid health, supported by 50+ journal articles"},
    {"name": "Boswellia Serrata", "key": true, "description": "Indian Frankincense — increases hyaluronan levels for joint cushioning, clinically studied dose"},
    {"name": "Ginger", "key": false, "description": "Widely used natural remedy — guards joints from age-related stiffness and decline"},
    {"name": "Garlic", "key": false, "description": "Strong antioxidant — significant reduction in TNF-α levels, pain intensity, and fatigue in randomized double-blind trial (70 women with RA)"},
    {"name": "Cyperus", "key": false, "description": "Cyperaceae family — helps support smoother movement"},
    {"name": "Black Pepper (95% Piperine)", "key": false, "description": "Bioavailability enhancer — increases curcumin absorption by up to 2000% (Johns Hopkins Medicine), clinically studied dosage"}
  ]'::jsonb,
  '[
    {"text": "Supports natural lubricin production for joint lubrication", "source": "Preclinical study"},
    {"text": "100% natural and clean — zero glucosamine, zero shellfish, vegan", "source": "Product formulation"},
    {"text": "Targets 7 key mechanisms of joint health", "source": "Multi-mechanism approach"},
    {"text": "Each herb at clinically studied dose including NIH-listed studies", "source": "Scientific formulation"},
    {"text": "Preclinical study showed measurable results after one month", "source": "Scientific study"}
  ]'::jsonb,
  '[
    {"name": "Forest Green", "hex": "#2D5016", "usage": "Primary"},
    {"name": "Earth Brown", "hex": "#5C4033", "usage": "Accent"},
    {"name": "Warm White", "hex": "#FAF9F6", "usage": "Background"},
    {"name": "Turmeric Gold", "hex": "#D4A843", "usage": "Ingredient accent"},
    {"name": "Capsule Green", "hex": "#4A7C3F", "usage": "Product color"}
  ]'::jsonb,
  'Clean supplement advertising aesthetic: crisp white or soft gradient backgrounds, hero product bottle prominently centered, natural herb/spice ingredients artfully scattered (turmeric root, ginger, guggul resin, black pepper), warm earthy tones (forest green, brown, cream, turmeric gold), trustworthy modern sans-serif typography, lifestyle imagery of active 50–70+ adults moving freely (walking, gardening, playing with grandkids), clinical credibility cues (study callouts, practitioner endorsements, third-party testing badges), bold benefit-first headlines, joint-mobility visual metaphors.',
  ARRAY['pain', 'reduce', 'treat', 'cure', 'diagnose', 'disease', 'glucosamine'],
  null,
  '{
    "primary_color":    {"name": "Forest Green",   "hex": "#2D5016"},
    "accent_color":     {"name": "Turmeric Gold",  "hex": "#D4A843"},
    "contrast_color":   {"name": "Warm White",     "hex": "#FAF9F6"},
    "dark_color":       {"name": "Earth Brown",    "hex": "#5C4033"},
    "tint_color":       {"name": "Capsule Green",  "hex": "#4A7C3F"},
    "background_color": {"name": "Warm White",     "hex": "#FAF9F6"},
    "tagline": "The Hidden Protein That Stops Your Joints From Drying Out — And How to Naturally Restore It After 50",
    "product_description": "Green supplement bottle with HERBIUS branding. Vegetable capsules. 1-month supply per bottle. Third-party tested with Certificate of Conformity. Manufactured in US FDA-registered GMP facility. Pack of 1 ($28), Pack of 2 (Save 10%), Pack of 3 (Save 15%).",
    "product_category": "Ayurvedic Joint Supplement",
    "price": "$28",
    "website": "theayurvedaexperience.com",
    "target_audience": "Adults 50–70+, experiencing joint stiffness, knee pain, limited mobility, wanting to avoid glucosamine/chondroitin, seeking natural/herbal alternatives",
    "market_flag": "🇺🇸",
    "benefits": [
      "Supports natural lubricin production for joint lubrication",
      "Targets 7 key mechanisms of joint health",
      "100% natural — zero glucosamine, zero shellfish",
      "Each herb at clinically studied dose",
      "Easy-to-swallow vegetable capsules",
      "Supports healthy synovial fluid"
    ],
    "stats": [
      {"value": "8", "label": "Clinically studied herbs", "context": "Each at researched dose, including NIH-listed studies"},
      {"value": "7", "label": "Key mechanisms of joint health targeted", "context": "Multi-mechanism approach vs single-target supplements"},
      {"value": "2000%", "label": "Increased curcumin bioavailability via piperine", "context": "Johns Hopkins Medicine research"},
      {"value": "1.7M+", "label": "Customers across 25+ countries", "context": "The Ayurveda Experience global community"},
      {"value": "45K+", "label": "5-star reviews", "context": "Across The Ayurveda Experience products"}
    ],
    "review_count": "Growing reviews",
    "social_proof": "Recommended by Ayurvedic practitioners Shanel Miller (10+ years) and Jennifer Maklan (14+ years). From HERBIUS — The Ayurveda Experience in-house supplement brand. 1.7M+ customers across 25+ countries.",
    "before_state": "stiff knees, sore shoulders, difficulty climbing stairs, getting out of bed feels like a task, can''t bend to pick things up, losing independence",
    "after_state": "smooth fluid movement, standing up without help, opening jars without wincing, taking extra miles on walks, playing with grandkids again",
    "timeframe": "Feel the difference — many choose the 3-month supply for consistent support",
    "surface": "clean white surface with scattered turmeric and herbs",
    "setting": "bright, airy lifestyle setting — garden, walking path, home kitchen",
    "mood": "hopeful, empowering, active, scientifically credible, warm",
    "cta": "Try Flex & Fine for Healthy Joints Today",
    "short_headline": "Restore Your Joint''s Natural Lubricant",
    "hero_headline": "New Research Reveals The Hidden Protein That Stops Your Joints From Drying Out",
    "educational_hook": "Most remedies completely miss what your joints are actually starving for — Lubricin, your joint''s natural lubricant. As you age, lubricin production naturally declines. Most glucosamine supplements focus only on cartilage support, but Flex & Fine targets 7 key mechanisms of joint health with 8 clinically studied herbs.",
    "testimonials": []
  }'::jsonb
);

-- Kesaradi Daily Glow (iYURA) — NEW
insert into public.products (name, brand, sub_brand, description, ingredients, claims, color_palette, prompt_modifier, compliance_rules, thumbnail_url, context)
values (
  'Kesaradi Daily Glow',
  'The Ayurveda Experience',
  'iYURA',
  'Ayurveda''s Brightening, Revitalizing, Uber-Nourishing Secret — a polyherbal cooked daily facial oil with Saffron (Threads of Sunrise), Turmeric (Glow''rious Dust), and Lotus plus 17+ Ayurvedic ingredients. Softens the appearance of mouth lines, awakens radiance, evens out skin tone 100% naturally. Light, non-greasy, fast-absorbing with a satin finish. 3 drops every morning. 50 ml (1.69 fl oz). $45.',
  '[
    {"name": "Saffron (Crocus Sativus)", "key": true, "description": "Threads of Sunrise / Red Gold — world''s most expensive spice, 50,000-75,000 flowers for 16 oz. Helps with complexion enhancement and even-toning per classical Ayurvedic texts Bhavprakash and Astanga Hridaya"},
    {"name": "Turmeric (Curcuma Longa)", "key": true, "description": "The Glow''rious Dust / Golden Spice — rich in curcumin, celebrated for 5,000 years, brightens and energizes skin, restores healthy glow, supports beauty barrier"},
    {"name": "Sacred Lotus (Nelumbo Nucifera)", "key": true, "description": "Flower of Renewal and Purity — supports hydration, calms skin, encourages fresher even-looking appearance, leaves luminous glow, smooths look of wrinkles"},
    {"name": "Sesame Seed Oil", "key": false, "description": "Tila Taila — nourishing base oil"},
    {"name": "Milk Extract", "key": false, "description": "Godugdha — traditional skin nourishment"},
    {"name": "Indian Madder (Manjistha)", "key": false, "description": "Rubia Cordifolia — complexion evening"},
    {"name": "Symplocus Tree (Lodhra)", "key": false, "description": "Symplocus Racemosa — traditional brightener"},
    {"name": "Nut Grass (Mustak)", "key": false, "description": "Cyperus Rotundus — skin tone support"},
    {"name": "Vetiver Grass (Ushira)", "key": false, "description": "Vetiveria Zizanioides — cooling, soothing"},
    {"name": "Licorice (Yashtimadhu)", "key": false, "description": "Glycyrrhiza Glabra — brightening support"},
    {"name": "Indian Bay Leaf (Tejpatra)", "key": false, "description": "Cinnamomum Tamala — aromatic herb"},
    {"name": "Wild Himalayan Cherry (Padmak)", "key": false, "description": "Prunus Cerasoides — complexion enhancer"},
    {"name": "Indian Barberry (Daruharidra)", "key": false, "description": "Berberis Aristata — skin clarity"},
    {"name": "Rose Chestnut (Nagkeshar)", "key": false, "description": "Mesua Ferra — fragrant skin toner"},
    {"name": "Flame of the Forest (Palash)", "key": false, "description": "Butea Monosperma — traditional botanical"},
    {"name": "Indian Banyan (Vata)", "key": false, "description": "Ficus Benghalensis — astringent support"},
    {"name": "Rose (Taruni)", "key": false, "description": "Rosa Damascena — natural fragrance and skin soother"},
    {"name": "Geranium Flower Oil", "key": false, "description": "Pelargonium Graveolens — natural aroma"}
  ]'::jsonb,
  '[
    {"text": "Softens the appearance of harsh-looking mouth lines", "source": "Consumer feedback"},
    {"text": "Awakens radiance and evens out skin tone 100% naturally", "source": "Product benefits"},
    {"text": "Fast-absorbing, non-greasy with a satin matte-like finish — works perfectly under makeup", "source": "Product formulation"},
    {"text": "Polyherbal cooked formula with 17+ Ayurvedic ingredients — not a surface-level infusion", "source": "Manufacturing process"}
  ]'::jsonb,
  '[
    {"name": "Saffron Gold", "hex": "#D4A843", "usage": "Primary / hero ingredient color"},
    {"name": "Turmeric Orange", "hex": "#E8A838", "usage": "Warm accent"},
    {"name": "Lotus Pink", "hex": "#D4947A", "usage": "Soft accent"},
    {"name": "Warm Cream", "hex": "#FFF9EE", "usage": "Background"},
    {"name": "Deep Saffron", "hex": "#8B4513", "usage": "Dark accent"}
  ]'::jsonb,
  'Luxurious Ayurvedic daily skincare aesthetic: warm saffron-gold and cream backgrounds, saffron threads, turmeric powder, lotus petals scattered as props, soft morning daylight with gentle warmth, premium glass bottle packaging, warm golden tones (saffron, turmeric, cream, rose), photorealistic product hero shots, clean serif typography with generous white-space, morning ritual imagery — woman applying oil to face in bright bathroom, confident close-up-ready skin, dewy not oily finish, mouth-area focus for lip line benefits.',
  ARRAY['cure', 'treat', 'anti-aging', 'remove wrinkles', 'permanent results'],
  null,
  '{
    "primary_color":    {"name": "Saffron Gold",     "hex": "#D4A843"},
    "accent_color":     {"name": "Turmeric Orange",  "hex": "#E8A838"},
    "contrast_color":   {"name": "Warm Cream",       "hex": "#FFF9EE"},
    "dark_color":       {"name": "Deep Saffron",     "hex": "#8B4513"},
    "tint_color":       {"name": "Lotus Pink",       "hex": "#D4947A"},
    "background_color": {"name": "Warm Cream",       "hex": "#FFF9EE"},
    "tagline": "3 Drops Every Morning for a Softer-Looking Mouth Frame",
    "product_description": "Golden-toned facial oil in glass bottle with iYURA branding. 50 ml (1.69 fl oz). Light, non-greasy, satin finish that works under makeup. Polyherbal cooked formula — not a surface-level infusion. Soft earthy-rosy aroma with warm saffron and turmeric undertones.",
    "product_category": "Daily Facial Oil",
    "price": "$45",
    "website": "theayurvedaexperience.com",
    "target_audience": "Women 40–65+, concerned about mouth lines, lip lines, smile lines, uneven skin tone, dullness, skincare-fatigued women, ex-smokers, sun-worshippers, skeptics",
    "benefits": [
      "Softens the appearance of harsh-looking mouth lines and lip lines",
      "Awakens radiance and evens out skin tone",
      "Fast-absorbing, non-greasy satin finish — works under makeup",
      "Eases harsh-looking shadows above upper lip",
      "Smooths concealer-catch zones where coverage clings and cracks",
      "Re-cushions the look of fine creases with moisture",
      "Hydration-shield against dry indoor air and midday dryness",
      "Close-up-ready confidence from the first touch"
    ],
    "stats": [
      {"value": "4.6", "label": "Average rating out of 5", "context": "Based on thousands of reviews"},
      {"value": "17+", "label": "Ayurvedic ingredients in the formula", "context": "Polyherbal cooked formula"},
      {"value": "3", "label": "Drops needed every morning", "context": "3-minute AM massage routine"}
    ],
    "review_count": "Thousands of verified reviews, 4.6/5 average",
    "social_proof": "The natural skincare switch women find impossible to skip. Turns toughest critics into true believers from day 1.",
    "before_state": "harsh mouth lines, lip lines from smoking, crepey skin nose-to-chin, dull uneven tone, concealer catching in creases, moisture-starved skin",
    "after_state": "softer mouth frame, plumped-up skin, even calm glow, dewy camera-ready look, close-up-ready confidence, liquid confidence",
    "timeframe": "Visible softening from first use, continued improvement with daily use",
    "surface": "bright bathroom shelf or vanity with saffron threads",
    "setting": "bright, airy morning bathroom with natural window light",
    "mood": "radiant, confident, morning-fresh, luxurious yet accessible",
    "cta": "3 drops daily is all you need!",
    "short_headline": "Ayurveda''s Brightening Secret",
    "hero_headline": "Soften the Appearance of Harsh-Looking Mouth Lines, Awaken Radiance and Even Out Skin Tone 100% Naturally",
    "educational_hook": "Saffron — the world''s most expensive spice (50,000-75,000 flowers for 16 oz) — has been celebrated in classical Ayurvedic texts for complexion enhancement. Combined with Turmeric (5,000 years of Ayurvedic use) and Lotus (flower of purity and renewal), this polyherbal cooked formula contains 17+ Ayurvedic ingredients — far beyond surface-level infusions.",
    "testimonials": [
      {
        "name": "Andrea R.",
        "headline": "Skeptic Turned Believer",
        "quote": "I started using this oil during the day 3 weeks ago... I must admit I was skeptical about the reviews but I am now a believer.",
        "pull_quote": "skeptic turned true believer",
        "flag": "🇺🇸",
        "verified": true
      },
      {
        "name": "Vanessa L.",
        "headline": "Amazing Results in 2 Weeks",
        "quote": "I''ve been using it for 2 weeks now night and morning and the results are unbelievable, I have deep upper lip lines and they have softened significantly.",
        "pull_quote": "deep lip lines softened significantly",
        "flag": "🇺🇸",
        "verified": true
      },
      {
        "name": "Charolyn M.",
        "headline": "Cheek Wrinkles Gone",
        "quote": "Absolutely delighted with this product. Skin was always dry with wrinkles on cheeks. Cheek wrinkles are a thing of the past.",
        "pull_quote": "cheek wrinkles are a thing of the past",
        "flag": "🇺🇸",
        "verified": true
      },
      {
        "name": "Annette W.",
        "headline": "Lip Lines Improved",
        "quote": "I love this beautiful oil. My skin feels so soft and I love how it smells. I have noticed my lip lines have improved since using Kesaradi Oil. Highly recommend.",
        "pull_quote": "lip lines have improved",
        "flag": "🇺🇸",
        "verified": true
      },
      {
        "name": "Louise S.",
        "headline": "Softened Smoking Lines",
        "quote": "Excellent, have lip lines from smoking many years ago and this has certainly softened them.",
        "pull_quote": "certainly softened lip lines from smoking",
        "flag": "🇺🇸",
        "verified": true
      }
    ]
  }'::jsonb
);

-- Firm-Focus Neck Mask (The Ayurveda Experience) — NEW
insert into public.products (name, brand, sub_brand, description, ingredients, claims, color_palette, prompt_modifier, compliance_rules, thumbnail_url, context)
values (
  'Firm-Focus Neck Mask',
  'The Ayurveda Experience',
  null,
  '28-Night Start to a Sculpture-Smooth Looking Neck — a leave-on, no-rinse "String-to-Silk" invisible gel mask for neck, chin, jaw, decollete and upper chest. With Phyto-Ceramides, White-Water Lily, Lotus, Bermuda Grass, Red Spiderling, Kiwi Water, and Kelp Extract. Non-sticky, ultra-lightweight, no residue. 1.76 oz (50g). $45.',
  '[
    {"name": "Plant-Ceramide Complex (Phospholipids, Sphingolipids, Pentyl Glycol)", "key": true, "description": "Invisible scaffolding — breathable cocoon that helps skin hold on to its own moisture. Preservative-free vegan plant-derived ceramide blend from seed oils and cereal brans"},
    {"name": "White-Water Lily", "key": true, "description": "Ayurveda''s symbol of youth and the throat chakra — visibly brightens and smooths neck skin"},
    {"name": "Sacred Lotus (Nelumbo Nucifera)", "key": true, "description": "Symbol of purity — visibly brightens and smooths, supports hydration"},
    {"name": "Bermuda Grass", "key": false, "description": "Lends an even tone to neck and chest skin"},
    {"name": "Red Spiderling Root", "key": false, "description": "Lends an even tone to neck and chest"},
    {"name": "Kiwi Water", "key": true, "description": "Floods the surface with vitamin-rich dewiness"},
    {"name": "Kelp Extract", "key": true, "description": "Forms an elastic veil that makes contours look freshly sculpted — instant-taut plant active"},
    {"name": "Hydrolyzed Vegetable Protein", "key": false, "description": "Forms elastic veil with Kelp for sculpted contour look — gentle hug for lax skin"},
    {"name": "Butylene Glycol (Sugarcane Molasses Extract)", "key": false, "description": "Whisper-soft renewal — lightest touch of resurfacing, coaxes away dull flakes"},
    {"name": "Xylitol (Wood Pulp Extract)", "key": false, "description": "Upcycled from Birch and Beech wood — lasting cooling and hydrating benefits"}
  ]'::jsonb,
  '[
    {"text": "97% reported visibly smoother neck skin by Week 4", "stat": "97%", "context": "Consumer testing on 110 women aged 40-65 with visibly dry, loose neck skin"},
    {"text": "90% agreed skin on upper chest appeared tight by Week 8", "stat": "90%", "context": "Consumer testing on 110 women aged 40-65"},
    {"text": "84% reported visibly firmer loose skin on neck", "stat": "84%", "context": "8-week consumer perception study, 110 women, daily PM use"},
    {"text": "92% said skin appears tighter on neck", "stat": "92%", "context": "8-week consumer perception study"},
    {"text": "98% said skin looks smoother on neck", "stat": "98%", "context": "8-week consumer perception study"},
    {"text": "98% said skin looks and feels well hydrated on neck", "stat": "98%", "context": "8-week consumer perception study"},
    {"text": "95% said skin looks smoother on upper chest", "stat": "95%", "context": "8-week consumer perception study"}
  ]'::jsonb,
  '[
    {"name": "Soft Teal", "hex": "#5F9EA0", "usage": "Primary / calming tone"},
    {"name": "Pearl White", "hex": "#F5F5F5", "usage": "Clean background"},
    {"name": "Water Lily Pink", "hex": "#E8B4B8", "usage": "Botanical accent"},
    {"name": "Deep Charcoal", "hex": "#2C2C2C", "usage": "Dark text"},
    {"name": "Gold", "hex": "#C9A85C", "usage": "Premium accent"}
  ]'::jsonb,
  'Clean, clinical-yet-botanical skincare aesthetic: soft pearl and teal backgrounds, water lily and lotus petals as props, clean studio lighting on neck/jawline close-ups, premium frosted bottle packaging, cool soothing tones (teal, pearl, water lily pink), photorealistic product hero shots with gel string-to-silk texture visible, clean modern sans-serif typography, neck/jawline/decollete focus in imagery, mature women 40-65 confidently showing neck area, before-after neck transformation angles, scientific credibility with consumer study stats.',
  ARRAY['cure', 'treat', 'anti-aging', 'remove wrinkles', 'permanent results', 'surgery alternative'],
  null,
  '{
    "primary_color":    {"name": "Soft Teal",       "hex": "#5F9EA0"},
    "accent_color":     {"name": "Water Lily Pink", "hex": "#E8B4B8"},
    "contrast_color":   {"name": "Pearl White",     "hex": "#F5F5F5"},
    "dark_color":       {"name": "Deep Charcoal",   "hex": "#2C2C2C"},
    "tint_color":       {"name": "Water Lily Pink", "hex": "#E8B4B8"},
    "background_color": {"name": "Pearl White",     "hex": "#F5F5F5"},
    "tagline": "28-Night Start to a Sculpture-Smooth Looking Neck",
    "product_description": "Frosted bottle of invisible leave-on gel neck mask. String-to-silk texture — gel strings between fingertips but melts into skin. 1.76 oz (50g). Non-sticky, ultra-lightweight, no residue. 7 bio-actives + 4 Ayurvedic herbs. Over 90% naturally derived ingredients.",
    "product_category": "Leave-On Neck Firming Gel Mask",
    "price": "$45",
    "website": "theayurvedaexperience.com",
    "target_audience": "Women 30–65+, concerned about tech-neck, necklace lines, saggy/crepey neck skin, undefined jawline, aging decollete/upper chest, wanting to wear pixie cuts or updos confidently",
    "benefits": [
      "Necklace lines look flattened",
      "Micro-folds appear blurred",
      "Jawlines look newly defined",
      "No surgery, no needles — just an invisible gel overnight mask",
      "String-to-silk sensory experience",
      "Breathable satin finish — invisible armor while you sleep",
      "Works on neck, chin, jaw, decollete, upper chest"
    ],
    "stats": [
      {"value": "97%", "label": "Reported visibly smoother neck skin", "context": "Consumer testing, 110 women aged 40-65, Week 4"},
      {"value": "92%", "label": "Skin appears tighter on neck", "context": "8-week consumer perception study, 110 women"},
      {"value": "90%", "label": "Upper chest appeared tight", "context": "Consumer testing, 110 women aged 40-65, Week 8"},
      {"value": "98%", "label": "Skin looks smoother on neck", "context": "8-week consumer perception study"},
      {"value": "84%", "label": "Visibly firmer loose skin on neck", "context": "8-week study, daily PM use"},
      {"value": "98%", "label": "Skin looks and feels well hydrated", "context": "8-week consumer perception study"}
    ],
    "review_count": "Verified reviews — frequently sells out",
    "social_proof": "8-week consumer perception study with 110 women aged 40-65 with visibly dry, loose neck skin. Keeps selling out — waiting lists for restock.",
    "before_state": "tech-neck, horizontal necklace lines, crepey neck skin, undefined jawline, saggy chin and upper chest, hiding neck under scarves and turtlenecks",
    "after_state": "sculpture-smooth neck, flattened necklace lines, blurred micro-folds, defined jawline, firm upper chest, confidently wearing updos and pixie cuts",
    "timeframe": "28 nights for visible transformation, Week 4 for smoother skin, Week 8 for tight upper chest",
    "surface": "clean white vanity or bathroom shelf",
    "setting": "serene evening bathroom, soft warm lighting, nighttime ritual",
    "mood": "serene, sculpted, confident, clinical yet luxurious",
    "cta": "Begin Here to Give Your Neckline a New Lifeline",
    "short_headline": "String-to-Silk Neck Firming Mask",
    "hero_headline": "28-Night Start to a Sculpture-Smooth Looking Neck",
    "educational_hook": "Neck skin is up to 65% thinner than facial skin and bends over 50 times a day. Fewer oil glands mean built-in dehydration. Tech-neck from scrolling stamps in horizontal lines. Menopause can drain collagen by 30% in five years. Firm-Focus Neck Mask is the first leave-on gel that combines a string-to-silk sensory cue with clinically observed results.",
    "testimonials": [
      {
        "name": "Giovanna F.",
        "age": 69,
        "headline": "Excellent Results!",
        "quote": "Unbelievable results, great product, waiting for restock, all my friends are patiently waiting after seeing my results.",
        "pull_quote": "all my friends are waiting after seeing my results",
        "flag": "🇦🇺",
        "verified": true
      },
      {
        "name": "Ann S.",
        "headline": "Beautiful!",
        "quote": "It is appropriately described as it really does create a veil over the neck that seems to camouflage wrinkles and lines.",
        "pull_quote": "creates a veil that camouflages wrinkles",
        "flag": "🇦🇺",
        "verified": true
      },
      {
        "name": "Debra F.",
        "headline": "Out of Stock?",
        "quote": "There''s a reason this product keeps selling out… it works!! I was so very sad that I didn''t order two.",
        "pull_quote": "keeps selling out because it works",
        "flag": "🇺🇸",
        "verified": true
      }
    ]
  }'::jsonb
);


-- ═══════════════════════════════════════════════════════
-- PROMPT TEMPLATES — All 40
-- ═══════════════════════════════════════════════════════

insert into public.prompt_templates (number, name, category, template, default_aspect_ratio) values

(1, 'Headline', 'Hero/Product',
'Use the attached images as brand reference. Match the exact product colors, typography style, and brand tone precisely. Create: a static ad with a [BACKGROUND] background. Top third: large bold sans-serif headline reading "[YOUR HEADLINE, under 10 words]". Below in smaller text: "[YOUR SUBHEAD, one sentence]". Bottom half: [YOUR PRODUCT] on the surface with [DETAILS]. Shot at 50mm f/2.8 from slightly above. [BRAND] logo bottom right. Clean, authoritative. 4:5 aspect ratio.',
'4:5'),

(2, 'Offer/Promotion', 'Offer/Promotion',
'Use the attached images as brand reference. Match exact brand colors and typography style. Create: a promotional ad with a split background. Top 60% is [PRIMARY BRAND COLOR] and bottom 40% is [CONTRAST COLOR like warm cream]. [YOUR PRODUCT] sits centered where colors meet, soft studio lighting. Upper area: large [CONTRAST TEXT] sans-serif reading "[YOUR OFFER like YOUR FIRST MONTH FREE]". Below: "[OFFER DETAILS]". Lower section: small [BRAND COLOR] text with [VALUE ADDS]. [BRAND] logo bottom right. 9:16 aspect ratio.',
'9:16'),

(3, 'Testimonials', 'Social Proof',
'Use the attached images as brand reference. Create: a testimonial ad set in [SETTING like bright bathroom / kitchen] with warm natural light. [YOUR PRODUCT] on [SURFACE], slightly out of focus. Overlaid: large bold white sans-serif "[SHORT HEADLINE]". Below: "[FULL QUOTE 2-3 sentences]. [NAME], [CREDENTIAL]." Five filled [BRAND COLOR] stars. [BRAND] logo bottom right in white. Shot on 35mm f/2.0. 9:16 aspect ratio.',
'9:16'),

(4, 'Features/Benefits Point-Out', 'Educational',
'Use the attached images as brand reference. Create: an educational diagram-style ad on white background. Top: bold [BRAND COLOR] text "[HEADER like What Makes [PRODUCT] Different]". Below: [YOUR PRODUCT] centered, even studio lighting. Four callout boxes with connecting lines: "[BENEFIT 1-4]". Each has a small [BRAND COLOR] circle. "[WEBSITE]" bottom center. [BRAND] logo bottom right. Scientific diagram redesigned by a luxury agency. 4:5 aspect ratio.',
'4:5'),

(5, 'Bullet-Points', 'Educational',
'Use the attached images as brand reference. Create: a benefit-list ad, split composition on [BACKGROUND] background. Left 40%: [YOUR PRODUCT] on [SURFACE], shot at 85mm f/2.8. Right 60%: vertical stack of five lines with filled [BRAND COLOR] circles: "[BENEFIT 1-5]". Clean sans-serif, generous spacing. [BRAND] logo bottom right. 4:5 aspect ratio.',
'4:5'),

(6, 'Social Proof', 'Social Proof',
'Use the attached images as brand reference. Create: a social proof ad on [BACKGROUND like warm cream]. Top: "[HEADLINE like Join 1,000,000+ Members]" in bold [BRAND COLOR]. Five filled stars with "Rated [X] out of 5". Center: [YOUR PRODUCT] at 50mm f/4. Below: frosted white card with five-star rating, "[REVIEW TITLE]", "[2-3 SENTENCE REVIEW]", "[ATTRIBUTION]" in italic. Below card: "As Featured In" with five grayscale logos. [BRAND] logo bottom right. 4:5 aspect ratio.',
'4:5'),

(7, 'Us vs Them', 'Comparison',
'Use the attached images as brand reference. Create: a side-by-side divided vertically. Left: muted gray-blue background. Right: [PRIMARY BRAND COLOR]. Center top: white circle with "VS". Left header: "[COMPETITOR CATEGORY]" + generic competitor product + list with X marks: "[WEAKNESS 1-5]". Right header: "[YOUR BRAND]" + [YOUR PRODUCT] + list with checkmarks: "[STRENGTH 1-5]". [BRAND] logo bottom right. 4:5 aspect ratio.',
'4:5'),

(8, 'Before & After (UGC Native)', 'UGC',
'Use the attached images as brand reference for product color ONLY. This should look like a real person''s post. Create: TikTok before-and-after. LEFT: grainy iPhone mirror selfie, [PERSON] in dimly lit bathroom, [BEFORE STATE], harsh lighting. White handwritten text: "[BEFORE DATE]". RIGHT: same person, same bathroom, bright natural light, [AFTER STATE], [PRODUCT] visible on counter. White text: "[AFTER DATE]". Top center: "[TIMEFRAME] on [BRAND]" with emoji. Should look stitched in CapCut. 9:16 aspect ratio.',
'9:16'),

(9, 'Negative Marketing (Bait & Switch)', 'Social Proof',
'Use the attached images as brand reference. Create: Background is close-up of [PRODUCT], slightly blurred. Center: white rounded-rectangle review card (Amazon-style). Gray user icon, "[NAME]", one gold star + four gray, orange "Verified Purchase" badge, bold text: "[BAIT that sounds negative but is positive]". Bottom: bold white sans-serif "[PUNCHLINE like THE REVIEWS ARE IN.]". [BRAND] logo bottom right. 4:5 aspect ratio.',
'4:5'),

(10, 'Press/Editorial', 'Press/Authority',
'Use the attached images as brand reference. Create: a press ad on off-white linen background. Top: "As Featured In" in small [BRAND COLOR] uppercase wide-tracked text. Below: five grayscale publication logos. Center: italic serif pull-quote in [BRAND COLOR]: "[PRESS QUOTE]" with attribution. Lower third: [PRODUCT] at 85mm f/2.8, soft side light. [BRAND] logo bottom left. Generous white space. Full-page Vogue energy. 4:5 aspect ratio.',
'4:5'),

(11, 'Pull-Quote Review Card', 'Social Proof',
'Use the attached images as brand reference. Match the exact product colors and brand tone precisely. Create: a review-driven ad with a solid [BRAND COLOR with hex — a soft, muted tone works best] color block background filling the entire image. Top half: large bold italic serif text in white with curly quotation marks reading "[PULL-QUOTE — the most emotional 4-8 word phrase from the review, e.g., "I finally found something that works!"]". Directly below the quote: five large filled gold/yellow star icons in a horizontal row. Bottom left, overlapping the color background: a white rounded-corner review card with subtle shadow, containing: a small gray circular default avatar icon, beside it "[FIRST NAME + LAST INITIAL]" in bold dark sans-serif with a small [FLAG EMOJI matching target market — e.g., 🇺🇸], below the name a blue checkmark icon with "[VERIFIED REVIEWER / VERIFIED BUYER]" in small blue text. Below the reviewer info: the review body text in medium-weight dark sans-serif, 4-6 lines of authentic-sounding customer voice that trails off mid-sentence, ending with "...Read more" in bold [BRAND COLOR] text — the truncation is intentional to create curiosity. Below the review text: "Was this review helpful?" in small gray text with a thumbs-up icon and "[HELPFULNESS COUNT — e.g., 150 / 2.4K]" beside it. Bottom right, overlapping both the card and the color background: [YOUR PRODUCT — full packaging description] angled slightly toward the viewer, sitting on the color block surface with a subtle shadow beneath. No brand logo needed if the product packaging already shows it — the review card IS the social proof. 1:1 or 4:5 aspect ratio.',
'4:5'),

(12, 'Lifestyle Action + Product Colorway Array', 'Lifestyle',
'Use the attached images as brand reference. Match the exact product design, colors, and visual tone precisely. Create: a static ad with a [LIFESTYLE PHOTO DESCRIPTION like man mid-golf-swing in tropical patterned polo and khaki pants] occupying the left two-thirds of the frame, shot outdoors in [SETTING like golf course with palm trees], bright natural daylight. [BRAND] logo top center in bold. Below logo: large bold sans-serif quote text reading "[ENDORSEMENT HEADLINE like THE GREATEST PANTS IN GOLF]" in [TEXT COLOR like white or black]. Bottom right foreground: three [PRODUCT VARIANTS like folded pairs of shorts/pants] fanned in an overlapping arrangement showing [COLOR 1], [COLOR 2], and [COLOR 3]. Products are crisp and studio-lit against the lifestyle background. Shot on 50mm f/2.0, lifestyle background slightly softer than foreground product. [MOOD like confident, athletic, aspirational but accessible]. 1:1 aspect ratio.',
'1:1'),

(13, 'Stat Surround / Callout Radial (Product Hero)', 'Educational',
'Use the attached images as brand reference. Match the exact product design, colors, and typography style precisely. Create: a static ad on a white-to-[LIGHT GRADIENT COLOR like warm golden beige] gradient background, gradient fading from top to bottom. Top: large bold [TEXT COLOR like dark brown] sans-serif headline reading "[HEADLINE like So tasty you''ll forget it''s actually healthy.]" Center: [YOUR PRODUCT like single stand-up pouch] on white background, soft studio lighting. Floating near the product: a small circular badge reading "[PRICE POINT like AS LOW AS $2.63 PER MEAL!]" in [BADGE COLOR]. Flanking the product on both sides: four stat callouts with curved arrows pointing toward the product. Left side top: "[STAT 1 like 20g]" in oversized bold text with "[LABEL like PROTEIN]" below. Left side bottom: "[STAT 2 like 280]" with "[LABEL like CALORIES]". Right side top: "[STAT 3 like 900k+]" with "[LABEL like HAPPY CUSTOMERS]". Right side bottom: "[STAT 4 like 30k+]" with "[LABEL like 5-STAR REVIEWS]" and five filled gold stars beneath. Arrows are simple hand-drawn-style curved lines in [ARROW COLOR like black]. Bottom foreground: [FLAVOR PROPS like scattered chocolate chip cookie dough balls and chocolate chips] adding appetite appeal. No brand logo. Clean, informational, appetizing. 1:1 aspect ratio.',
'1:1'),

(14, 'Bundle Showcase + Benefit Bar', 'Educational',
'Use the attached images as brand reference. Match the exact product design, colors, and typography style precisely. Create: a static ad on a [BACKGROUND like soft pink-to-hot-pink gradient] background. Top: oversized bold white all-caps sans-serif headline reading "[HEADLINE like 24/7 PEAK FEMALE PERFORMANCE]". Below headline: a horizontal [ACCENT COLOR like purple/violet] banner bar divided into [NUMBER like five] equal segments separated by thin vertical lines, each containing a two-word benefit label in white text: "[BENEFIT 1 like Morning Energy]", "[BENEFIT 2 like Focus Amplifier]", "[BENEFIT 3 like Deep Sleep]", "[BENEFIT 4 like Ultimate Beauty]", "[BENEFIT 5 like Metabolism Booster]". Center-to-bottom: an open [PACKAGING like branded gift box] photographed at a slight overhead angle showing [NUMBER like three] [PRODUCTS like supplement jars] nestled inside, each a different [COLOR-CODED VARIANT]. In the lower foreground: a [LIFESTYLE PROP like woman''s hand holding a pastel dumbbell] entering the frame from bottom. [BRAND] logo bottom left corner. Bright studio lighting, saturated color, energetic and empowering. 1:1 aspect ratio.',
'1:1'),

(15, 'Social Comment Screenshot + Product', 'Social Proof',
'Use the attached images as brand reference. Match the exact product design and colors precisely. Create: a static ad on a clean white background. Top: oversized bold black sans-serif headline reading "[HOOK HEADLINE like IF YOU''RE GOING THROUGH PERI..]" with [EMOJI like 😅] at the end. Center: a social media comment card with light gray rounded-rectangle background containing: a small circular profile avatar (top left), bold name "[REVIEWER NAME like Elaine McLean]", and a multi-sentence review in regular-weight sans-serif: "[FULL REVIEW TEXT, 3-4 sentences, conversational and emotional]". Small gray timestamp "[TIMESTAMP like 2d]" below the comment. Bottom center: [YOUR PRODUCT like product box and bar/bottle] photographed at a slight angle on white, soft studio lighting. No brand logo. No stars. The rawness is the point — this should look like someone screenshotted a real comment and dropped the product photo below it. 1:1 aspect ratio.',
'1:1'),

(16, 'Curiosity Gap / Hook Quote Testimonial', 'Social Proof',
'Use the attached images as brand reference. Match the exact product design, colors, and typography style precisely. Create: a static ad on a clean white background. Top center: large [ACCENT COLOR like periwinkle blue] opening quotation marks. Below: mixed-weight headline in black — the first line in italic serif or semi-bold reading "[SETUP LINE like I''ve been]", the next two lines in enormous heavy-weight bold all-caps sans-serif reading "[BAIT PHRASE like FAKING IT / WITH MY HUSBAND]", followed by a smaller sentence-case line reading "[REVEAL like since perimenopause — with [BRAND] I don''t have to]". Closing quotation marks and "[ATTRIBUTION like - Erin D.]" in regular weight. Left side bottom third: [YOUR PRODUCT like supplement bottle] at a slight angle with [PRODUCT DETAILS like capsules scattered nearby]. To the left of the product: a [TRUST BADGE like circular seal reading "Happiness 60 DAY Guaranteed"]. Right side bottom third: [NUMBER like five] filled [ACCENT COLOR] stars and bold text reading "[REVIEW COUNT like 3,600+] 5-Star Reviews" with a [BRAND ICON]. Bottom edge: small disclaimer text "[DISCLAIMER like Results may vary based on individual. No results guaranteed.]" 1:1 aspect ratio.',
'1:1'),

(17, 'Verified Review Card', 'Social Proof',
'Use the attached images as brand reference. Match the exact product design, colors, and typography style precisely. Create: a static ad on a solid [BRAND COLOR like periwinkle/lavender blue] background. Top: large bold white serif or semi-bold sans-serif pull-quote reading "[HEADLINE QUOTE like "I finally found something that works!"]" in quotation marks. Below the quote: five filled gold stars, large. Center-left: a white rounded-rectangle review card with subtle shadow containing: gray circular avatar icon, bold name "[REVIEWER NAME like Dawn K.]" with [FLAG EMOJI like 🇺🇸], blue checkmark and "[VERIFIED BADGE TEXT like Verified Reviewer]" in [BRAND COLOR] text, then 3-4 sentences of review body text in regular weight dark text. At the bottom of the card: a blue "[READ MORE like ...Read more]" link and "[HELPFULNESS like Was this review helpful? 👍 150]". Right side, overlapping the card edge: [YOUR PRODUCT like cream jar with lid] photographed at a slight angle, soft studio lighting, casting a gentle shadow on the background. No brand logo. The review UI is the trust mechanic. 1:1 aspect ratio.',
'1:1'),

(18, 'Stat Surround / Callout Radial (Lifestyle Flatlay)', 'Educational',
'Use the attached images as brand reference. Match the exact product design, colors, and typography style precisely. Create: a static ad on a white background with a lifestyle flatlay arrangement. Top: bold [ACCENT COLOR like purple] filled banner bar spanning full width, white all-caps sans-serif reading "[HEADLINE like INCREDIBLY TASTY BREAKFAST IN 30 SECONDS]". Center: a [PERSON DETAIL like woman''s hand] holding [YOUR PRODUCT like branded shaker cup] in mid-frame. Scattered around the edges: [FLATLAY PROPS like product sachets, pancakes on plates, blueberries, muffins, fruit] arranged organically to fill corners and edges, slightly out of focus. Four stat callouts with curved [ACCENT COLOR] arrows pointing toward the held product: "[STAT 1 like 20g] / [LABEL like PROTEIN]", "[STAT 2 like 900K] / [LABEL like HAPPY CUSTOMERS]", "[STAT 3 like 20+] / [LABEL like FLAVORS]", "[STAT 4 like 30K] / [LABEL like 5 STAR REVIEWS]" with five small gold stars. Stats in bold black, labels in all-caps regular weight. Bright, flat studio lighting. Energetic, appetizing, information-dense but scannable. 1:1 aspect ratio.',
'1:1'),

(19, 'Highlighted / Annotated Testimonial', 'Social Proof',
'Use the attached images as brand reference. Match the exact product design, colors, and typography style precisely. Create: a static ad on a clean white background. Top left: circular customer headshot photo of [PERSON DESCRIPTION like smiling woman, mid-60s, silver wavy hair, wearing blue top]. To the right of the photo: bold name "[REVIEWER NAME like Veronica B.]" with a [VERIFIED ICON like blue checkmark]. Below: a long-form customer quote in large regular-weight black sans-serif type spanning most of the frame: "[FULL QUOTE, 3-5 sentences]". Key phrases within the quote are highlighted with [HIGHLIGHT COLOR like bright lime green / neon yellow] rectangular background fills behind the text: "[HIGHLIGHTED PHRASE 1 like thyroid removed]", "[HIGHLIGHTED PHRASE 2 like This is the best product I have found.]" Bottom right: [YOUR PRODUCT like supplement jar] at a slight angle, partially cropped at the bottom edge. To the left of the product: a circular [TRUST BADGE like "100% MONEY BACK / 90 DAYS / 100% GUARANTEE"] seal in [BADGE COLOR like lime green with dark text]. [BRAND] logo bottom left corner, small. 1:1 aspect ratio.',
'1:1'),

(20, 'Advertorial / Editorial Content Card', 'Native/Editorial',
'Use the attached images as brand reference for tone ONLY. Do NOT use polished ad layouts. This should look like organic editorial content. Create: a full-bleed moody portrait photo of [PERSON DESCRIPTION like young man in dark textured sweater holding an electric guitar], warm amber-toned lighting, shot on 50mm f/1.8, shallow depth of field, cinematic color grade with warm highlights and cool shadows. Lower 45% of the frame is a text overlay zone: a prominent white rounded-rectangle pill label reading "[CATEGORY TAG like HOT TOPIC]" in centered uppercase sans-serif, sized to span roughly one-third of the frame width. Below: very large, dominant, bold all-caps condensed sans-serif headline filling the width of the frame in white text with key words in [HIGHLIGHT COLOR]: "[HEADLINE like [BRAND] IS BLOWING UP ON TIKTOK — HERE''S WHY EVERYONE''S USING IT TO [ACTION]]". The headline should be oversized — at least 35% of the total frame height. Bottom center: "[@HANDLE like @waveform.watch]" in small white text. No product shot, no CTA button, no stars. This should read like a music blog or culture account post, not a paid ad. 4:5 aspect ratio.',
'4:5'),

(21, 'Bold Statement / Reaction Headline', 'Hero/Product',
'Use the attached images as brand reference. Match the exact product design, colors, and visual tone precisely. Create: a static ad on a vibrant [GRADIENT like coral-pink to golden-yellow] gradient background, flowing diagonally from upper left to lower right. Upper left: oversized playful [FONT STYLE like rounded retro serif / Cooper Black style] white headline reading "[BOLD STATEMENT like This popcorn is so f*****g delicious.]" — text should feel loose, fun, and expressive, not rigid or corporate. Right side: [PERSON DETAIL like a hand reaching down from upper right] grabbing from [YOUR PRODUCT like the signature bright yellow popper bowl overflowing with fluffy popcorn]. Product sits center-right, slightly below midline. Bottom left: [BRAND] logo in [LOGO COLOR like black] with "[PRODUCT DESCRIPTOR like Flavor Wrapped Popcorn Kernels]" in smaller text below. No stats, no reviews, no badges. The gradient and the headline do all the work. 1:1 aspect ratio.',
'1:1'),

(22, 'Flavor Story / "Tastes Like"', 'Hero/Product',
'Use the attached images as brand reference. Match the exact product design, colors, and packaging precisely. Create: a flavor-visualization ad. Full background is a photorealistic close-up food scene of [INDULGENT FOOD like freshly baked raspberry donuts dusted with powdered sugar on a gray stone surface]. Shot at 50mm f/2.8, shallow depth of field, warm bakery lighting. Top third: large bold white sans-serif headline reading "[HEADLINE like A protein bar that tastes like freshly baked raspberry donuts]" with one key word in bold italic for emphasis. [YOUR PRODUCT] packaged unit placed bottom-right, angled 15° as if casually laid into the scene. Bottom: semi-transparent white bar spanning full width with three stat columns separated by thin vertical lines: "[STAT 1 like 15g PROTEIN]" | "[STAT 2 like 2g SUGAR]" | "[STAT 3 like 180 CALORIES]". Very bottom edge: smaller bold sans-serif "[CLEAN LABEL CLAIM like NO ARTIFICIAL SWEETENERS]". Food is the hero — product is the payoff. 1:1 aspect ratio.',
'1:1'),

(23, 'Long-Form Manifesto / Letter Ad', 'Native/Editorial',
'Use the attached images as brand reference. Match exact brand typography style and tone. Create: a copy-dominant manifesto ad on a clean white background. No background imagery — text is the entire creative. Top: oversized bold black serif or sans-serif headline reading "[PROVOCATIVE HEADLINE like They''re not cheap.]" spanning the top 15%. Below: left-aligned body copy in smaller regular-weight black text, structured as short punchy sentences and line breaks (NOT paragraphs), building a persuasive argument about [CORE BRAND TENSION like why the price is justified]. The copy should flow through: acknowledging the objection, listing what you''d lose if they cut corners, reframing as a positive, closing with a confident brand statement. Approximately [12-18 LINES] of copy. Bottom 20%: [YOUR PRODUCT] centered or slightly right, product-only on white, clean studio shot angle. No icons, no badges, no CTA button. The writing IS the ad. 1:1 aspect ratio.',
'1:1'),

(24, 'Product + Comment Callout (Faux Social Proof)', 'Social Proof',
'Use the attached images as brand reference. Match the exact product design and packaging precisely. Create: a social proof ad. Top 55%: [YOUR PRODUCT] centered on a clean white background, studio-lit, shot at 85mm f/2.8 with soft shadow. Product cap/lid slightly open or [DETAIL showing use]. A few [LOOSE UNITS like gummies / capsules] spilling casually at the base. Bottom 45%: a realistic Facebook-style comment card. Left: small circular profile photo of [PERSON DESCRIPTION like a man in his 30s, friendly smile, casual]. Bold name "[FIRST NAME + LAST INITIAL like Alan R.]" above the comment. Comment text in regular weight: "[TESTIMONIAL 2-3 sentences touching on a specific problem and the product being a game-changer]". Below comment: "[TIMEFRAME like 4w]" · Like · Reply in gray. Bottom right of comment: Facebook-style reaction emojis (thumbs up + heart) with "[COUNT like 33]". Should look like an organic screenshot, not designed. 1:1 aspect ratio.',
'1:1'),

(25, 'Us vs. Them Color Split', 'Comparison',
'Use the attached images as brand reference. Match the exact product design and colors precisely. Create: a side-by-side comparison ad divided vertically into two equal halves. Left half: [PRIMARY BRAND COLOR like vibrant teal] background. [YOUR PRODUCT] photographed with dynamic energy — [ACTION DETAIL like chocolate dripping / liquid pouring] to convey indulgence. Brand logo in bold white upper-left. Below product: vertical stack of 4 benefits, each with a green circle checkmark emoji: "[STRENGTH 1-4 like ≤2G SUGAR / ALL NATURAL INGREDIENTS / ≥6G FIBRE / 12G PROTEIN]" in bold white uppercase. Right half: [CONTRAST COLOR like pale cream/beige] background. Generic unbranded competitor product [DESCRIPTION like crumpled foil-wrapped chocolate bar]. Header: "[COMPETITOR CATEGORY like Other chocolate bars]" in dark text. Below: vertical stack of 4 weaknesses, each with a red circle X emoji: "[WEAKNESS 1-4 like 29G SUGAR / FULL OF FRUCTOSE CORN SYRUP / 1G FIBRE / 2G PROTEIN]" in bold dark uppercase. Center divider: a comic-style "VS" burst graphic in [ACCENT COLOR like coral/red]. 1:1 aspect ratio.',
'1:1'),

(26, 'Stat Callout (Data-Driven Lifestyle)', 'Educational',
'Use the attached images as brand reference. Match exact brand colors and typography. Create: a statistic-led ad. Top 50%: lifestyle product photography — [SCENE like a woman''s hands holding the product pad / person using the product in context] on a [MOOD like warm, skin-toned, soft-focus] background. Product packaging visible in frame. Middle: brand logo centered with thin horizontal rules on either side as a visual divider. Bottom 50%: dark gradient overlay (fading from transparent to [DARK COLOR like deep brown/black]). Large bold uppercase sans-serif text: "[STAT-DRIVEN HEADLINE with specific percentages like AFTER SWITCHING TO [BRAND], [X]% OF USERS [RESULT], WHILE [Y]% [SECOND RESULT]]." Key result phrases highlighted in [ACCENT COLOR like soft pink / brand secondary color]. The statistic IS the headline — no separate subhead needed. 4:5 aspect ratio.',
'4:5'),

(27, 'Benefit Checklist Showcase (Split Product + Info)', 'Educational',
'Use the attached images as brand reference. Match the exact product design and brand colors precisely. Create: an information-dense benefit ad, split composition. Left 45%: overhead product shot — [PRODUCT DISPLAY DESCRIPTION like a white bowl filled with fresh dog food divided into labeled sections by thin white lines, each section labeled in curved white text: "[VARIETY 1-4 like CHICKEN & YAMS / BEEF N'' RICE / SALMON N'' RICE / TURKEY & YAMS]"]. Shot on 50mm f/4, clean white surface. Right 55%: white background. Top: [STAR RATING like five gold stars] with "[REVIEW COUNT like 10,000+ REVIEWS]" in [BRAND COLOR]. Brand logo. Below: [BRAND COLOR] serif or sans-serif headline: "[HEADLINE like Made for the pickiest dogs]". Then 3 checkmark benefit rows, each with a filled [BRAND COLOR] circle checkmark + bold text: "[BENEFIT 1-3 like Head turning aroma / No additives, flavors, or preservatives / Ready to serve from the pouch]". Bottom right: large rounded [ACCENT COLOR] CTA button reading "[CTA like SHOP NOW]". 1:1 aspect ratio.',
'1:1'),

(28, 'Feature Arrow Callout / Product Annotation', 'Educational',
'Use the attached images as brand reference. Match exact brand colors and typography style. Create: a product annotation ad on a [BACKGROUND like warm cream/light yellow textured] background. Top: italic serif headline "[BENEFIT STATEMENT like Barista grade coffee. Instant. Affordable.]" in [BRAND COLOR like dark navy]. Below in massive bold sans-serif: "[VALUE PROP like ALL IN ONE]". Center: [PERSON''S HAND] holding [YOUR PRODUCT] at a natural angle. Four curved arrows in [BRAND COLOR] pointing from the product outward to four benefit callout labels arranged around it in bold [BRAND COLOR] text: "[CALLOUT 1-4 like NO sugar or calories / Multiple Flavors / Iced, cold or hot / Smooth and delicious]". Arrows should feel hand-drawn or editorial, not rigid. Bottom: full-width [CONTRAST COLOR like deep navy] banner with [PROMO TEXT like HUGE SALE + FREE GIFTS] in bold [ACCENT COLOR like gold/white] with optional emoji accents. 1:1 aspect ratio.',
'1:1'),

(29, 'UGC + Viral Post Overlay', 'UGC',
'Use the attached images as brand reference for product color ONLY. Do NOT use ad layouts or polish. This should look completely native and organic. Create: a casual selfie of [PERSON like a man in mid-20s, beanie, crewneck sweatshirt] doing something mundane [ACTION like brushing teeth, making coffee, cooking]. iPhone front camera, slightly grainy, bathroom/kitchen lighting, no professional setup. Overlaid in the center of the frame: a realistic screenshot of a [PLATFORM like Reddit / Twitter / X] post. [POST DETAILS like subreddit name, username, timestamp, upvote count]. Post title in bold: "[PROVOCATIVE OPINION HEADLINE related to the product''s problem/benefit space]". Post body in regular text: "[2-3 sentences expanding on the opinion]". The post should feel like the person is reacting to it or sharing it — NOT selling a product. No product visible. No brand logo. No CTA. The hook is the opinion. 9:16 aspect ratio.',
'9:16'),

(30, 'Hero Statement + Icon Benefit Bar', 'Hero/Product',
'Use the attached images as brand reference. Match exact brand colors, packaging, and typography. Create: a bold statement ad. Top 15%: white banner overlay with massive bold [BRAND COLOR like dark purple] uppercase sans-serif headline: "[2-3 WORD POWER STATEMENT like APPETITE KILLER.]" with a period for punch. Middle 55%: lifestyle product photo — [SCENE like woman''s hand holding a capsule above an open supplement jar on a clean surface, soft natural light]. Product label and branding clearly visible. Bottom 25%: [SOFT BRAND COLOR like lavender/light purple] background. Three evenly spaced icon-and-text benefit columns: [ICON 1 + LABEL like (crossed-out burger icon) CURB APPETITE] | [ICON 2 + LABEL like (lightning bolt icon) BURN CALORIES] | [ICON 3 + LABEL like (heart + body icon) LOSE WEIGHT]. Icons are simple line-drawn in [BRAND COLOR] circles. Very bottom edge: scrolling ticker bar in [DARK BRAND COLOR] with repeating text: "[SOCIAL PROOF like OVER 300K+ LIVES CHANGED]". 1:1 aspect ratio.',
'1:1'),

(31, 'Comparison Grid / Table', 'Comparison',
'Use the attached images as brand reference. Match the exact product packaging precisely. Create: a structured comparison grid ad on white background. Top row divided 50/50: Left: [YOUR PRODUCT] packaging photographed clean on white with [DETAIL like chips spilling out]. Right: [COMPETITOR PRODUCT] packaging on white. Below: three horizontal rows spanning full width, each divided 50/50 by a thin black vertical line and separated by thin black horizontal lines. Each row compares one attribute: Row 1: "[YOUR ADVANTAGE like Uses beef tallow.]" vs "[COMPETITOR WEAKNESS like Uses seed oils.]". Row 2: "[YOUR ADVANTAGE like Organic corn.]" vs "[COMPETITOR WEAKNESS like Pesticide corn.]". Row 3: "[YOUR ADVANTAGE like Tastes amazing.]" vs "[COMPETITOR WEAKNESS like Doesn''t even taste good.]" All text in bold black serif or heavy sans-serif, centered in each cell. No icons, no colors, no checkmarks — the copy contrast does the work. Should feel like a meme-format comparison that would go viral on X or Reddit. 1:1 aspect ratio.',
'1:1'),

(32, 'UGC Story Callout / Text Bubble Explainer', 'UGC',
'Use the attached images as brand reference for product color and packaging ONLY. Do NOT use ad layouts or polish. This must look like a real person''s Instagram Story. Create: a casual iPhone photo of [PERSON DESCRIPTION like a woman''s hand with clean natural nails] holding [YOUR PRODUCT with key packaging details] at a slight angle over [SURFACE/SETTING like a clean white desk with lifestyle props]. Natural overhead daylight, slightly warm, iPhone 15 quality. Scattered across the frame: 5 text bubbles using Instagram Story''s built-in highlighted text tool. Each bubble must have a highlighted background for readability, with varied highlight colors between bubbles. Bubble 1: "[TOPIC + EMOJI like gut health 🌱]" large and bold. Bubble 2: "[EDUCATIONAL HOOK — a surprising stat or mechanism about why this category matters]". Bubble 3: "[WHY THIS PRODUCT — the specific feature that makes it different, excited informal tone]". Bubble 4: "[PERSONAL RESULT — early experience update, first-person, with emoji]". Bubble 5: "[BRAND ENDORSEMENT — one short line of approval]". Should feel casual and hand-placed, not designed. 9:16 aspect ratio.',
'9:16'),

(33, 'Faux Press / News Article Screenshot', 'Native/Editorial',
'Use the attached images as brand reference. Create: a static ad designed to look like a real online news article screenshot. Top 25%: white background with a realistic major publication masthead/logo in large bold black serif text [PUBLICATION STYLE like "Daily Mail" or "TODAY" or "INSIDER"]. Below: thin gray horizontal rule. Small gray text "Latest Headlines" left-aligned. Then: bold black serif headline spanning full width: "[HEADLINE like ''It''s my holy grail product'': The $[PRICE] [PRODUCT CATEGORY] with over [NUMBER] five-star reviews]". Bottom 60%: two side-by-side casual UGC-style photos of [PEOPLE like two different young women, one brunette, one blonde] each holding [YOUR PRODUCT] in a casual selfie pose — one taken in natural daylight, one in warm indoor evening light. Photos should look like real customer submissions, not studio shots. No brand logo. No CTA. Should look like an organic article screenshot someone would share to their story. 4:5 aspect ratio.',
'4:5'),

(34, 'Faux iPhone Notes / App Screenshot', 'Native/Editorial',
'Use the attached images as brand reference. Match the exact product design and packaging precisely. Create: a static ad disguised as an iPhone Notes app screenshot. Top: realistic iOS status bar (time "[TIME like 10:45]", signal bars, wifi icon, battery icon). Below: iOS Notes navigation — blue "< All iCloud" back arrow left, share icon and three-dot menu icon right. Below nav: small gray timestamp text "[DATE like 13 July 2023 10:44]". Main content area on white background: bold black serif headline "[HEADLINE like In Just [DOSAGE] A Day]". Below: [3 BENEFIT ROWS], each with a [BRAND COLOR] filled circle checkmark + [EMOJI] + bold black text using food-equivalency format: "[BENEFIT 1 like More Vitamin D than 800 mushrooms]" / "[BENEFIT 2 like More Folate than 4 cups of spinach]" / "[BENEFIT 3 like More Vitamin B1 than 7 cups of broccoli]". Right side, overlapping the benefit text slightly: [YOUR PRODUCT] at a slight angle with [DETAILS like a few gummies/capsules spilling out at the base]. Product should feel casually placed into the note layout, breaking the frame slightly. Clean white background throughout. 1:1 aspect ratio.',
'1:1'),

(35, 'Hero Product Showcase + Stat Bar', 'Hero/Product',
'Use the attached images as brand reference. Match the exact product design, wrapper, and brand colors precisely. Create: a product showcase ad on a [BACKGROUND COLOR like warm sand/beige/cream] background. Top: large bold [BRAND COLOR like chocolate brown] uppercase sans-serif headline: "[SUPERLATIVE CLAIM like THE WORLD''S HEALTHIEST CHOCOLATE]". Below headline: white rounded-rectangle CTA button with [BRAND COLOR] uppercase text "[CTA like EXPLORE NOW]". Center: [YOUR PRODUCT] in full packaging, angled slightly, hero-lit with soft studio lighting. Surrounding the product: [SCATTERED ELEMENTS like broken chocolate pieces, cocoa powder dust, crumbs, ingredient pieces] arranged in an exploded/radial pattern creating visual energy and texture on the background surface. Bottom: a white or light rounded-pill stat bar spanning the width with three metrics separated by thin vertical lines: "[STAT 1 like 12G OF PROTEIN]" | "[STAT 2 like ≤2G OF SUGAR]" | "[STAT 3 like ≤3G OF NET CARBS]" in bold [BRAND COLOR] text. Numbers should be large and dominant, labels smaller below. 1:1 aspect ratio.',
'1:1'),

(36, 'Whiteboard Before / After + Product Hold', 'UGC',
'Use the attached images as brand reference for product packaging ONLY. Do NOT use ad layouts or polish. This should look like a real person''s photo. Create: a lifestyle photo set in [SETTING like a bright modern kitchen]. In the background: a small tabletop dry-erase whiteboard or flip-chart propped up on [SURFACE like a marble countertop]. On the whiteboard: two simple hand-drawn black marker line illustrations side by side — left drawing labeled "[BEFORE LABEL like De esto...]" showing [BEFORE STATE like a bloated midsection outline with dots/texture], an arrow pointing right to a second drawing labeled "[AFTER LABEL like A esto!]" showing [AFTER STATE like a flatter, smoother midsection outline]. Below the drawings on the whiteboard: handwritten text in black marker "[HANDWRITTEN CTA like If you want progress during [PROBLEM], you need this!]". In the foreground: [PERSON''S HAND] holding [YOUR PRODUCT] up next to the whiteboard, positioned in the lower-right of the frame. Product label clearly visible. Shot on iPhone, natural kitchen lighting, casual and educational. 4:5 aspect ratio.',
'4:5'),

(37, 'Hero Statement + Icon Bar + Offer Burst (Promo)', 'Offer/Promotion',
'Use the attached images as brand reference. Match the exact product design and brand colors precisely. Create: a promotional variant of a hero statement ad on a [BACKGROUND like dark charcoal/moody gray] background. Top 12%: white or light banner with massive bold [DARK COLOR] uppercase sans-serif headline: "[PROVOCATIVE 2-3 WORD STATEMENT like FUPA KILLER.]" with a period for punch. Upper-left of product area: a [BRIGHT ACCENT COLOR like neon green/lime] comic-style starburst badge rotated slightly, reading "GET UP TO [DISCOUNT like 40%] OFF" in bold black text. Center: [PERSON''S HAND] gripping [YOUR PRODUCT] from above, lifting it off its [PACKAGING like retail box] below. Product label and branding clearly visible. Moody, slightly dramatic lighting. Bottom 20%: three evenly spaced icon-and-text benefit columns on a semi-transparent dark strip: [ICON 1 + LABEL like (crossed-out burger) CURB APPETITE] | [ICON 2 + LABEL like (lightning bolt) BURN CALORIES] | [ICON 3 + LABEL like (heart + body) LOSE WEIGHT]. Icons in simple line-art circles with [ACCENT COLOR] highlights. Very bottom: full-width [BRIGHT ACCENT COLOR] banner with bold [DARK] text: "[PROMO like BLACK FRIDAY SPECIAL]". 1:1 aspect ratio.',
'1:1'),

(38, 'UGC Lifestyle + Product + Review Card (Split)', 'UGC',
'Use the attached images as brand reference. Match the exact product design and brand colors precisely. Create: a vertical split social proof ad. Left 55%: a casual UGC-style photo of [PERSON like a blonde woman in her early 30s, wearing a casual zip-up sweater] enjoying the product in context — [ACTION like sipping an iced drink through a gold metal straw in a bright café setting]. Natural lighting, warm and inviting, iPhone-quality casual feel. The person should look genuinely happy, not posed. Right 45%: solid [PRIMARY BRAND COLOR like deep indigo/purple] background. Top-right: small decorative sparkle/star accents in [ACCENT COLOR like gold/yellow]. Floating center-right: [YOUR PRODUCT] at a slight angle, studio-lit on the colored background. Below product: a white rounded-rectangle review card with: five filled [ACCENT COLOR] stars at top, then italic or casual serif text: "[SHORT REVIEW QUOTE like "I will never get drive-thru coffee again"]" in [BRAND COLOR]. Bottom center: [BRAND LOGO] in white on the colored background, with small decorative sparkle accents. 4:5 aspect ratio.',
'4:5'),

(39, 'Curiosity Gap + Scroll-Stopper Hook', 'Native/Editorial',
'Use the attached images as brand reference for visual tone ONLY. Do NOT include any product, logo, or branding. Create: a scroll-stopping curiosity ad designed to look like a truncated social media post. Top 35%: clean white background with large bold black sans-serif text (heavy weight, tight leading): "[HOOK HEADLINE like Most [AUDIENCE] don''t realize THIS is why [PROBLEM STATEMENT] but did you know...]". The last few words should be followed by "...more" in lighter gray text, mimicking a truncated Facebook/Instagram caption that requires clicking "more" to expand. Bottom 65%: a close-up, slightly uncomfortable or attention-grabbing photo of [PROBLEM VISUAL like the specific physical symptom or problem the product solves — shown on the subject, no product visible]. Photo should feel real and editorial, not stock. Slightly shallow depth of field. No text on the photo. No product. No logo. No CTA. The entire purpose is to provoke curiosity and earn the click. 1:1 aspect ratio.',
'1:1'),

(40, 'Native / Ugly Post-It Note Style (Product Hero)', 'UGC',
'Use the attached images as brand reference. Match the exact [PRODUCT DESCRIPTION — shape, color, label details, key typography on packaging] precisely. Create: a lifestyle product photo set in [REAL-LIFE SETTING — e.g. warm kitchen floor / bathroom counter / living room coffee table] with [LIGHTING DESCRIPTION — e.g. soft natural daylight from a nearby window / warm diffused morning light] and a naturally blurred background showing [BACKGROUND DETAILS — e.g. lower kitchen cabinets and a dog bowl / mirror edge and steam / couch cushions]. Frame is very slightly off-center — product not perfectly centered, [LEFT / BOTTOM / RIGHT] edge of product very slightly cropped — feels found rather than composed. Slight natural sensor grain consistent with a phone camera in indoor daylight. Subtle natural vignette at frame corners. Center of frame, large and dominant: [FULL PRODUCT DESCRIPTION — packaging colors, key label text, distinguishing visual features] sitting on [SURFACE — e.g. light wood floor / raw wood shelf / marble counter], slightly angled toward the viewer. [SCATTERED SURFACE DETAIL — e.g. a few scattered kibble pieces / sea salt crystals / product crumbs] on the surface around the base of the product for casual realism. Stuck directly onto the front face of the product: a [POST-IT COLOR — yellow default] square post-it note, slightly crooked and not perfectly straight — slightly trapezoid from the angle it was pressed on. Realistic paper texture with a horizontal crease across the middle as if it was folded once. Subtle curl at bottom-right corner only. Held at the top by a small piece of [TAPE COLOR — clear / yellow / white] tape, slightly wrinkled — not a self-adhesive strip. One word in the handwriting is slightly heavier-inked or underlined from natural pen pressure. Handwritten in thick black marker-style lettering, imperfect and uneven, lowercase natural writing — not formatted, not centered, not evenly spaced: "[LINE 1 — lowercase, short, setup or hook]" line break "[LINE 2 — continuation or turn]" line break "[LINE 3 — punchline, result, or kicker]" line break "[LINE 4 — optional final beat or emoji]" No attribution line. No signature. Bottom center of frame, outside the photo on a plain white or off-white strip: small plain lowercase sans-serif caption text, looks like someone typed it under an organic post: "[brand url] — [3-5 word casual caption, sounds typed not written]" No logo overlay anywhere in the frame. Brand identity carried entirely by the product packaging visible in the photo. No border. [MOOD — 3 adjectives]. 4:5 aspect ratio.',
'4:5');
