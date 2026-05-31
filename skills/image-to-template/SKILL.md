---
name: image-to-template
description: >
  Reverse-engineer any ad image into a reusable TAE Ad Studio prompt template.
  Upload an image (an existing ad, a competitor creative, a design reference, or
  a screenshot) and this skill produces a ready-to-paste template record with a
  name, category, aspect ratio, and a prompt string that uses the app's
  [PLACEHOLDER] token system — so the template works immediately in the admin UI
  without any further editing.

  Use this skill whenever the user says things like: "turn this image into a
  template", "reverse-engineer this ad", "make a template from this creative",
  "I want to recreate this style", "generate a template from this reference",
  "add this to templates", or uploads an image and asks to capture its format.
---

# Image → Prompt Template

You are reverse-engineering an ad image into a TAE Ad Studio prompt template.
The goal is NOT to describe what's in the image — it's to write a prompt that
would instruct an image model to create a *similar ad layout* for a different
product, with brand-specific details replaced by named placeholder tokens.

Think of it like a film director writing a shot spec card rather than a film
critic writing a review.

---

## Step 1 — Analyse the image

Look at the uploaded image and identify:

1. **Layout / composition** — Where is the product? Where is the text? What
   percentage of the canvas is negative space and where? Does the ad use a split
   layout, full-bleed product, floating layers, or grid?

2. **Text zones** — What text elements are present (headline, subhead, body
   copy, CTA button, review quote, stat, badge, disclaimer)? Where are they
   positioned (top, bottom, left, right, center, overlaid on image, on a
   separate panel)?

3. **Photography / rendering style** — Studio shot, lifestyle photo, flat-lay,
   UGC-style, illustration, diagrammatic? Light quality (soft/diffuse,
   dramatic/directional, warm, cool)? Depth of field?

   **Human presence check (answer YES or NO before continuing):** Are there
   any human figures, faces, hands, arms, or body parts visible anywhere in
   the frame — including partial, blurred, or out-of-focus ones? This YES/NO
   answer directly controls how Step 2 is written. Record it explicitly as
   part of your analysis so you cannot accidentally skip it.

4. **Color treatment** — Is the background a solid color, gradient, textured
   surface, or environmental scene? Does the palette use brand colors, neutral
   tones, or high-contrast accents?

5. **Ad archetype** — Which one of these best describes the ad?
   - `Lifestyle` — person in-use, aspirational moment
   - `Hero/Product` — product as hero, negative space for copy
   - `Social Proof` — review, testimonial, star ratings, user count
   - `UGC` — looks like a real person's post (TikTok, Instagram story)
   - `Educational` — diagram, ingredient callout, stat-led
   - `Comparison` — side-by-side, before/after, vs. competitor
   - `Native/Editorial` — styled like editorial content, not an ad
   - `Press/Authority` — "As seen in", publication logos, endorsements
   - `Offer/Promotion` — discount, promo, urgency, bundle

6. **Aspect ratio** — Match to the closest of: `1:1`, `4:5`, `9:16`, `16:9`,
   `3:4`

7. **Scene narrative & emotional subtext** — This is the most commonly missed
   dimension. Go beyond what is literally in the frame and ask: *what story is
   the arrangement telling?* Every prop, surface, and product placement is a
   deliberate choice that communicates a feeling or life moment to the viewer.

   Ask yourself these questions:
   - **What is the implied occasion?** (morning routine, travel, post-workout,
     gifting, bedside ritual, on-the-go, pregnancy prep, self-care Sunday…)
   - **What life context does the setting suggest?** A hospital bag, a canvas
     tote, a gym bag, a bathroom counter, a kitchen table — each carries a
     very different emotional register.
   - **What is the viewer supposed to feel?** Cared-for, empowered, prepared,
     nostalgic, aspirational, reassured, indulgent…
   - **What is the product's role in the scene?** Is it the hero, or a
     trusted companion tucked among other essentials? Is it aspirational or
     practical? Is it something you'd reach for daily or save for a moment?
   - **What props are doing emotional work?** A knit blanket says "cozy and
     safe." A canvas tote/bag says "ready to go, part of real life." A marble
     countertop says "premium, curated." Scattered lentils say "ingredient
     story." Each prop is a signal — name what it's signalling.

   Translate this into the prompt as a **scene narrative sentence** — a single
   line that tells the image model the emotional context the scene must evoke:
   e.g. *"The arrangement should feel like someone has just packed their
   hospital bag and tucked this product in as a non-negotiable — essential,
   trusted, and ready."* This sentence gives the image model the emotional
   target that pure composition instructions cannot convey.

