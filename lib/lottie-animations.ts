/**
 * Premium inline Lottie animations with gradient fills.
 * Uses Bodymovin `gf` (gradient fill) and `gs` (gradient stroke) shape types.
 * Colors are baked into the gradient stop data below as normalized RGB.
 * NOTE: unused since the SVG loading scenes replaced Lottie; colors predate
 * the forest/lime rebrand — re-derive from tailwind brand tokens if revived.
 */

/* ── Easing presets (cubic bezier in/out handles) ── */
const EASE_SMOOTH = { i: { x: [0.4], y: [1] }, o: { x: [0.6], y: [0] } };
const EASE_SMOOTH_2D = { i: { x: [0.4, 0.4], y: [1, 1] }, o: { x: [0.6, 0.6], y: [0, 0] } };
const EASE_SPRING = { i: { x: [0.2], y: [1.4] }, o: { x: [0.7], y: [0] } };
const EASE_SPRING_2D = { i: { x: [0.2, 0.2], y: [1.4, 1.4] }, o: { x: [0.7, 0.7], y: [0, 0] } };

/* ── Gradient helpers ── */
// Radial gradient fill (center outward)
function radialGrad(
  stops: number[],  // [offset, r, g, b, offset, r, g, b, ...]
  numStops: number,
  center: number[] = [0, 0],
  edge: number[] = [50, 0],
  opacity: number = 100,
) {
  return {
    ty: 'gf' as const,
    o: { a: 0, k: opacity },
    r: 2,  // radial
    s: { a: 0, k: center },
    e: { a: 0, k: edge },
    g: { p: numStops, k: { a: 0, k: stops } },
  };
}

// Linear gradient fill
function linearGrad(
  stops: number[],
  numStops: number,
  start: number[] = [0, -50],
  end: number[] = [0, 50],
  opacity: number = 100,
) {
  return {
    ty: 'gf' as const,
    o: { a: 0, k: opacity },
    r: 1,  // linear
    s: { a: 0, k: start },
    e: { a: 0, k: end },
    g: { p: numStops, k: { a: 0, k: stops } },
  };
}

// Base transform for a layer
function baseTransform(
  pos: number[],
  anchor: number[] = [0, 0],
) {
  return {
    o: { a: 0, k: [100] },
    s: { a: 0, k: [100, 100] },
    p: { a: 0, k: pos },
    a: { a: 0, k: anchor },
    r: { a: 0, k: 0 },
  };
}

/* ═══════════════════════════════════════════════════════
   Animation 1: AURORA ORB
   A luminous central orb with radiating rings that
   breathe in and out with staggered timing.
   ═══════════════════════════════════════════════════════ */
