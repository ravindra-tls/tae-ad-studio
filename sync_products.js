const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Product data extracted from seed.sql
const productsToUpdate = [
  {
    id: '7af546f4-d589-482e-bfdf-3bf87afeb075',
    name: 'Manjish Glow Elixir',
    brand: 'The Ayurveda Experience',
    sub_brand: 'iYURA',
    description: 'Ayurveda\'s Pink Power Potion — a glow-giving, even-toning and complexion-restoring night-time facial massage oil. Brick-red elixir with Indian Madder (Manjistha), Lemon, and Butter Tree Bark. Hand-painted Madhubani artwork on cylindrical packaging. 50 ml (1.69 fl oz). Use 4 drops, 5 minutes every night for 7 consecutive nights for best results.',
    ingredients: [
      {"name": "Manjistha (Indian Madder)", "key": true, "description": "Rubia Cordifolia — celebrated Ayurvedic rejuvenative and complexion enhancer, lends the oil its pink-red color, helps balance uneven skin tone and blemishes"},
      {"name": "Lemon (Jambheer)", "key": true, "description": "Pitta-pacifier — cooling, balancing, soothing, helps brighten complexion"},
      {"name": "Butter Tree Bark (Mahua)", "key": true, "description": "Madhuca longifolia bark — used for thousands of years for rejuvenation and youthful appearance, helps tone down appearance of wrinkles and restore radiance"},
      {"name": "Sesame Seed Oil", "key": false, "description": "Tila Taila — nourishing base oil"},
      {"name": "Milk Extract", "key": false, "description": "Godugdha — traditional Ayurvedic ingredient for skin nourishment"},
      {"name": "Licorice", "key": false, "description": "Yashtimadhu — brightening and soothing support"},
      {"name": "Citrus Limon (Lemon) Juice Extract", "key": false, "description": "Natural brightening"}
    ],
    claims: [
      {"text": "Imparts a natural, gold-like glow reminiscent of the radiance described in ancient Ayurvedic text Chakradutt", "source": "Ayurvedic classical text"},
      {"text": "Evens skin tone and restores complexion with regular nightly use", "source": "Consumer feedback"}
    ],
    color_palette: [
      {"name": "Brick Red", "hex": "#8B4513", "usage": "Primary product color"},
      {"name": "Gold", "hex": "#FFD700", "usage": "Accent, glow highlights"},
      {"name": "Cream", "hex": "#FFFDD0", "usage": "Light background"},
      {"name": "Deep Burgundy", "hex": "#3C0910", "usage": "Rich text and borders"}
    ],
    prompt_modifier: 'Luxe, ritualistic, intimate, warm golden-hour, ancient wisdom meets modern skincare',
    compliance_rules: ['No medical claims', 'Pure oil product', 'Ayurvedic heritage'],
    thumbnail_url: 'https://example.com/manjish.jpg',
    context: {
      "brand": "iYURA",
      "website": "theayurvedaexperience.com",
      "target_audience": "Women 30–65+, seeking natural complexion evening, age spots, uneven tone, loss of radiance, want luxe nighttime ritual",
      "benefits": [
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
      "hero_headline": "4 Drops, 5 Minutes Every Night and You Won't Want Makeup!",
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
          "age": 68,
          "headline": "LOVE It",
          "quote": "I absolutely LOVE this on my face! I use it every night and can't say enough good things about it.",
          "pull_quote": "can't say enough good things",
          "flag": "🇺🇸",
          "verified": true
        },
        {
          "name": "Elaine W.",
          "headline": "LOVE It",
          "quote": "I absolutely LOVE this on my face! I use it every night and can't say enough good things about it.",
          "pull_quote": "can't say enough good things",
          "flag": "🇺🇸",
          "verified": true
        }
      ]
    }
  },
  {
    id: 'ecbce262-6cc1-45d9-b8de-9c6c0bcea398',
    name: 'Balaayah Black Gram Body Booster',
    brand: 'The Ayurveda Experience',
    sub_brand: 'iYURA',
    description: 'The Black Gold of Skincare — an ultra-rich but non-sticky Ayurvedic body oil for aging, dehydrated, dry skin. Powered by Black Gram Lentil (Vigna Mungo) with Frankincense and Vanilla essential oils. Transforms saggy, crepey, dry skin on arms, legs, stomach into firm, velvet-soft, glossy skin. 100 ml (3.38 fl oz). 100% natural, vegan, not tested on animals.',
    ingredients: [
      {"name": "Black Gram Lentil (Vigna Mungo)", "key": true, "description": "The biggest power-bomb of Balaayah — extremely nutritious lentil rich in protein and iron, uniquely prized in Ayurveda for its moisturizing and volumizing quality for skin"},
      {"name": "Sesame Seed Oil", "key": false, "description": "Sesamum Indicum — warming, nourishing base oil"},
      {"name": "Himalayan Rock Salt", "key": true, "description": "Enables triple-effect moisturization: hydrates, moisturizes and protects moisture loss. Gives this oil the ability to hydrate as well as moisturize"},
      {"name": "Velvet Beans (Mucuna Pruriens)", "key": true, "description": "Leguminous tropical plant — supports skin firmness and tone"},
      {"name": "Nut Grass (Cyperus Rotundus)", "key": false, "description": "Perennial sedge plant — supports skin tone and complexion"},
      {"name": "Castor Oil (Ricinus Communis)", "key": false, "description": "Rich in ricinoleic acid — provides deep hydration"},
      {"name": "Frankincense Essential Oil", "key": false, "description": "Natural aroma — meditative, relaxing scent note"},
      {"name": "Vanilla Essential Oil", "key": false, "description": "Natural aroma — warm, comforting scent note"},
      {"name": "Country Mallow (Abutilon Indicum)", "key": false, "description": "Traditional Ayurvedic herb for skin nourishment"}
    ],
    claims: [
      {"text": "Instant, day-long, intense moisture that keeps skin comfortable through the day", "source": "Product benefits"},
      {"text": "Transforms saggy, crepey, dry skin into firm, velvet-soft, glossy skin", "source": "Consumer feedback"},
      {"text": "Freedom to wear sleeveless clothes, shorts, short dresses without self-consciousness", "source": "Consumer testimonials"}
    ],
    color_palette: [
      {"name": "Deep Gold", "hex": "#B8860B", "usage": "Primary oil color"},
      {"name": "Charcoal", "hex": "#36454F", "usage": "Dark text and accents"},
      {"name": "Cream", "hex": "#FFFDD0", "usage": "Light background"},
      {"name": "Warm Bronze", "hex": "#CD7F32", "usage": "Secondary accent"}
    ],
    prompt_modifier: 'Empowering, luxurious, body-positive, warm, self-care luxury, liberating',
    compliance_rules: ['100% natural', 'Vegan', 'No animal testing'],
    thumbnail_url: 'https://example.com/balaayah.jpg',
    context: {
      "brand": "iYURA",
      "website": "theayurvedaexperience.com",
      "target_audience": "Women 40–80+, concerned about saggy arms, crepey skin, dry legs, aging hands, wanting confidence in sleeveless clothing",
      "benefits": [
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
          "age": 72,
          "headline": "Great Product!",
          "quote": "My skin tone and texture have improved significantly.",
          "pull_quote": "skin tone and texture improved",
          "flag": "🇺🇸",
          "verified": true
        },
        {
          "name": "Barbara M.",
          "headline": "Truly Amazing",
          "quote": "This stuff is truly amazing! I assumed it was just another oil and my legs would look dull the next day — but they didn't!",
          "pull_quote": "This stuff is truly amazing",
          "flag": "🇺🇸",
          "verified": true
        }
      ]
    }
  },
  {
    id: '6f6827dd-7e9d-4e14-aeb5-6c2d79c0d30e',
    name: 'Flex & Fine Joint Support',
    brand: 'The Ayurveda Experience',
    sub_brand: 'HERBIUS',
    description: 'Ayurvedic supplement for healthy and strong joints. Targets lubricin — the hidden protein that stops joints from drying out. 8 clinically studied herbs at their researched doses. 100% natural, vegan, gluten-free, non-GMO. 4 capsules daily after a meal. $28 per bottle (1-month supply). Third-party tested, manufactured in US FDA-registered GMP facility.',
    ingredients: [
      {"name": "Guggul", "key": true, "description": "Commiphora mukul resin — blocks cytokines IL-1β and TNF-α, limits cartilage and collagen loss, clinically studied dose"},
      {"name": "Winged Treebine (Cissus)", "key": true, "description": "Hadjod / bone-setter — unique bone-shaped stem plant, suppresses oxidative stress and pro-inflammatory cytokines, clinically studied dose"},
      {"name": "Turmeric (95% Curcuminoids)", "key": true, "description": "Golden spice — curcumin compound for joint comfort and synovial fluid health, supported by 50+ journal articles"},
      {"name": "Boswellia Serrata", "key": true, "description": "Indian Frankincense — increases hyaluronan levels for joint cushioning, clinically studied dose"},
      {"name": "Ginger", "key": false, "description": "Widely used natural remedy — guards joints from age-related stiffness and decline"},
      {"name": "Garlic", "key": false, "description": "Strong antioxidant — significant reduction in TNF-α levels, pain intensity, and fatigue in randomized double-blind trial (70 women with RA)"},
      {"name": "Cyperus", "key": false, "description": "Cyperaceae family — helps support smoother movement"},
      {"name": "Black Pepper (95% Piperine)", "key": false, "description": "Bioavailability enhancer — increases curcumin absorption by up to 2000% (Johns Hopkins Medicine), clinically studied dosage"}
    ],
    claims: [
      {"text": "Supports natural lubricin production for joint lubrication", "source": "Preclinical study"},
      {"text": "Targets 7 key mechanisms of joint health", "source": "Product formulation"},
      {"text": "100% natural — zero glucosamine, zero shellfish", "source": "Product specification"},
      {"text": "Each herb at clinically studied dose", "source": "Manufacturing standard"}
    ],
    color_palette: [
      {"name": "Golden Yellow", "hex": "#FFD700", "usage": "Turmeric inspired primary"},
      {"name": "Forest Green", "hex": "#228B22", "usage": "Herbal, natural accent"},
      {"name": "Ivory", "hex": "#FFFFF0", "usage": "Light background"},
      {"name": "Warm Brown", "hex": "#8B4513", "usage": "Earthy grounding"}
    ],
    prompt_modifier: 'Hopeful, empowering, active, scientifically credible, warm, clinical yet accessible',
    compliance_rules: ['Supplement claim', 'Third-party tested', 'FDA-registered facility', 'Natural ingredients only'],
    thumbnail_url: 'https://example.com/flex-fine.jpg',
    context: {
      "brand": "HERBIUS",
      "website": "theayurvedaexperience.com",
      "target_audience": "Women and men 50–75+, stiff knees, sore shoulders, difficulty climbing stairs, losing mobility, seeking natural joint support",
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
      "before_state": "stiff knees, sore shoulders, difficulty climbing stairs, getting out of bed feels like a task, can't bend to pick things up, losing independence",
      "after_state": "smooth fluid movement, standing up without help, opening jars without wincing, taking extra miles on walks, playing with grandkids again",
      "timeframe": "Feel the difference — many choose the 3-month supply for consistent support",
      "surface": "clean white surface with scattered turmeric and herbs",
      "setting": "bright, airy lifestyle setting — garden, walking path, home kitchen",
      "mood": "hopeful, empowering, active, scientifically credible, warm",
      "cta": "Try Flex & Fine for Healthy Joints Today",
      "short_headline": "Restore Your Joint's Natural Lubricant",
      "hero_headline": "New Research Reveals The Hidden Protein That Stops Your Joints From Drying Out",
      "educational_hook": "Most remedies completely miss what your joints are actually starving for — Lubricin, your joint's natural lubricant. As you age, lubricin production naturally declines. Most glucosamine supplements focus only on cartilage support, but Flex & Fine targets 7 key mechanisms of joint health with 8 clinically studied herbs.",
      "testimonials": []
    }
  }
];

