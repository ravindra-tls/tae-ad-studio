-- STEP 1: Add the context column (safe to run multiple times)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS context jsonb DEFAULT null;

-- STEP 2: Update Rufolia Pro with full product context
UPDATE public.products
SET context = '{
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
    {"value": "100%", "label": "Women saw Dark Circles reduce",           "context": "110 women, 40–65, 8 weeks"},
    {"value": "100%", "label": "Women reported Firmer, Smoother Eyelids", "context": "110 women, 40–65, 8 weeks"},
    {"value": "99%",  "label": "Women saw improved Smoothness around eyes","context": "8 weeks"},
    {"value": ">98%", "label": "Women saw reduced Crow''s Feet Wrinkles",  "context": "8 weeks"},
    {"value": ">97%", "label": "Women agreed eye area had overall Lifted look", "context": "8 weeks"}
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
      "name": "Jennifer D.", "age": 64,
      "headline": "Miraculous",
      "quote": "I have purchased every cream, ointment, serum, you name it for 40 years. I no longer need concealer — and I''ve purchased every concealer available from drugstore to Internet. My biggest fear now is that this product will be out of stock!",
      "pull_quote": "I no longer need concealer",
      "flag": "🇺🇸", "verified": true
    },
    {
      "name": "Kay B.", "age": 74,
      "headline": "WORKS, EVEN ON OLD EYELIDS!",
      "quote": "At 74, my eyelids were beginning to get very wrinkly. I have huge eyelids, so it was quite noticeable. This eye cream makes my eyes look years younger.",
      "pull_quote": "Makes my eyes look years younger",
      "flag": "🇺🇸", "verified": true
    },
    {
      "name": "Meagan N.", "age": 52,
      "headline": "AMAZING EYEMULSION!",
      "quote": "This eyemulsion product is incredible. I used to have dark circles under my eyes quite often. A must have for women of any age.",
      "pull_quote": "A must have for women of any age",
      "flag": "🇺🇸", "verified": true
    },
    {
      "name": "Lori", "age": 51,
      "headline": "AMAZING EYE CREAM",
      "quote": "I absolutely love this product. The pale pink color helps camouflage my dark under eyes. It is so hydrating and smells intoxicating. Its matte finish makes it perfect under makeup.",
      "pull_quote": "pale pink color camouflages my dark under eyes",
      "flag": "🇺🇸", "verified": true
    },
    {
      "name": "Beverly C.", "age": 72,
      "headline": "This Product is a Serious Game Changer!",
      "quote": "I can''t believe I finally found something... the eye treatment is like nothing else I''ve tried!",
      "pull_quote": "This Product is a Serious Game Changer",
      "flag": "🇺🇸", "verified": true
    },
    {
      "name": "Georgina A.", "age": 82,
      "headline": "OLD EYES",
      "quote": "Very good — I am almost 83 years old and I find firming results with Rufolia.",
      "pull_quote": "firming results at almost 83",
      "flag": "🇺🇸", "verified": true
    }
  ]
}'::jsonb
WHERE name = 'Rufolia Pro Periorbital Eyemulsion';

-- Verify it worked
SELECT name, context->>'tagline' AS tagline, jsonb_array_length(context->'testimonials') AS testimonial_count
FROM public.products
WHERE name = 'Rufolia Pro Periorbital Eyemulsion';