export const auroraOrb = {
  v: '5.7.1', fr: 30, ip: 0, op: 150, w: 200, h: 200,
  layers: [
    // Outer glow ring 3 (largest, faintest)
    {
      ty: 4, nm: 'ring-3', sr: 1, ip: 0, op: 150, st: 0,
      ks: {
        ...baseTransform([100, 100]),
        o: { a: 1, k: [
          { t: 0, s: [12], ...EASE_SMOOTH },
          { t: 75, s: [25], ...EASE_SMOOTH },
          { t: 150, s: [12] },
        ]},
        s: { a: 1, k: [
          { t: 0, s: [100, 100], ...EASE_SMOOTH_2D },
          { t: 75, s: [115, 115], ...EASE_SMOOTH_2D },
          { t: 150, s: [100, 100] },
        ]},
      },
      shapes: [
        { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [160, 160] } },
        radialGrad([
          0, 0.290, 0.620, 0.478,
          0.5, 0.176, 0.392, 0.306,
          1, 0.961, 0.941, 0.902,
        ], 3, [0, 0], [80, 0], 60),
      ],
    },
    // Outer glow ring 2
    {
      ty: 4, nm: 'ring-2', sr: 1, ip: 0, op: 150, st: 0,
      ks: {
        ...baseTransform([100, 100]),
        o: { a: 1, k: [
          { t: 0, s: [20], ...EASE_SMOOTH },
          { t: 60, s: [40], ...EASE_SMOOTH },
          { t: 120, s: [20], ...EASE_SMOOTH },
          { t: 150, s: [25] },
        ]},
        s: { a: 1, k: [
          { t: 0, s: [95, 95], ...EASE_SMOOTH_2D },
          { t: 60, s: [108, 108], ...EASE_SMOOTH_2D },
          { t: 120, s: [95, 95], ...EASE_SMOOTH_2D },
          { t: 150, s: [98, 98] },
        ]},
      },
      shapes: [
        { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [120, 120] } },
        radialGrad([
          0, 0.831, 0.659, 0.325,
          0.4, 0.290, 0.620, 0.478,
          1, 0.176, 0.392, 0.306,
        ], 3, [0, -10], [60, 0], 70),
      ],
    },
    // Inner glow ring 1
    {
      ty: 4, nm: 'ring-1', sr: 1, ip: 0, op: 150, st: 0,
      ks: {
        ...baseTransform([100, 100]),
        o: { a: 1, k: [
          { t: 0, s: [40], ...EASE_SMOOTH },
          { t: 50, s: [70], ...EASE_SMOOTH },
          { t: 100, s: [40], ...EASE_SMOOTH },
          { t: 150, s: [45] },
        ]},
        s: { a: 1, k: [
          { t: 0, s: [100, 100], ...EASE_SPRING_2D },
          { t: 50, s: [110, 110], ...EASE_SPRING_2D },
          { t: 100, s: [100, 100], ...EASE_SPRING_2D },
          { t: 150, s: [102, 102] },
        ]},
      },
      shapes: [
        { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [80, 80] } },
        radialGrad([
          0, 0.961, 0.941, 0.902,
          0.3, 0.831, 0.659, 0.325,
          0.7, 0.290, 0.620, 0.478,
          1, 0.176, 0.392, 0.306,
        ], 4, [5, -8], [40, 0], 90),
      ],
    },
    // Core orb
    {
      ty: 4, nm: 'core', sr: 1, ip: 0, op: 150, st: 0,
      ks: {
        ...baseTransform([100, 100]),
        s: { a: 1, k: [
          { t: 0, s: [100, 100], ...EASE_SMOOTH_2D },
          { t: 40, s: [105, 105], ...EASE_SMOOTH_2D },
          { t: 80, s: [98, 98], ...EASE_SMOOTH_2D },
          { t: 120, s: [103, 103], ...EASE_SMOOTH_2D },
          { t: 150, s: [100, 100] },
        ]},
      },
      shapes: [
        { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [44, 44] } },
        radialGrad([
          0, 1, 1, 1,
          0.3, 0.961, 0.941, 0.902,
          0.7, 0.831, 0.659, 0.325,
          1, 0.290, 0.620, 0.478,
        ], 4, [-4, -6], [22, 0]),
      ],
    },
    // Floating sparkle particles (6 small orbs orbiting)
    ...[0, 1, 2, 3, 4, 5].map((i) => ({
      ty: 4 as const, nm: `sparkle-${i}`, sr: 1, ip: 0, op: 150, st: 0,
      ks: {
        o: { a: 1, k: [
          { t: i * 8, s: [0], ...EASE_SMOOTH },
          { t: i * 8 + 15, s: [90], ...EASE_SMOOTH },
          { t: i * 8 + 60, s: [90], ...EASE_SMOOTH },
          { t: i * 8 + 75, s: [0], ...EASE_SMOOTH },
          { t: 150, s: [0] },
        ]},
        s: { a: 1, k: [
          { t: i * 8, s: [40, 40], ...EASE_SPRING_2D },
          { t: i * 8 + 20, s: [100, 100], ...EASE_SPRING_2D },
          { t: i * 8 + 55, s: [100, 100], ...EASE_SMOOTH_2D },
          { t: i * 8 + 75, s: [40, 40] },
        ]},
        p: { a: 0, k: [100, 100] },
        a: { a: 0, k: [0, 0] },
        r: { a: 1, k: [
          { t: 0, s: [i * 60], ...EASE_SMOOTH },
          { t: 150, s: [i * 60 + 180] },
        ]},
      },
      shapes: [
        { ty: 'el', p: { a: 0, k: [0, -75 + (i % 3) * 5] }, s: { a: 0, k: [8 + (i % 3) * 2, 8 + (i % 3) * 2] } },
        radialGrad([
          0, 1, 1, 0.95,
          0.5, 0.831, 0.659, 0.325,
          1, 0.290, 0.620, 0.478,
        ], 3, [0, 0], [5, 0]),
      ],
    })),
  ],
};

/* ═══════════════════════════════════════════════════════
   Animation 2: LOTUS BLOOM
   Petals that open and close with gradient fills,
   rotating slowly like a breathing mandala.
   ═══════════════════════════════════════════════════════ */