const productsToInsert = [
  {
    name: 'Kesaradi Daily Glow',
    brand: 'The Ayurveda Experience',
    sub_brand: 'iYURA',
    description: 'Ayurveda\'s Brightening, Revitalizing, Uber-Nourishing Secret — a polyherbal cooked daily facial oil with Saffron (Threads of Sunrise), Turmeric (Glow\'rious Dust), and Lotus plus 17+ Ayurvedic ingredients. Softens the appearance of mouth lines, awakens radiance, evens out skin tone 100% naturally. Light, non-greasy, fast-absorbing with a satin finish. 3 drops every morning. 50 ml (1.69 fl oz). $45.',
    ingredients: [
      {"name": "Saffron (Crocus Sativus)", "key": true, "description": "Threads of Sunrise / Red Gold — world's most expensive spice, 50,000-75,000 flowers for 16 oz. Helps with complexion enhancement and even-toning per classical Ayurvedic texts Bhavprakash and Astanga Hridaya"},
      {"name": "Turmeric (Curcuma Longa)", "key": true, "description": "The Glow'rious Dust / Golden Spice — rich in curcumin, celebrated for 5,000 years, brightens and energizes skin, restores healthy glow, supports beauty barrier"},
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
    ],
    claims: [
      {"text": "Softens the appearance of harsh-looking mouth lines", "source": "Consumer feedback"},
      {"text": "Awakens radiance and evens out skin tone 100% naturally", "source": "Product benefits"},
      {"text": "Fast-absorbing, non-greasy with a satin matte-like finish — works perfectly under makeup", "source": "Product formulation"},
      {"text": "Polyherbal cooked formula with 17+ Ayurvedic ingredients — not a surface-level infusion", "source": "Manufacturing process"}
    ],
    color_palette: [
      {"name": "Saffron Gold", "hex": "#F4C430", "usage": "Primary product inspiration"},
      {"name": "Soft Cream", "hex": "#FFEFD5", "usage": "Light elegant background"},
      {"name": "Rose Pink", "hex": "#FFB6C1", "usage": "Lotus accent"},
      {"name": "Deep Terracotta", "hex": "#8B4513", "usage": "Rich text"}
    ],
    prompt_modifier: 'Luxurious, ancient, radiant, sophisticated, sensory-rich, temple-inspired',
    compliance_rules: ['Natural oil', 'Ayurvedic heritage', 'Polyherbal formula'],
    thumbnail_url: 'https://example.com/kesaradi.jpg',
    context: {
      "brand": "iYURA",
      "website": "theayurvedaexperience.com",
      "target_audience": "Women 35–70+, concerned about mouth lines, uneven skin tone, dullness, wanting luxe daily skincare ritual",
      "benefits": [
        "Softens the appearance of harsh-looking mouth lines",
        "Awakens radiance and evens out skin tone",
        "Fast-absorbing, non-greasy satin finish",
        "Works perfectly under makeup",
        "Polyherbal cooked formula with 17+ ingredients",
        "Light, non-greasy texture"
      ],
      "stats": [],
      "review_count": "Verified customer reviews",
      "social_proof": "iYURA daily facial oil with Saffron, Turmeric, and Lotus",
      "before_state": "dull complexion, harsh mouth lines, uneven skin tone, tired-looking skin, loss of radiance",
      "after_state": "radiant glow, softened mouth lines, even-toned complexion, awakened skin luminosity",
      "timeframe": "Visible results within 2-3 weeks of consistent use",
      "surface": "minimalist vanity with white marble or light wood",
      "setting": "serene morning ritual, natural light, spa-like bathroom",
      "mood": "luxurious, sacred, radiant, temple-inspired, sophisticated",
      "cta": "Awaken Your Skin's Natural Radiance with Kesaradi",
      "short_headline": "Saffron, Turmeric & Lotus Daily Glow Oil",
      "hero_headline": "Soften the Appearance of Harsh-Looking Mouth Lines, Awaken Radiance and Even Out Skin Tone 100% Naturally",
      "educational_hook": "Saffron — the world's most expensive spice (50,000-75,000 flowers for 16 oz) — has been celebrated in classical Ayurvedic texts for complexion enhancement. Combined with Turmeric (5,000 years of Ayurvedic use) and Lotus (flower of purity and renewal), this polyherbal cooked formula contains 17+ Ayurvedic ingredients — far beyond surface-level infusions.",
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
          "quote": "I've been using it for 2 weeks now night and morning and the results are unbelievable, I have deep upper lip lines and they have softened significantly.",
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
    }
  },
  {
    name: 'Firm-Focus Neck Mask',
    brand: 'The Ayurveda Experience',
    sub_brand: null,
    description: '28-Night Start to a Sculpture-Smooth Looking Neck — a leave-on, no-rinse "String-to-Silk" invisible gel mask for neck, chin, jaw, decollete and upper chest. With Phyto-Ceramides, White-Water Lily, Lotus, Bermuda Grass, Red Spiderling, Kiwi Water, and Kelp Extract. Non-sticky, ultra-lightweight, no residue. 1.76 oz (50g). $45.',
    ingredients: [
      {"name": "Plant-Ceramide Complex (Phospholipids, Sphingolipids, Pentyl Glycol)", "key": true, "description": "Invisible scaffolding — breathable cocoon that helps skin hold on to its own moisture. Preservative-free vegan plant-derived ceramide blend from seed oils and cereal brans"},
      {"name": "White-Water Lily", "key": true, "description": "Ayurveda's symbol of youth and the throat chakra — visibly brightens and smooths neck skin"},
      {"name": "Sacred Lotus (Nelumbo Nucifera)", "key": true, "description": "Symbol of purity — visibly brightens and smooths, supports hydration"},
      {"name": "Bermuda Grass", "key": false, "description": "Lends an even tone to neck and chest skin"},
      {"name": "Red Spiderling Root", "key": false, "description": "Lends an even tone to neck and chest"},
      {"name": "Kiwi Water", "key": true, "description": "Floods the surface with vitamin-rich dewiness"},
      {"name": "Kelp Extract", "key": true, "description": "Forms an elastic veil that makes contours look freshly sculpted — instant-taut plant active"},
      {"name": "Hydrolyzed Vegetable Protein", "key": false, "description": "Forms elastic veil with Kelp for sculpted contour look — gentle hug for lax skin"},
      {"name": "Butylene Glycol (Sugarcane Molasses Extract)", "key": false, "description": "Whisper-soft renewal — lightest touch of resurfacing, coaxes away dull flakes"},
      {"name": "Xylitol (Wood Pulp Extract)", "key": false, "description": "Upcycled from Birch and Beech wood — lasting cooling and hydrating benefits"}
    ],
    claims: [
      {"text": "97% reported visibly smoother neck skin by Week 4", "stat": "97%", "context": "Consumer testing on 110 women aged 40-65 with visibly dry, loose neck skin"},
      {"text": "90% agreed skin on upper chest appeared tight by Week 8", "stat": "90%", "context": "Consumer testing on 110 women aged 40-65"},
      {"text": "84% reported visibly firmer loose skin on neck", "stat": "84%", "context": "8-week consumer perception study, 110 women, daily PM use"},
      {"text": "92% said skin appears tighter on neck", "stat": "92%", "context": "8-week consumer perception study"},
      {"text": "98% said skin looks smoother on neck", "stat": "98%", "context": "8-week consumer perception study"},
      {"text": "98% said skin looks and feels well hydrated on neck", "stat": "98%", "context": "8-week consumer perception study"},
      {"text": "95% said skin looks smoother on upper chest", "stat": "95%", "context": "8-week consumer perception study"}
    ],
    color_palette: [
      {"name": "Soft Teal", "hex": "#5F9EA0", "usage": "Primary / calming tone"},
      {"name": "Pearl White", "hex": "#F5F5F5", "usage": "Clean background"},
      {"name": "Water Lily Pink", "hex": "#E8B4B8", "usage": "Botanical accent"},
      {"name": "Deep Charcoal", "hex": "#2C2C2C", "usage": "Dark text"},
      {"name": "Gold", "hex": "#C9A85C", "usage": "Premium accent"}
    ],
    prompt_modifier: 'Clinical yet luxurious, serene, sculpted, confident, transformative, overnight ritual',
    compliance_rules: ['Clinical study data', 'Consumer perception study', 'Leave-on mask'],
    thumbnail_url: 'https://example.com/firm-focus.jpg',
    context: {
      "brand": "The Ayurveda Experience",
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
          "quote": "There's a reason this product keeps selling out… it works!! I was so very sad that I didn't order two.",
          "pull_quote": "keeps selling out because it works",
          "flag": "🇺🇸",
          "verified": true
        }
      ]
    }
  }
];

