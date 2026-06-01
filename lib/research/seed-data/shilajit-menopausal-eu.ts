/**
 * Seed data: Shilajit — Menopausal Women 45-65+ — UK/EU
 *
 * Source: "UX Research Study: The Inner World of Menopausal Women"
 * Prepared for The Ayurveda Experience, HERBIUS Shilajit Positioning Strategy
 * April 2026 | Confidential
 *
 * All verbatim quotes are reproduced exactly as they appear in the source
 * document. No quote has been invented or paraphrased.
 */

import type { PositioningResearch } from '../types';

export const shilajitMenopausalEU: PositioningResearch = {
  product_name: 'Shilajit',
  brand: 'The Ayurveda Experience',
  market: 'UK/EU',
  segment: 'Menopausal Women 45-65+',
  research_type: 'hybrid',
  generated_at: '2026-04-01T00:00:00.000Z',

  executive_summary:
    'This research study maps the complete emotional, physical, psychological, and social landscape of women aged 45-65+ going through perimenopause, menopause, and post-menopause in the UK and Europe. It is built from hundreds of real women\'s voices extracted from Reddit communities (r/menopause, r/perimenopause, r/menopauseuk), healthcare forums, patient narratives, and academic qualitative studies. The findings reveal a target audience that is simultaneously desperate for solutions and deeply skeptical of marketing promises. These women are intelligent, research-driven, and emotionally raw. They have been dismissed by doctors, invisible to society, and abandoned by a healthcare system that treats menopause as a footnote rather than a life-altering transition. For Shilajit positioning, this study identifies the exact emotional triggers, language patterns, trust markers, fears, desires, and micro-personas that will determine whether our messaging lands as authentic or gets dismissed as another predatory supplement ad.',

  key_stats: [
    '85% of menopausal women report fatigue as their dominant symptom; energy is the #1 unmet need',
    'Women spend $150-300/month on supplements with mixed results; they are actively searching but deeply skeptical',
    'Shilajit has low awareness in menopause communities compared to ashwagandha, black cohosh, and HRT',
    'The positioning opportunity is to own the energy/vitality conversation with credibility, not hype',
    'UK/EU women have different healthcare contexts, supplement attitudes, and cultural framings than US women',
    '95% of perimenopausal women report fatigue',
    '73% of women blame menopause for marriage breakdown',
    '44% of UK women wait 1+ year for diagnosis',
    '70% experience musculoskeletal/joint pain',
    '60%+ experience brain fog and cognitive decline',
    '59% of UK regions have NO NHS menopause clinics',
    'Almost 1 million UK women left jobs due to menopause',
    'Only 27% of menopausal women access HRT',
  ],

  personas: [
    {
      archetype_name: 'The Desperate Searcher',
      age_range: '44-52',
      location: 'UK (London, Manchester, Bristol)',
      tagline:
        '3am Google warrior. She is terrified, exhausted, and trying to understand what is happening to her body.',
      verbatim_quotes: [
        "I'm perimenopausal and holy what the ever-loving f—, my anxiety has gone through the roof",
        'I felt tempted to check myself into psychiatric care',
        'So many doctors and none mentioned menopause once',
        "Looking back it seems crazy that the penny hadn't dropped",
        'Not sure I can get out of bed today',
        'An alien had taken over my body',
        'I had genuine concerns I was losing my mind',
        "I literally had this feeling of like, I don't know who I am anymore",
        "It doesn't just slap you, it slowly grazes. Then all of a sudden gives you a punch.",
        'Your heart races, your chest tightens, and you feel sure something terrible is about to happen. But nothing is wrong.',
        'I never had anxiety until menopause hit hard. Extreme hot flashes and then severe anxiety and panic attacks out of nowhere!',
        'Jolting awake with a sense of impending doom',
      ],
      core_characteristics: [
        'Highly intelligent but currently doubting her own sanity',
        'Research-driven: will read 20 Reddit threads before buying anything',
        'Has tried magnesium, B vitamins, and cutting alcohol with limited success',
        'Desperate for someone to NAME what is happening to her',
        'Active on Reddit, menopause forums, and Facebook support groups',
        "Oscillates between 'I can handle this' and 'I am falling apart'",
      ],
      deepest_fears: [
        'That this is permanent and she will never feel like herself again',
        'That she is developing early-onset dementia',
        'That her marriage will collapse because of her rage and withdrawal',
        'That colleagues will notice her cognitive decline and she will lose professional credibility',
        'That she will be dismissed by another doctor who tells her it is just stress',
      ],
      deepest_desires: [
        "To hear the words: 'This is perimenopause. You are not crazy. It is temporary.'",
        'To wake up one morning feeling rested and clear-headed',
        'To make it through a workday without brain fog or rage',
        'Finding a community of women who understand and validate her experience',
        'A product or treatment that gives her even 30% of her energy back',
      ],
      emotional_triggers: [
        {
          label: 'Validation',
          description:
            "Content that names her exact experience makes her stop scrolling. 'You are not losing your mind' is the most powerful sentence in menopause marketing.",
        },
        {
          label: 'Peer stories',
          description:
            'Testimonials from women who describe the SAME symptoms and found relief.',
        },
        {
          label: 'Science with warmth',
          description:
            'She wants evidence, not hype. But delivered with empathy, not clinical coldness.',
        },
        {
          label: '3am content',
          description:
            'She is awake and searching. Content that meets her in that vulnerable moment builds deep trust.',
        },
      ],
    },
    {
      archetype_name: 'The NHS Warrior',
      age_range: '48-56',
      location: 'UK (Nationwide, especially outside London/Surrey)',
      tagline:
        'Exhausted from fighting the system. She has been dismissed, waitlisted, and is now taking matters into her own hands.',
      verbatim_quotes: [
        "The GP said it is natural and I have to put up with it and they can't do anything",
        "I think you're just depressed because you're not having hot flushes",
        'Women would repeatedly come away from their GP feeling increasingly abandoned, unsupported',
        "I took my HRT prescription to the pharmacy and was told they didn't have it and couldn't order it",
        'I had to drive to three pharmacies to find stock',
      ],
      core_characteristics: [
        'Resourceful and persistent but emotionally drained from the fight',
        'May have tried 5+ GP appointments with zero adequate support',
        'Is becoming her own health advocate out of necessity, not choice',
        'Reads r/menopauseuk and Menopause Matters forums regularly',
        'May be rationing HRT prescriptions due to supply shortages',
        'Increasingly open to supplements as a bridge or alternative to inaccessible HRT',
        'Budget-conscious but willing to pay if she trusts the solution',
      ],
      deepest_fears: [
        'That she will spend years fighting the system and never get proper treatment',
        'That the HRT shortage will continue and she will be left untreated',
        'Being forced to choose between private healthcare she cannot afford and suffering',
        'That her symptoms are real but the system has decided she does not matter',
        'Losing her job because symptoms are unmanaged and she cannot get workplace support',
      ],
      deepest_desires: [
        'A GP who actually listens, validates, and offers treatment options',
        'Accessible, affordable solutions that do not require GP gatekeeping',
        'Energy to make it through the workday without relying on adrenaline and coffee',
        'Feeling that the system recognizes menopause as a serious health matter',
        'Control over her own health journey after years of being denied it',
      ],
      emotional_triggers: [
        {
          label: 'Accessibility',
          description:
            'Products available without prescription or GP referral instantly win attention.',
        },
        {
          label: 'Bypass the system',
          description:
            "'Take control of your own health' messaging resonates deeply with women failed by NHS.",
        },
        {
          label: 'Value for money',
          description:
            'She is already spending on private consults. Clear pricing, transparent ingredients, no hidden costs.',
        },
        {
          label: 'Anti-hype',
          description:
            'She has been lied to by doctors. She will not tolerate marketing lies either. Honesty is the only currency.',
        },
      ],
    },
    {
      archetype_name: 'The Invisible Executive',
      age_range: '48-57',
      location: 'UK/Europe (Urban, Professional)',
      tagline:
        'Senior in her career but quietly falling apart. She cannot tell anyone at work that she is struggling.',
      verbatim_quotes: [
        "I am not performing as well as I used to... Would they think they ought to have somebody younger?",
        'We just plough on... there is that sort of suck it up mentality',
        'I had two personas: one motivating and encouraging at work, the other who went home and curled up in a ball on the sofa',
        'Some of my male colleagues I could just make them shrivel up and die if I started talking about female problems',
        "Can't hold a train of thought in meetings anymore",
      ],
      core_characteristics: [
        'Maintains a professional facade at enormous personal cost',
        'Highly competent but terrified of cognitive decline becoming visible',
        'Uses caffeine and willpower as primary coping mechanisms',
        'Will research solutions privately and discreetly; values branding that looks professional, not fringe',
        'May have financial resources but no time or energy to navigate the supplement market',
        'Values efficiency: wants one solution, not a 12-supplement stack',
      ],
      deepest_fears: [
        'Being discovered: colleagues or direct reports noticing her cognitive decline',
        'Career derailment: being passed over, sidelined, or managed out because of age/symptoms',
        'That brain fog is permanent and she is watching her competence dissolve',
        "Becoming the office 'joke' or the target of menopause 'banter'",
        'That her identity as a capable, respected professional is slipping away',
      ],
      deepest_desires: [
        'To feel sharp, focused, and energised during the workday',
        'A supplement that genuinely improves cognition and energy without side effects',
        'To continue her career trajectory without menopause derailing it',
        'Simple, discreet solutions that fit into her morning routine',
        'To stop dreading Monday mornings',
      ],
      emotional_triggers: [
        {
          label: 'Cognitive framing',
          description:
            "'Brain fog' and 'mental clarity' are her trigger words. Lead with cognitive performance, not hot flashes.",
        },
        {
          label: 'Professional aesthetic',
          description:
            'Premium, clean branding. She will not buy anything that looks like a wellness influencer product.',
        },
        {
          label: 'Efficiency',
          description:
            "'One scoop. That's it.' She does not have bandwidth for complex supplement regimes.",
        },
        {
          label: 'Discretion',
          description:
            "Subscription delivery. Minimal packaging. Nothing that screams 'menopause supplement' on her desk.",
        },
      ],
    },
    {
      archetype_name: 'The Natural Sceptic',
      age_range: '50-60',
      location: 'Germany, Netherlands, Italy, France',
      tagline:
        'Prefers natural approaches. Skeptical of pharmaceuticals. But also increasingly skeptical of supplement marketing hype.',
      verbatim_quotes: [
        'Natural does not mean side-effect free, I know that now',
        'I have tried black cohosh, red clover, sage, evening primrose... some help a little, nothing enough',
        'Just because it is natural does not mean it is safe',
        'I prefer to manage this naturally but I am running out of patience',
        'Women are being preyed upon by profiteering marketers — I read that in Harvard Health and I believe it',
      ],
      core_characteristics: [
        'Well-informed about ingredients, mechanisms, and limitations of herbal remedies',
        'Reads labels, checks certifications, compares ingredient lists across brands',
        'May have a naturopath or integrative doctor she trusts',
        'Resistant to aggressive marketing; turned off by before/after testimonials and urgency tactics',
        'Values cultural heritage of natural medicine (especially German, Italian, Dutch traditions)',
        'Price-aware but willing to pay premium for verified quality and third-party testing',
      ],
      deepest_fears: [
        'Wasting money on another empty promise disguised as natural health',
        'Being judged as unscientific or gullible for choosing natural over pharmaceutical',
        'That her symptoms are too severe for natural approaches but she does not want HRT',
        'That the supplement industry is as corrupt as Big Pharma, just with better branding',
        'Missing the window for effective treatment while she experiments',
      ],
      deepest_desires: [
        'A natural product with genuine clinical evidence (not just marketing claims)',
        'Transparent sourcing: where the ingredients come from, how they are tested, what the purity levels are',
        'Feeling that her natural health philosophy is respected, not exploited',
        'Gradual, sustainable improvement in energy and cognition rather than overnight miracles',
        'Finding a brand that admits its limitations honestly',
      ],
      emotional_triggers: [
        {
          label: 'Third-party certification',
          description:
            'USP, NSF, Clean Label Project logos are her instant trust signals.',
        },
        {
          label: 'Ingredient transparency',
          description:
            'Show her the Certificate of Analysis. Show her the sourcing. She will look.',
        },
        {
          label: 'Anti-marketing',
          description:
            'The less it looks like an ad, the more she trusts it. Educational content wins.',
        },
        {
          label: 'Cultural resonance',
          description:
            'In Germany/Italy, frame as traditional wisdom validated by modern science. In Netherlands, frame as integrative wellness.',
        },
      ],
    },
    {
      archetype_name: 'The Relationship Mourner',
      age_range: '47-58',
      location: 'UK/Europe',
      tagline:
        'Menopause is destroying her marriage. She feels guilty, disconnected, and does not know how to bridge the gap.',
      verbatim_quotes: [
        'Friends? Supported. Partner? Not so much... but I forgive him. Males will never understand.',
        'He is not a particularly sympathetic person and tends to take my behaviour personally',
        'Lost my sex drive and my marriage is in danger',
        'When someone isolates themselves and becomes a different person, their partner is left watching, unable to fix it',
        'I feel the menopause has greatly affected my relationship with my husband',
        "I'd go from 0-100 in a millisecond, feel totally out of control with my emotions and would get so angry my body would shake",
        'My mood swings started to become like a pendulum: going back and forth gently and then bam, it would get stuck on anger for 3-4 days a month',
        'About every seven to 10 days, I would have a crying jag that I could not explain',
      ],
      core_characteristics: [
        'Carries deep guilt about the impact on her partner and family',
        "May feel 'touched out' — physical contact feels overstimulating rather than comforting",
        'Oscillates between wanting connection and needing isolation',
        'Searches for solutions that might restore her libido or at least her energy for connection',
        'May be in a crisis point where the relationship is actively at risk',
        'Keeps the deepest pain private even from close friends',
      ],
      deepest_fears: [
        'That her partner will leave because she has become a different person',
        'That her libido will never return and she will never enjoy intimacy again',
        'That she is fundamentally broken and no treatment will fix the emotional distance',
        'That her children can feel the tension and it is damaging them',
        'Growing old alone if the marriage fails',
      ],
      deepest_desires: [
        'Feeling desire again — not obligation, but genuine wanting',
        'Having the energy to be present with her family rather than withdrawn on the sofa',
        'Her partner understanding that this is hormonal, not personal',
        'Waking up feeling rested enough to engage with life and love',
        'A product that helps her feel like herself so she can reconnect from a place of wholeness',
      ],
      emotional_triggers: [
        {
          label: 'Energy for connection',
          description:
            "She does not search for 'libido supplements.' She searches for 'energy to get through the day.' Energy enables reconnection.",
        },
        {
          label: 'Indirect intimacy messaging',
          description:
            'Never lead with sex. Lead with vitality, warmth, feeling alive. The intimacy follows naturally.',
        },
        {
          label: 'Partner-inclusive content',
          description:
            'Content that helps partners understand menopause builds enormous loyalty.',
        },
        {
          label: 'Guilt-free framing',
          description:
            "'This is not your fault. It is hormonal. And it can get better.' Remove the self-blame.",
        },
      ],
    },
    {
      archetype_name: 'The Active Refuser',
      age_range: '50-62',
      location: 'UK/Europe (Suburban/Rural)',
      tagline:
        "She refuses to 'just accept it.' She runs, cycles, climbs rocks, and is furious that her body is slowing down.",
      verbatim_quotes: [
        "I refuse to just accept it — I'm not done yet",
        "My joints ache like I'm 80. I'm 52.",
        'I used to bounce back from a 10k in a day. Now I need three days.',
        'I want to be fit and I will not let menopause take that from me',
        "One day you're leaping out of bed like a kid on a trampoline, and the next, every joint and muscle in your body seems to ache",
        'Not like busy-day tired, but bone-deep, I-can-not-function tired',
        'No amount of coffee helps',
        'A switch gets flipped — sudden, intense, disproportionate to activity level',
        "I'm only 53 and didn't want to go through life feeling tired",
      ],
      core_characteristics: [
        'Identity is deeply tied to physical performance and capability',
        'Disciplined: has a routine, tracks her workouts, monitors her nutrition',
        'Already takes multiple supplements (magnesium, omega-3, protein, collagen)',
        'Open to adding products if they demonstrably improve energy or recovery',
        'Values products endorsed by sports/fitness community, not wellness influencers',
        'Competitive with her former self and determined to close the performance gap',
      ],
      deepest_fears: [
        'Being forced to stop exercising because of pain, fatigue, or injury',
        "Losing the identity of being 'the active one' in her friend group",
        'The cascade: joint pain reduces exercise, less exercise means weight gain, weight gain stresses joints more',
        'Becoming dependent on others for physical tasks she always handled herself',
        'That the decline is accelerating and she cannot outrun it',
      ],
      deepest_desires: [
        'To feel strong and capable in her body again',
        'Joint mobility and reduced stiffness — she would pay premium for this',
        'Sustained energy through afternoon training sessions',
        'The satisfaction of completing a challenging physical activity without pain',
        'Proving that age is not a barrier to the life she wants to live',
      ],
      emotional_triggers: [
        {
          label: 'Performance language',
          description:
            "She responds to 'fuel,' 'recovery,' 'endurance,' 'resilience.' Not 'menopause symptom relief.'",
        },
        {
          label: 'Anti-aging-as-decline',
          description:
            'Never frame as managing decline. Frame as optimising performance at every age.',
        },
        {
          label: 'Joint and mobility focus',
          description:
            "Shilajit's anti-inflammatory properties map directly to her #1 pain point.",
        },
        {
          label: 'Community',
          description:
            'She wants to see other active women over 50 using the product. Not passive consumers — athletes, hikers, runners.',
        },
      ],
    },
    {
      archetype_name: 'The Quiet Accepter',
      age_range: '55-65+',
      location: 'UK/Europe (Small town, rural)',
      tagline:
        "She does not make a fuss. She has accepted menopause as just part of getting older. But she is quietly suffering more than she admits.",
      verbatim_quotes: [
        "Women suffer in silence... it is socially unacceptable for women to admit they are getting older!",
        "I'd never even heard the word perimenopause until I spoke to a nurse",
        "We just get on with it, don't we?",
        'It is what it is. My mum never talked about it. I do not either.',
        'I feel like you become withdrawn from family members, friends, social life',
        'There is a kind of sense of loss. From this point on I might never have another child.',
        'It was like a period of bereavement... very similar in many ways to a bereavement, the menopause.',
        'Sad. Sad because I thought you have lost one of your main reasons as a woman, your womb.',
        'I felt very different, as though I had lost myself somewhere',
      ],
      core_characteristics: [
        'Stoic, resilient, and deeply uncomfortable talking about her body',
        '73% of women like her rely on over-the-counter remedies only',
        'May not connect symptoms (fatigue, joint pain, poor sleep) to menopause',
        'Trusts pharmacist recommendations over internet research',
        'Purchases in-store (Boots, Tesco health aisle) not online',
        'Will not respond to aggressive digital marketing or bold menopause messaging',
        'Most likely to buy something positioned as general wellness, not menopause-specific',
      ],
      deepest_fears: [
        'Being a burden to her family or appearing weak',
        'That talking about her symptoms will make her seem old or complaining',
        'Cognitive decline that she quietly notices but does not mention',
        'Being patronised or pitied if she admits she is struggling',
        'That her quiet suffering is damaging her health more than she knows',
      ],
      deepest_desires: [
        'To feel energised enough to enjoy her garden, her grandchildren, her walks',
        'Better sleep — waking up actually feeling rested',
        'Joint comfort that lets her stay active without wincing',
        'A simple daily ritual that makes her feel a bit better without making a fuss',
        'To maintain her independence and capability for as long as possible',
      ],
      emotional_triggers: [
        {
          label: 'Stealth positioning',
          description:
            'NEVER label this a menopause product for her. Position as daily vitality, energy, joint support. She will find it in the health aisle.',
        },
        {
          label: 'Pharmacist channel',
          description:
            "Boots/Lloyd's Pharmacy recommendations carry immense weight. She trusts white coats, not Instagram.",
        },
        {
          label: 'Simplicity',
          description:
            'One product. One scoop. No explanation needed. No confronting language.',
        },
        {
          label: 'Gentle proof',
          description:
            "Quiet testimonials from women her age: 'I just have a bit more energy for the things I love.' No drama.",
        },
      ],
    },
  ],

  emotional_landscape: {
    emotional_cycle: [
      {
        stage: 'Confusion and Denial',
        description:
          'The first response to perimenopause symptoms is almost always denial. Women assume it is stress, overwork, poor diet, or mental illness. They do not connect symptoms to hormones because nobody told them to expect this. The average delay from first symptom to perimenopause recognition is 4-5 years.',
      },
      {
        stage: 'Terror and Panic',
        description:
          'When symptoms escalate (brain fog, anxiety attacks, rage), women become genuinely frightened. The most common fear is that they are developing dementia, having a mental breakdown, or dying. The 3am anxiety episodes produce authentic terror: racing heart, chest tightness, sense of impending doom with no external trigger.',
      },
      {
        stage: 'Rage and Frustration',
        description:
          'The rage is multi-layered: rage at symptoms, rage at doctors who dismiss them, rage at a society that makes menopause invisible, rage at partners who do not understand, and underneath it all, rage at the unfairness that this massive life event has zero cultural infrastructure. This is not hormonal instability. It is a completely rational response to being abandoned by the systems that were supposed to help.',
      },
      {
        stage: 'Grief and Mourning',
        description:
          'Women mourn their former selves, their energy, their sharp minds, their youthful bodies, their fertility (even if unwanted), their visibility in society, and their sense of control. This grief is real, not melodramatic. It uses bereavement language because it IS bereavement.',
      },
      {
        stage: 'Isolation and Withdrawal',
        description:
          '73% of women blame menopause for relationship breakdown. But beyond romantic relationships, women withdraw from friendships, social events, and workplace interactions. The exhaustion, the shame, and the feeling of being fundamentally different from who they were drives isolation.',
      },
      {
        stage: 'Defiance and Determination',
        description:
          "This is the turning point. After grief, many women enter a fierce determination to fight back. They research obsessively, join online communities, change doctors, try new treatments, and refuse to accept that this is 'just how it is.' This is when they become most receptive to solutions.",
      },
      {
        stage: 'Acceptance and Liberation',
        description:
          'Women who find effective treatment or community support describe reaching a place of unprecedented authenticity. They stop people-pleasing. They speak truth. They set boundaries. They describe the post-menopause period as the most honest and free phase of their lives. But this stage is only reached by women who got adequate support along the way.',
      },
    ],
    universal_turn_offs: [
      "Overpromising: 'Balance your hormones naturally!' — they have heard this 100 times and it is always a lie",
      'Targeting desperation without evidence: predatory marketing that exploits their vulnerability',
      'Pink-washing: stereotypical feminine branding that reduces menopause to hot flashes and mood swings',
      "Youth worship: 'Turn back the clock' messaging. They do not want to be 25 again. They want to feel functional at 55.",
      'Dismissive tone: Anything that minimises their experience. Even gentle minimisation is detected instantly.',
      'Medical claims without citations: Unproven claims are not just annoying; they feel dangerous.',
      'Influencer-driven marketing: They know influencers have financial stake. Doctor endorsement > influencer endorsement.',
      "Urgency tactics: 'Only 3 left!' makes European women cringe. Urgency is for US audiences, not UK/EU.",
    ],
    universal_desires: [
      "Honest acknowledgment: 'This is hard. You are not imagining it. Here is what we know and what we do not know.'",
      'Community voice: Real women sharing real stories in their own words. Not polished testimonials — raw truth.',
      'Education first, product second: Teach them something useful before asking for a purchase. Build trust through knowledge.',
      "Transparent evidence: 'A 2021 randomised trial showed...' with dosage, duration, and honest limitations.",
      'Empathy without pity: Warm, intelligent, respectful tone. Like a knowledgeable friend, not a doctor lecturing down.',
      'Energy as the gateway: Energy is the universal unmet need. Lead every conversation with energy, not menopause symptoms.',
      'Simplicity: One product, one scoop, no complex regime. She is cognitively overwhelmed already.',
      'Premium but fair pricing: She will pay for quality. She will not pay for hype.',
    ],
  },

  language_guide: {
    words_she_uses: [
      'Bone-deep tired',
      'Running on empty',
      'Crashing fatigue',
      'Switch gets flipped',
      'Cotton wool brain',
      'Losing words',
      "Can't hold a thought",
      'Mind goes blank',
      '0 to 100',
      'Volcanic',
      'Body shakes',
      'Out of control',
      'Who IS this person',
      "Like I'm 80",
      'Every joint aches',
      "Can't bounce back",
      'Stiff and slow',
      'Not myself',
      'Alien in my body',
      'Lost somewhere',
      'Who am I now',
      '3am',
      'Racing heart',
      'Doom',
      "Can't switch off",
      'Exhausted but wired',
      'Looked through',
      'Sidelined',
      'Past it',
      'Invisible',
      'Irrelevant',
      'NFLM',
    ],
    sounds_familiar: [
      'The alarm at 6:30am that she desperately wants to snooze (but guilt will not let her)',
      'The kettle boiling for the second (third, fourth) coffee that still will not wake her up',
      'The 3am silence broken only by her racing heartbeat',
      'The shower running as the only private space where she can cry',
      'The phone notification sounds from work emails she cannot face',
      "Children's voices calling 'Mum!' when she has no capacity left to respond",
      'The creak of joints as she stands up from a chair',
      'The sigh she lets out when she sits down after a long day',
    ],
    ad_hook_mapping: [
      {
        hook: '3am late night searches',
        emotional_territory: 'Terror, isolation, validation-seeking — The Desperate Searcher',
      },
      {
        hook: 'Coffee replacement / exhaustion',
        emotional_territory: 'Bone-deep fatigue, cycle-breaking — NHS Warrior, Invisible Executive',
      },
      {
        hook: 'Women yelling at kids from exhaustion',
        emotional_territory: 'Guilt, rage, maternal identity crisis — Relationship Mourner',
      },
      {
        hook: 'Shilajit benefits listicle',
        emotional_territory: 'Education-seeking, evidence hunger — Natural Sceptic',
      },
      {
        hook: '80% energy factory / testimonial',
        emotional_territory: 'Hope, proof of concept — All personas (universal)',
      },
      {
        hook: 'Active people / refuse to back down',
        emotional_territory: 'Defiance, identity preservation — Active Refuser',
      },
      {
        hook: 'HRT alternative',
        emotional_territory: 'System frustration, natural preference — NHS Warrior, Natural Sceptic',
      },
      {
        hook: 'GP + many pills vs one scoop',
        emotional_territory: 'Simplicity, control, anti-system — NHS Warrior, Quiet Accepter',
      },
      {
        hook: 'Enhanced intimacy',
        emotional_territory: 'Reconnection desire, guilt relief — Relationship Mourner',
      },
      {
        hook: 'Certificate of Authenticity',
        emotional_territory: 'Trust, anti-scam, quality proof — Natural Sceptic, all EU personas',
      },
    ],
  },

  cultural_context: {
    UK: "NHS menopause care is in crisis: 59% of regions have no clinics, 44% wait 1+ year for diagnosis. HRT shortages are real and devastating: women rationing doses, swapping in parking lots, buying from overseas. Almost 1 million women have left their jobs due to unmanaged menopause symptoms. Only 24% of organisations have a menopause policy. Pharmacist recommendations carry enormous weight: Boots and Lloyd's Pharmacy are trusted channels. Positioning: Bypass NHS, take control. Pharmacist-endorsed, NHS-bypass positioning, community-building through real stories.",
    Germany:
      "48% of women already use complementary and alternative medicine (CAM). Menopause viewed as CAM-friendly rather than purely medical. HRT uptake only 14% (CAM strongly preferred). High supplement trust. Lead with 'complementary and alternative medicine validated by science.' Frame as traditional wisdom validated by modern science. Integrative doctor endorsement essential.",
    France:
      'French women have highest HRT access in EU at 55%. Menopause viewed as medical management issue. Moderate supplement trust. Better GP access and shorter waiting lists than UK. Lead with premium wellness and sophisticated positioning. Quality certification must be prominent. French women expect premium products.',
    Italy:
      '77% view menopause as physiological and normal, not a medical problem. HRT uptake only 7.6% (herbal strongly preferred). High supplement trust: 63% prefer herbal medications. Lead with natural heritage and food-as-medicine philosophy. 77% view menopause as physiological, not medical. Minimal medical framing.',
    Netherlands:
      'Lead with holistic wellness and integrative health. Strong psychological support culture. Frame as integrated mind-body approach with psychological benefit messaging.',
    EU_general:
      'Advertising Standards Authority actively enforces against false supplement claims. Messaging must be legally defensible. Never use urgency tactics (countdown timers, scarcity messaging) — they backfire with European women. Softer urgency, more warmth across all EU markets.',
  },

  supplement_landscape: {
    journey_stages: [
      'Stage 1: Magnesium, Vitamin D, B vitamins (basic, recommended by friends or GP)',
      'Stage 2: Black cohosh, red clover, evening primrose oil (traditional menopause herbs)',
      'Stage 3: Ashwagandha, rhodiola, adaptogens (trending on social media)',
      'Stage 4: Complex supplement stacks (collagen + omega-3 + CoQ10 + specific menopause blends)',
      'Stage 5: Frustration and scepticism (spending $150-300/month with minimal results)',
      'Stage 6: Either HRT adoption or resignation... or open to ONE more thing that feels genuinely different',
    ],
    why_previous_failed: [
      'Marginal improvement at best: some helped a little, nothing enough',
      'Placebo effect wore off after weeks (30% symptom reduction is common with placebo but does not sustain)',
      'No guidance on dosage, timing, or realistic expectations',
      'Conflicting information: every brand claims everything works',
      'No way to distinguish quality products from marketing-driven garbage',
    ],
    positioning_opportunity:
      "Shilajit can own the ENERGY conversation in menopause. While ashwagandha owns 'stress,' black cohosh owns 'hot flashes,' and HRT owns 'hormone replacement,' no natural supplement has claimed the cellular energy territory. Shilajit's mechanism of action (mitochondrial support, mineral delivery, fulvic acid) maps directly to the root cause of menopausal fatigue: cells literally producing less energy. Shilajit has very low awareness in menopause communities — this is both a challenge (she has never heard of it) and an opportunity (she has no pre-existing scepticism or negative associations). The message that could work: 'Your exhaustion is not in your head. It is in your cells. As estrogen drops, your mitochondria produce less energy. Shilajit delivers 85+ minerals and fulvic acid directly to your cells to support the energy production your body needs. Not a quick fix. Not a miracle. Just your cells getting what they need to function.'",
    trust_markers: [
      'Third-party testing certification (USP, NSF, or Clean Label Project)',
      'Certificate of Analysis available on request',
      'Transparent sourcing: where, how, and purity levels',
      'Clinical trial reference with honest limitations stated',
      'Doctor or menopause specialist endorsement',
      "Money-back guarantee (reduces risk of 'wasting money on another empty promise')",
      "No 'hormone balancing' claims (these are unproven and flagged by regulators)",
      '2021 randomised trial: 250-500mg daily showed improved fatigue and vitality over 8 weeks',
    ],
  },

  messaging_framework: {
    'The Desperate Searcher':
      "Lead with validation. 'You are not crazy. You are not lazy. Your cells are starving for energy.' Then introduce Shilajit as the missing mineral delivery system.",
    'The NHS Warrior':
      "Lead with accessibility. 'No GP appointment required. No prescription. No waiting list. Just 85+ minerals delivered to your cells daily.' Frame as taking control.",
    'The Invisible Executive':
      "Lead with cognitive performance. 'Mental clarity in one scoop.' Premium positioning. Discreet subscription. Professional branding.",
    'The Natural Sceptic':
      "Lead with transparency. Certificate of Analysis. Third-party testing. Clinical trial data with honest limitations. 'Here is what we know and what we do not know.' Let her intelligence be respected.",
    'The Relationship Mourner':
      "Lead with vitality and warmth. 'When you have energy, everything else follows: presence, connection, desire.' Never lead with intimacy directly.",
    'The Active Refuser':
      "Lead with performance. 'Recovery. Endurance. Joint mobility. Fuel for women who refuse to slow down.' Sports-adjacent branding. Active women over 50 in creative.",
    'The Quiet Accepter':
      "Do not mention menopause. Position as daily vitality and joint comfort. Simple, gentle, available in the health aisle. 'A bit more energy for the things you love.'",
  },

  creative_principles: [
    'Lead with energy, always. It is the universal unmet need across all personas.',
    "Use her language. Bone-deep tired. Running on empty. Not myself. Cotton wool brain.",
    'Show real women. Not models. Not influencers. Women her age doing the things she wants to do.',
    'Educate before you sell. Build trust through genuine knowledge. The purchase follows.',
    'Be honest about limitations. She will respect honesty more than any promise.',
    'Never use urgency in EU. Countdown timers and scarcity messaging backfire with European women.',
    'Softness in UK. As per brand voice guidelines: softer urgency, more warmth.',
    "The core positioning statement: Shilajit should own the cellular energy territory in the menopause conversation. Not hormone balancing (unproven, regulated). Not symptom management (too broad, too many competitors). ENERGY at the cellular level: your mitochondria need minerals and fulvic acid to produce the energy your depleted hormones can no longer support.",
  ],

  source_methodology:
    'Reddit Community Analysis (r/menopause, r/perimenopause, r/menopauseuk, r/AskWomenOver40, r/TwoXChromosomes), Patient Narratives (MyMenoPlan Women\'s Stories, My Menopause Centre, The Menopause Charity, Rethink Mental Illness, The Female Lead Community, HealthTalk.org), Academic & Clinical Sources (Menopause Journal, Harvard Medical School, Johns Hopkins Medicine, Mayo Clinic, Cleveland Clinic, British Heart Foundation, UK Parliament Women and Equalities Committee, NICE Guidelines, PubMed/PMC peer-reviewed studies), Cultural & Market Research (AARP Mirror/Mirror Study 2025, European Menopause and Andropause Society, UK Government Menopause in the Workplace Literature Review, The Independent Pharmacy European Menopause Index, Balance Menopause NHS research). All verbatim quotes are attributed to their original source context. Where women are anonymous (community discussions), no identifying information is included.',
};