export const lotusBloom = {
  v: '5.7.1', fr: 30, ip: 0, op: 180, w: 200, h: 200,
  layers: [
    // 10 gradient petals
    ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => {
      const angle = i * 36;
      const stagger = i * 4;
      const isGold = i % 3 === 0;
      return {
        ty: 4 as const, nm: `petal-${i}`, sr: 1, ip: 0, op: 180, st: 0,
        ks: {
          o: { a: 1, k: [
            { t: stagger, s: [30], ...EASE_SMOOTH },
            { t: stagger + 45, s: [75], ...EASE_SMOOTH },
            { t: stagger + 90, s: [30], ...EASE_SMOOTH },
            { t: stagger + 135, s: [65], ...EASE_SMOOTH },
            { t: 180, s: [30] },
          ]},
          s: { a: 1, k: [
            { t: stagger, s: [70, 70], ...EASE_SPRING_2D },
            { t: stagger + 45, s: [100, 100], ...EASE_SPRING_2D },
            { t: stagger + 90, s: [75, 75], ...EASE_SPRING_2D },
            { t: stagger + 135, s: [95, 95], ...EASE_SPRING_2D },
            { t: 180, s: [70, 70] },
          ]},
          p: { a: 0, k: [100, 100] },
          a: { a: 0, k: [0, 0] },
          r: { a: 1, k: [
            { t: 0, s: [angle], ...EASE_SMOOTH },
            { t: 180, s: [angle + 20] },
          ]},
        },
        shapes: [
          { ty: 'el', p: { a: 0, k: [0, -35] }, s: { a: 0, k: [18, 48] } },
          linearGrad(
            isGold
              ? [0, 0.961, 0.890, 0.600, 0.5, 0.831, 0.659, 0.325, 1, 0.600, 0.400, 0.150]
              : [0, 0.500, 0.820, 0.650, 0.5, 0.290, 0.620, 0.478, 1, 0.120, 0.320, 0.240],
            3, [0, -55], [0, -15],
          ),
        ],
      };
    }),
    // Glowing center
    {
      ty: 4, nm: 'center-glow', sr: 1, ip: 0, op: 180, st: 0,
      ks: {
        ...baseTransform([100, 100]),
        s: { a: 1, k: [
          { t: 0, s: [100, 100], ...EASE_SMOOTH_2D },
          { t: 60, s: [112, 112], ...EASE_SMOOTH_2D },
          { t: 120, s: [96, 96], ...EASE_SMOOTH_2D },
          { t: 180, s: [100, 100] },
        ]},
        o: { a: 1, k: [
          { t: 0, s: [60], ...EASE_SMOOTH },
          { t: 60, s: [90], ...EASE_SMOOTH },
          { t: 120, s: [55], ...EASE_SMOOTH },
          { t: 180, s: [60] },
        ]},
      },
      shapes: [
        { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [30, 30] } },
        radialGrad([
          0, 1, 1, 0.95,
          0.4, 0.961, 0.890, 0.600,
          1, 0.831, 0.659, 0.325,
        ], 3, [0, -2], [15, 0]),
      ],
    },
  ],
};

/* ═══════════════════════════════════════════════════════
   Animation 3: LIQUID WAVE
   Smooth blobs that morph and flow with gradient fills,
   like an Ayurvedic oil being mixed.
   ═══════════════════════════════════════════════════════ */