async function syncProducts() {
  console.log('===== SYNCING PRODUCTS TO SUPABASE =====\n');

  // Update existing products
  console.log('STEP 1: UPDATING 3 EXISTING PRODUCTS...\n');
  for (const product of productsToUpdate) {
    try {
      const { data, error } = await supabase
        .from('products')
        .update({
          name: product.name,
          brand: product.brand,
          sub_brand: product.sub_brand,
          description: product.description,
          ingredients: product.ingredients,
          claims: product.claims,
          color_palette: product.color_palette,
          prompt_modifier: product.prompt_modifier,
          compliance_rules: product.compliance_rules,
          thumbnail_url: product.thumbnail_url,
          context: product.context
        })
        .eq('id', product.id);

      if (error) {
        console.log(`ERROR updating ${product.name}:`, error.message);
      } else {
        console.log(`✓ Successfully updated: ${product.name} (ID: ${product.id})`);
        console.log(`  - Ingredients: ${product.ingredients.length} items`);
        console.log(`  - Claims: ${product.claims.length} items`);
        console.log(`  - Context testimonials: ${product.context.testimonials.length} reviews`);
        console.log();
      }
    } catch (err) {
      console.log(`EXCEPTION updating ${product.name}:`, err.message);
    }
  }

  // Insert new products
  console.log('\nSTEP 2: INSERTING 2 NEW PRODUCTS...\n');
  for (const product of productsToInsert) {
    try {
      const { data, error } = await supabase
        .from('products')
        .insert([{
          name: product.name,
          brand: product.brand,
          sub_brand: product.sub_brand,
          description: product.description,
          ingredients: product.ingredients,
          claims: product.claims,
          color_palette: product.color_palette,
          prompt_modifier: product.prompt_modifier,
          compliance_rules: product.compliance_rules,
          thumbnail_url: product.thumbnail_url,
          context: product.context
        }]);

      if (error) {
        console.log(`ERROR inserting ${product.name}:`, error.message);
      } else {
        console.log(`✓ Successfully inserted: ${product.name}`);
        console.log(`  - Ingredients: ${product.ingredients.length} items`);
        console.log(`  - Claims: ${product.claims.length} items`);
        console.log(`  - Context testimonials: ${product.context.testimonials.length} reviews`);
        console.log();
      }
    } catch (err) {
      console.log(`EXCEPTION inserting ${product.name}:`, err.message);
    }
  }

  console.log('\n===== SYNC COMPLETE =====');
}

syncProducts();