8. **Audience psychology** — The scene narrative tells you what the image is
   saying. Audience psychology tells you *who is receiving that message* and
   what they are carrying emotionally when they encounter it. These are
   different things, and both must be encoded in the template.

   Ask yourself:
   - **Who is this person in real life?** Age, life stage, identity. Not a
     demographic label — a human being. "A woman in her late 50s who used to
     be active but has quietly started limiting what she does."
   - **What is their daily emotional reality right now?** What are they living
     with before they see this ad? Frustration, resignation, quiet hope,
     embarrassment, the specific ache of something they've stopped doing?
   - **What do they tell themselves about their problem?** The internal
     monologue. "I've just accepted this is how it is now." "I've tried
     everything." "I don't want to make a fuss about it."
   - **What does this ad promise to change?** Not the product benefit — the
     emotional shift. From hiding to visible. From resigned to hopeful. From
     routine to ritual. From "managing" to thriving.
   - **What specific everyday detail in the image speaks directly to their
     life?** The packed bag. The sleeveless dress on the hook. The morning
     tea cup. The moment in the bathroom mirror. These details are deliberate
     signals — name what signal each one is sending to this specific audience.
   - **What aspirational self-identity does the ad invite them into?** "A
     woman who takes care of herself." "Someone who moves freely." "A person
     who doesn't have to think about it anymore."

   These insights become **audience psychology tokens** in the template prompt
   — variables that get filled in with product-specific audience data when
   generating a prompt for a real product. This ensures the image model
   renders people, expressions, gestures, and settings that resonate with the
   actual viewer, not a generic aspirational person.

---

## Step 2 — Write the template prompt

Write a prompt that captures the *structure and style* of the ad layout. The
prompt is addressed to an image model; it describes what to create, not what
exists.

**Rules for writing the prompt:**

- Be concrete about layout percentages, text placement, and visual zones.
  Say things like "Left 40% is [BRAND COLOR] solid background — clear text zone.
  Right 60% shows [YOUR PRODUCT] on [SURFACE]." Not "product on the right."
  
- Replace all brand-specific content with placeholder tokens (see the list
  below). The app fills these automatically from the product's data.

- Keep photography direction vivid and actionable — image models need posture,
  light source, depth, and mood. "Shot at 85mm f/2.8, warm diffuse light from
  the left, shallow depth of field" is good. "Nice photo of product" is useless.

- **Always include a scene narrative sentence** — after the composition
  description, add one sentence that names the emotional moment the scene is
  meant to evoke. This is the instruction the image model uses to make the
  *arrangement* feel intentional rather than decorative. It should describe
  what the viewer is supposed to feel when they see the image, and what life
  context the props and product placement imply. Examples:
  - *"The scene should feel like someone has carefully packed their hospital bag
    and tucked [YOUR PRODUCT] in as a trusted essential — prepared, calm, and
    ready."*
  - *"The arrangement should evoke a quiet Sunday morning ritual — intimate,
    unhurried, just for herself."*
  - *"Props and placement communicate that this is a real person's gym bag
    staple, not a staged product shot — worn-in, practical, earned."*
  Never skip this sentence. A prompt that only describes layout and lighting
  without emotional context produces technically correct but emotionally flat
  images.

- The prompt should include an instruction to use the attached product images
  as brand reference: begin with `"Use the attached images as brand reference.
  Match exact product colors, typography style, and brand tone precisely."` —
  this is how every existing template starts and the app prepends it to all
  reference-guided generation.

- **CRITICAL: Human figures — detect first, then write accordingly.**
  Before writing the prompt, make a binary YES/NO decision: does the
  reference ad contain any human figures, body parts, hands, faces, or
  people? This single decision controls two completely different prompt
  paths — never mix them.

  **If YES (humans are present in the reference ad):**
  Add a casting and emotional-register line after the scene narrative
  sentence using the `[AUDIENCE PERSON]`, `[AUDIENCE DAILY REALITY]`, and
  `[AUDIENCE ASPIRATIONAL IDENTITY]` tokens so the image model renders
  people who resonate with the actual viewer. For example: *"Cast
  [AUDIENCE PERSON] — someone living with [AUDIENCE DAILY REALITY]. Her
  expression and posture should evoke [AUDIENCE ASPIRATIONAL IDENTITY],
  not a model selling a product."* This is what stops the rendered person
  from being a generic aspirational figure.

  **If NO (reference ad is product-only, flat-lay, or has zero people):**
  Write an explicit exclusion instruction in the prompt: *"No people,
  hands, faces, or body parts — product and props only."* Do NOT include
  any `[AUDIENCE PERSON]`, `[AUDIENCE DAILY REALITY]`, or
  `[AUDIENCE ASPIRATIONAL IDENTITY]` tokens. Do NOT include any casting
  guidance whatsoever. Omit the entire audience psychology token block.
  Image models will add people if given even a small opening — the
  explicit prohibition is mandatory, not optional.

  This rule exists because adding human figures to a product-only
  composition completely changes the ad format, layout balance, and brand
  feel — it is not a minor variation, it is a different ad type entirely.