export const liquidWave = {
  v: '5.7.1', fr: 30, ip: 0, op: 150, w: 200, h: 200,
  layers: [
    // Large background blob
    {
      ty: 4, nm: 'blob-bg', sr: 1, ip: 0, op: 150, st: 0,
      ks: {
        ...baseTransform([100, 105]),
        o: { a: 1, k: [
          { t: 0, s: [25], ...EASE_SMOOTH },
          { t: 75, s: [40], ...EASE_SMOOTH },
          { t: 150, s: [25] },
        ]},
        s: { a: 1, k: [
          { t: 0, s: [100, 95], ...EASE_SMOOTH_2D },
          { t: 38, s: [95, 105], ...EASE_SMOOTH_2D },
          { t: 75, s: [105, 98], ...EASE_SMOOTH_2D },
          { t: 113, s: [98, 103], ...EASE_SMOOTH_2D },
          { t: 150, s: [100, 95] },
        ]},
        r: { a: 1, k: [
          { t: 0, s: [0], ...EASE_SMOOTH },
          { t: 150, s: [8] },
        ]},
      },
      shapes: [
        { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [140, 130] } },
        radialGrad([
          0, 0.290, 0.620, 0.478,
          0.5, 0.176, 0.392, 0.306,
          1, 0.100, 0.260, 0.200,
        ], 3, [10, -15], [70, 0], 50),
      ],
    },
    // Mid blob (gold-tinted)
    {
      ty: 4, nm: 'blob-mid', sr: 1, ip: 0, op: 150, st: 0,
      ks: {
        ...baseTransform([95, 98]),
        o: { a: 1, k: [
          { t: 0, s: [35], ...EASE_SMOOTH },
          { t: 50, s: [55], ...EASE_SMOOTH },
          { t: 100, s: [30], ...EASE_SMOOTH },
          { t: 150, s: [35] },
        ]},
        s: { a: 1, k: [
          { t: 0, s: [100, 100], ...EASE_SMOOTH_2D },
          { t: 40, s: [110, 92], ...EASE_SMOOTH_2D },
          { t: 80, s: [93, 108], ...EASE_SMOOTH_2D },
          { t: 120, s: [107, 96], ...EASE_SMOOTH_2D },
          { t: 150, s: [100, 100] },
        ]},
        r: { a: 1, k: [
          { t: 0, s: [0], ...EASE_SMOOTH },
          { t: 150, s: [-12] },
        ]},
      },
      shapes: [
        { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 90] } },
        radialGrad([
          0, 0.961, 0.890, 0.600,
          0.4, 0.831, 0.659, 0.325,
          0.8, 0.600, 0.450, 0.200,
          1, 0.290, 0.400, 0.300,
        ], 4, [-5, -10], [50, 0], 70),
      ],
    },
    // Front blob (bright, smaller)
    {
      ty: 4, nm: 'blob-front', sr: 1, ip: 0, op: 150, st: 0,
      ks: {
        ...baseTransform([108, 100]),
        o: { a: 1, k: [
          { t: 0, s: [50], ...EASE_SMOOTH },
          { t: 60, s: [75], ...EASE_SMOOTH },
          { t: 120, s: [45], ...EASE_SMOOTH },
          { t: 150, s: [50] },
        ]},
        s: { a: 1, k: [
          { t: 0, s: [100, 100], ...EASE_SMOOTH_2D },
          { t: 30, s: [108, 94], ...EASE_SMOOTH_2D },
          { t: 60, s: [95, 106], ...EASE_SMOOTH_2D },
          { t: 90, s: [104, 97], ...EASE_SMOOTH_2D },
          { t: 120, s: [97, 103], ...EASE_SMOOTH_2D },
          { t: 150, s: [100, 100] },
        ]},
        r: { a: 1, k: [
          { t: 0, s: [0], ...EASE_SMOOTH },
          { t: 150, s: [15] },
        ]},
      },
      shapes: [
        { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [65, 58] } },
        radialGrad([
          0, 1, 1, 0.98,
          0.3, 0.900, 0.860, 0.750,
          0.7, 0.500, 0.750, 0.600,
          1, 0.290, 0.620, 0.478,
        ], 4, [-3, -5], [32, 0], 85),
      ],
    },
    // Tiny floating bubbles
    ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
      const angle = i * 45;
      const r = 50 + (i % 3) * 15;
      const px = 100 + Math.cos(angle * Math.PI / 180) * r;
      const py = 100 + Math.sin(angle * Math.PI / 180) * r;
      const sz = 6 + (i % 4) * 3;
      const delay = i * 12;
      return {
        ty: 4 as const, nm: `bubble-${i}`, sr: 1, ip: 0, op: 150, st: 0,
        ks: {
          o: { a: 1, k: [
            { t: delay, s: [0], ...EASE_SMOOTH },
            { t: delay + 15, s: [70], ...EASE_SMOOTH },
            { t: delay + 50, s: [70], ...EASE_SMOOTH },
            { t: delay + 70, s: [0], ...EASE_SMOOTH },
            { t: 150, s: [0] },
          ]},
          s: { a: 1, k: [
            { t: delay, s: [30, 30], ...EASE_SPRING_2D },
            { t: delay + 20, s: [100, 100], ...EASE_SPRING_2D },
            { t: delay + 50, s: [95, 95], ...EASE_SMOOTH_2D },
            { t: delay + 70, s: [50, 50] },
          ]},
          p: { a: 1, k: [
            { t: delay, s: [px, py], ...EASE_SMOOTH },
            { t: delay + 70, s: [px + (i % 2 === 0 ? 8 : -8), py - 15] },
          ]},
          a: { a: 0, k: [0, 0] },
          r: { a: 0, k: 0 },
        },
        shapes: [
          { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [sz, sz] } },
          radialGrad([
            0, 1, 1, 0.95,
            0.5, 0.831, 0.659, 0.325,
            1, 0.290, 0.620, 0.478,
          ], 3, [-1, -1], [sz / 2, 0]),
        ],
      };
    }),
  ],
};