- **CRITICAL: Never carry over the reference product's physical format or
  packaging type.** The reference ad might show a tub, a sachet, a dropper
  bottle, or a jar — that is the *reference brand's* product form, not yours.
  The template must describe the product's *role in the scene* (hero shot,
  lifestyle companion, held in hand, resting on a surface), not its physical
  shape. Use `[YOUR PRODUCT with key packaging details]` so that when the
  template is applied to a real product — an eye cream tube, an oil bottle, a
  supplement pouch — the image model renders *that* product's form factor
  exactly, not the packaging shown in the inspiration image. If the composition
  specifically requires a container shape (e.g. "product lip visible at the
  top-left"), write it as `[YOUR PRODUCT with key packaging details]` rather
  than "the tub" or "the jar". A template that hardcodes a container shape will
  produce wrong outputs for every product it is applied to.

- Aim for 80–160 words. Tight enough to be a reusable formula; detailed enough
  to give the image model meaningful guidance.

---

## Placeholder token reference

Use these tokens wherever brand-specific details appear. The app's
`prompt-assembler.ts` fills them automatically from the product record.

### Identity
- `[PRODUCT]` or `[YOUR PRODUCT]` — product name
- `[YOUR PRODUCT with key packaging details]` — name + packaging description
- `[BRAND]` — brand name (e.g. iYURA, Herbius)
- `[PRODUCT CATEGORY]` — category (e.g. Eye Cream, Joint Supplement)
- `[WEBSITE]` — brand website URL

### Color palette
- `[PRIMARY BRAND COLOR]` — primary color name + hex
- `[ACCENT COLOR]` — accent / secondary color
- `[CONTRAST COLOR]` — high-contrast color (often light vs. dark primary)
- `[DARK BRAND COLOR]` — darkest brand color for text/outlines
- `[BACKGROUND]` — background color / surface color
- `[SOFT BRAND COLOR like lavender/light purple]` — tinted, muted version

  > When the color role is obvious from context, use the simple form e.g.
  > `[BRAND COLOR]`. If the layout requires a specific tone, use a descriptive
  > hint: `[BRAND COLOR like chocolate brown]`, `[ACCENT COLOR like coral/red]`.

### Product visuals
- `[SURFACE]` — what the product rests on (marble countertop, wooden shelf…)
- `[SETTING like a bright modern kitchen]` — environmental context
- `[KEY INGREDIENT]` — hero ingredient name

### Copy / text elements
- `[SHORT HEADLINE]` — short brand headline (under 6 words)
- `[YOUR HEADLINE, under 10 words]` — hero headline
- `[YOUR SUBHEAD, one sentence]` — supporting line
- `[CTA]` or `[CTA like SHOP NOW]` — call to action button text
- `[CLAIM]` — product claim
- `[STAT]` — key statistic
- `[SOCIAL PROOF]` or `[REVIEW COUNT]` — review count / authority number
- `[BENEFIT 1-4]` — comma list of benefits
- `[STAT 1 like 12G OF PROTEIN]` — specific numbered stat

### People / audience
- `[PERSON]` — person type matching target audience (e.g. "woman in her 40s")
- `[PERSON DESCRIPTION like woman in her 40s with visible fine lines]` — richer description

### Social proof / reviews
- `[PULL-QUOTE — the most emotional 4-8 word phrase from the review]`
- `[FULL QUOTE 2-3 sentences]`
- `[NAME]` or `[REVIEWER NAME like Dawn K.]`
- `[ATTRIBUTION like - Erin D.]`
- `[VERIFIED BADGE TEXT like Verified Reviewer]`
- `[STAR RATING like five gold stars]`

### Transformation (before/after ads)
- `[BEFORE STATE]` — problem state description
- `[AFTER STATE]` — result state description
- `[TIMEFRAME]` — e.g. "8 weeks"

### Promotional (leave as-is — user fills these per campaign)
- `[DISCOUNT like 40%]`
- `[PROMO CODE]`
- `[YOUR OFFER like Free Shipping over $50]`
- `[URGENCY PHRASE like Limited Offer]`

### Audience psychology
These tokens are derived from your Step 1 dimension 8 analysis. They are
left as named variables in the template and filled from product audience data
when generating a real prompt.

- `[AUDIENCE PERSON like woman in her late 40s who has quietly stopped doing things she loves]` — specific human, not a demographic label
- `[AUDIENCE DAILY REALITY like someone who wakes up stiff and plans her day around it]` — the emotional/physical state they live with before seeing the ad
- `[AUDIENCE INTERNAL MONOLOGUE like "I've tried everything, this is just how it is now"]` — what they tell themselves about the problem
- `[AUDIENCE EMOTIONAL SHIFT like from managing to moving freely]` — the transformation the ad promises (emotional, not functional)
- `[AUDIENCE TRIGGER DETAIL like the sleeveless dress she no longer reaches for]` — the specific everyday image detail that speaks directly to their life
- `[AUDIENCE ASPIRATIONAL IDENTITY like someone who moves without thinking about it]` — the self-identity the ad invites them into

  > These tokens never get auto-filled by the app — they are intentionally
  > left for the prompt writer to populate from the product's audience
  > intelligence before generating. They shape person casting, setting,
  > gesture, and expression so the image resonates with the real viewer.

### Misc
- `[MOOD]` — 3 adjectives (e.g. "warm, luminous, confident")
- `[FLAG EMOJI like 🇺🇸]` — market flag
- `[TRUST BADGE like "100% MONEY BACK / 90 DAYS"]`

---

## Step 3 — Output format

Produce exactly this structure (copy-paste ready for the admin UI):

```
TEMPLATE READY — copy into Admin → Templates → [Create New / Edit]

──────────────────────────────────────────
Name:           [Descriptive Name]
Category:       [one of the 9 categories above]
Aspect Ratio:   [1:1 | 4:5 | 9:16 | 16:9 | 3:4]
──────────────────────────────────────────
Prompt:

Use the attached images as brand reference. Match exact product colors,
typography style, and brand tone precisely. [Rest of your prompt here…]
──────────────────────────────────────────

PLACEHOLDERS USED: [comma list of every [TOKEN] in the prompt]
PLACEHOLDERS LEFT FOR USER: [any promotional/campaign tokens that need manual fill]

SCENE NARRATIVE: [1 sentence — the emotional moment or life context this
arrangement is communicating. E.g. "Product tucked into a packed hospital bag
— essential, trusted, and ready to go."]

AUDIENCE PSYCHOLOGY:
  Person:              [Who this viewer is — specific, not a label]
  Daily reality:       [What they live with emotionally/physically before the ad]
  Internal monologue:  [What they tell themselves about the problem]
  Emotional shift:     [What the ad promises to change — feeling, not feature]
  Trigger detail:      [The specific image element that speaks directly to their life]
  Aspirational self:   [The identity the ad invites them to claim]

WHY THIS LAYOUT WORKS (2-3 sentences explaining the ad formula so future
editors know what the template is trying to do, including what emotional job
the scene narrative and audience psychology casting are doing):
[Your explanation]
```

If the uploaded image contains multiple distinct ad formats or crops, produce
one template record for each (clearly labelled).

---

## What makes a good template

A good template is *format-agnostic but structurally specific*. It should work
for Flex & Fine (joint supplement) just as well as for Balaayah Body Oil — the
only things that change are the values the placeholder tokens resolve to.

Ask yourself: if someone with zero knowledge of the reference image ran this
template against a completely different product, would the output still look like
a coherent, deliberate ad? If yes, the template is solid. If it would only work
for the specific product shown, there's too much hardcoded content.

---

## Edge cases

- **Image is a UGC or native-style ad**: Don't sanitize it into something
  polished. Capture the grain, the iPhone-mirror-selfie energy, the candid
  framing — that's the whole point of the format.

- **Image has text that's brand-specific** (actual product claims, actual review
  text): Replace with the appropriate placeholder. Never hardcode specific copy
  into a template.

- **Image has no discernible product** (pure lifestyle, pure pattern): Focus on
  the visual composition and leave product placement guidance open: "lower-left
  quarter reserved for [YOUR PRODUCT], slightly out of focus."

- **Image is a competitor ad**: Describe the layout formula, not brand-specific
  attributes. The template should be usable by TAE, not the competitor.

- **Reference ad is product-only with no people**: Write the explicit
  prohibition — *"No people, hands, faces, or body parts — product and props
  only."* — as a standalone sentence near the end of the prompt. Never rely on
  simply not mentioning people; image models fill compositional space with
  humans by default. The prohibition must be stated out loud. Also: do not
  include any `[AUDIENCE PERSON]` or related audience psychology tokens in a
  product-only template — those tokens exist specifically for ads that feature
  human subjects.

- **Reference product has a different form factor from TAE products**: This is
  the most common cross-contamination mistake. If the reference shows a face
  cream *tub* but the template will be applied to an eye cream *tube*, or the
  reference shows a *glass dropper bottle* but TAE's product is a *pump
  dispenser* — never carry the reference container shape into the prompt. Use
  `[YOUR PRODUCT with key packaging details]` unconditionally. The form factor
  of the *reference* product is irrelevant; the template must work for the
  *actual* product it will be applied to. Same rule applies to multi-unit packs,
  sachets, ampoules, stick formats, and any other packaging type.