/* ═══════════════════════════════════════════════════════
   Animation 4: CONSTELLATION
   Dots connected by fading lines, pulsing and drifting
   like stars being painted into an ad.
   ═══════════════════════════════════════════════════════ */
export const constellation = {
  v: '5.7.1', fr: 30, ip: 0, op: 180, w: 200, h: 200,
  layers: [
    // Central nucleus with rich gradient
    {
      ty: 4, nm: 'nucleus', sr: 1, ip: 0, op: 180, st: 0,
      ks: {
        ...baseTransform([100, 100]),
        s: { a: 1, k: [
          { t: 0, s: [100, 100], ...EASE_SMOOTH_2D },
          { t: 45, s: [108, 108], ...EASE_SMOOTH_2D },
          { t: 90, s: [96, 96], ...EASE_SMOOTH_2D },
          { t: 135, s: [104, 104], ...EASE_SMOOTH_2D },
          { t: 180, s: [100, 100] },
        ]},
      },
      shapes: [
        { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [36, 36] } },
        radialGrad([
          0, 1, 1, 0.97,
          0.25, 0.961, 0.890, 0.600,
          0.6, 0.831, 0.659, 0.325,
          1, 0.176, 0.392, 0.306,
        ], 4, [-3, -4], [18, 0]),
      ],
    },
    // Aura glow
    {
      ty: 4, nm: 'aura', sr: 1, ip: 0, op: 180, st: 0,
      ks: {
        ...baseTransform([100, 100]),
        o: { a: 1, k: [
          { t: 0, s: [20], ...EASE_SMOOTH },
          { t: 90, s: [40], ...EASE_SMOOTH },
          { t: 180, s: [20] },
        ]},
        s: { a: 1, k: [
          { t: 0, s: [100, 100], ...EASE_SMOOTH_2D },
          { t: 90, s: [115, 115], ...EASE_SMOOTH_2D },
          { t: 180, s: [100, 100] },
        ]},
      },
      shapes: [
        { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [90, 90] } },
        radialGrad([
          0, 0.831, 0.659, 0.325,
          0.4, 0.290, 0.620, 0.478,
          1, 0.176, 0.392, 0.306,
        ], 3, [0, 0], [45, 0], 40),
      ],
    },
    // 8 orbiting star nodes with gradient fills
    ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
      const baseAngle = i * 45;
      const dist = 55 + (i % 3) * 15;
      const sz = 10 + (i % 3) * 4;
      const speed = i % 2 === 0 ? 30 : -25;
      const stagger = i * 6;
      return {
        ty: 4 as const, nm: `star-${i}`, sr: 1, ip: 0, op: 180, st: 0,
        ks: {
          o: { a: 1, k: [
            { t: stagger, s: [30], ...EASE_SMOOTH },
            { t: stagger + 30, s: [90], ...EASE_SMOOTH },
            { t: stagger + 70, s: [90], ...EASE_SMOOTH },
            { t: stagger + 100, s: [30], ...EASE_SMOOTH },
            { t: 180, s: [50] },
          ]},
          s: { a: 1, k: [
            { t: stagger, s: [50, 50], ...EASE_SPRING_2D },
            { t: stagger + 25, s: [110, 110], ...EASE_SPRING_2D },
            { t: stagger + 80, s: [100, 100], ...EASE_SMOOTH_2D },
            { t: stagger + 100, s: [60, 60] },
          ]},
          p: { a: 0, k: [100, 100] },
          a: { a: 0, k: [0, 0] },
          r: { a: 1, k: [
            { t: 0, s: [baseAngle], ...EASE_SMOOTH },
            { t: 180, s: [baseAngle + speed] },
          ]},
        },
        shapes: [
          { ty: 'el', p: { a: 0, k: [0, -dist] }, s: { a: 0, k: [sz, sz] } },
          radialGrad(
            i % 2 === 0
              ? [0, 1, 0.97, 0.85, 0.5, 0.831, 0.659, 0.325, 1, 0.600, 0.400, 0.150]
              : [0, 0.750, 0.950, 0.850, 0.5, 0.290, 0.620, 0.478, 1, 0.120, 0.320, 0.240],
            3, [0, -1], [sz / 2, 0],
          ),
        ],
      };
    }),
  ],
};


/** Array of all animations for cycling */
export const allAnimations = [
  auroraOrb,
  lotusBloom,
  liquidWave,
  constellation,
];
