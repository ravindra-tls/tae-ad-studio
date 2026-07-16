'use client';

/**
 * Premium animated SVG illustrations for the loading experience.
 * Themed around Ayurveda × modern ad creation for TAE Ad Studio.
 */

/* ═══════════════════════════════════════════════════════
   1. MORTAR & PESTLE
   Traditional Ayurvedic stone mortar (wide bowl, narrow base)
   with a thick rounded pestle grinding herbs.
   ═══════════════════════════════════════════════════════ */
export function MortarAndPestle() {
  return (
    <svg viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <linearGradient id="mp-mortar-outer" x1="60" y1="100" x2="180" y2="210" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4E8F5B" />
          <stop offset="35%" stopColor="#1A5129" />
          <stop offset="75%" stopColor="#164821" />
          <stop offset="100%" stopColor="#123B1E" />
        </linearGradient>
        <linearGradient id="mp-mortar-rim" x1="70" y1="108" x2="170" y2="118" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6BB077" />
          <stop offset="50%" stopColor="#4E8F5B" />
          <stop offset="100%" stopColor="#2E6B3B" />
        </linearGradient>
        <radialGradient id="mp-mortar-inside" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#123B1E" />
          <stop offset="60%" stopColor="#164821" />
          <stop offset="100%" stopColor="#1A5129" />
        </radialGradient>
        <linearGradient id="mp-pestle" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F4F8DC" />
          <stop offset="25%" stopColor="#E2ECA0" />
          <stop offset="60%" stopColor="#C5D933" />
          <stop offset="85%" stopColor="#A8BB2E" />
          <stop offset="100%" stopColor="#8A9A23" />
        </linearGradient>
        <radialGradient id="mp-pestle-tip">
          <stop offset="0%" stopColor="#C5D933" />
          <stop offset="60%" stopColor="#A8BB2E" />
          <stop offset="100%" stopColor="#8A9A23" />
        </radialGradient>
        <radialGradient id="mp-particle-gold">
          <stop offset="0%" stopColor="#EEF4C0" />
          <stop offset="50%" stopColor="#C5D933" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#C5D933" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mp-particle-herb">
          <stop offset="0%" stopColor="#A4D8AB" />
          <stop offset="50%" stopColor="#4E8F5B" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#4E8F5B" stopOpacity="0" />
        </radialGradient>
        <filter id="mp-soft-shadow">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#123B1E" floodOpacity="0.2" />
        </filter>
        <filter id="mp-glow">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Floor shadow */}
      <ellipse cx="120" cy="208" rx="65" ry="10" fill="#1A5129" opacity="0.10" className="loading-anim-shadow" />

      {/* Mortar bowl — wide at top, curves in at bottom */}
      <path
        d="M55,120 C55,118 58,112 70,110 L170,110 C182,112 185,118 185,120
           L182,168 C180,190 160,204 120,204 C80,204 60,190 58,168 Z"
        fill="url(#mp-mortar-outer)"
        filter="url(#mp-soft-shadow)"
      />
      {/* Mortar rim — thick rounded lip */}
      <path
        d="M52,118 C52,108 68,104 120,104 C172,104 188,108 188,118
           C188,128 172,126 120,126 C68,126 52,128 52,118 Z"
        fill="url(#mp-mortar-rim)"
      />
      {/* Inner bowl visible area */}
      <ellipse cx="120" cy="118" rx="60" ry="10" fill="url(#mp-mortar-inside)" />
      {/* Rim highlight */}
      <path
        d="M72,108 C72,106 90,105 120,105 C150,105 168,106 168,108"
        stroke="#7BC48A" strokeWidth="1" fill="none" opacity="0.4"
      />

      {/* Pestle — thick rounded club shape, rocking */}
      <g className="loading-anim-pestle" style={{ transformOrigin: '120px 118px' }}>
        {/* Pestle handle (narrower top) */}
        <path
          d="M112,42 C112,38 116,35 120,35 C124,35 128,38 128,42
             L130,85 C130,88 128,90 125,90 L115,90 C112,90 110,88 110,85 Z"
          fill="url(#mp-pestle)"
        />
        {/* Pestle grip knob at top */}
        <ellipse cx="120" cy="36" rx="10" ry="6" fill="#F4F8DC" />
        <ellipse cx="118" cy="34" rx="4" ry="2.5" fill="#FFF" opacity="0.35" />
        {/* Pestle grinding head (thick bulb at bottom) */}
        <path
          d="M108,88 C106,88 102,94 102,100 C102,110 110,116 120,116
             C130,116 138,110 138,100 C138,94 134,88 132,88 Z"
          fill="url(#mp-pestle-tip)"
        />
        {/* Highlight on pestle head */}
        <path
          d="M110,96 C112,93 116,92 118,93"
          stroke="#F4F8DC" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.4"
        />
      </g>

      {/* Rising herb particles */}
      {[
        { cx: 98,  delay: '0s',   dur: '2.8s', color: 'mp-particle-gold', size: 5 },
        { cx: 112, delay: '0.4s', dur: '3.2s', color: 'mp-particle-herb', size: 4 },
        { cx: 132, delay: '0.7s', dur: '2.5s', color: 'mp-particle-gold', size: 6 },
        { cx: 105, delay: '1.2s', dur: '3s',   color: 'mp-particle-herb', size: 3.5 },
        { cx: 140, delay: '1.5s', dur: '2.7s', color: 'mp-particle-gold', size: 4.5 },
        { cx: 120, delay: '2s',   dur: '3.1s', color: 'mp-particle-herb', size: 5.5 },
        { cx: 90,  delay: '0.6s', dur: '2.9s', color: 'mp-particle-gold', size: 3 },
        { cx: 145, delay: '1.8s', dur: '2.6s', color: 'mp-particle-herb', size: 4 },
      ].map((p, i) => (
        <circle
          key={i}
          cx={p.cx}
          r={p.size}
          fill={`url(#${p.color})`}
          filter="url(#mp-glow)"
          className="loading-anim-particle"
          style={{ animationDelay: p.delay, animationDuration: p.dur }}
        />
      ))}

      {/* Sparkle accents */}
      {[
        { x: 72, y: 80, delay: '0.2s' },
        { x: 165, y: 78, delay: '1.5s' },
        { x: 120, y: 55, delay: '0.9s' },
        { x: 85, y: 65, delay: '2.2s' },
      ].map((s, i) => (
        <g key={`spark-${i}`} className="loading-anim-sparkle" style={{ animationDelay: s.delay }}>
          <line x1={s.x - 5} y1={s.y} x2={s.x + 5} y2={s.y} stroke="#C5D933" strokeWidth="1.5" strokeLinecap="round" />
          <line x1={s.x} y1={s.y - 5} x2={s.x} y2={s.y + 5} stroke="#C5D933" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      ))}
    </svg>
  );
}


/* ═══════════════════════════════════════════════════════
   2. PAINTBRUSH & CANVAS
   A brush painting gradient strokes onto a canvas frame
   ═══════════════════════════════════════════════════════ */
export function PaintbrushCanvas() {
  return (
    <svg viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <linearGradient id="pc-canvas" x1="40" y1="50" x2="200" y2="220" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFAF0" />
          <stop offset="100%" stopColor="#F2E8DD" />
        </linearGradient>
        <linearGradient id="pc-frame" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#A8BB2E" />
          <stop offset="50%" stopColor="#8A9A23" />
          <stop offset="100%" stopColor="#5F6B19" />
        </linearGradient>
        <linearGradient id="pc-handle" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C5D933" />
          <stop offset="30%" stopColor="#A8BB2E" />
          <stop offset="100%" stopColor="#5F6B19" />
        </linearGradient>
        <linearGradient id="pc-ferrule" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D0D0D0" />
          <stop offset="50%" stopColor="#A8A8A8" />
          <stop offset="100%" stopColor="#888" />
        </linearGradient>
        <linearGradient id="pc-bristle" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4E8F5B" />
          <stop offset="100%" stopColor="#164821" />
        </linearGradient>
        <linearGradient id="pc-stroke1" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#1A5129" stopOpacity="0" />
          <stop offset="15%" stopColor="#1A5129" />
          <stop offset="85%" stopColor="#4E8F5B" />
          <stop offset="100%" stopColor="#7BC48A" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="pc-stroke2" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#A8BB2E" stopOpacity="0" />
          <stop offset="15%" stopColor="#C5D933" />
          <stop offset="85%" stopColor="#EEF4C0" />
          <stop offset="100%" stopColor="#F4F8DC" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="pc-stroke3" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#123B1E" stopOpacity="0" />
          <stop offset="15%" stopColor="#164821" />
          <stop offset="85%" stopColor="#1A5129" />
          <stop offset="100%" stopColor="#3F7D4C" stopOpacity="0.2" />
        </linearGradient>
        <filter id="pc-canvas-shadow">
          <feDropShadow dx="2" dy="3" stdDeviation="5" floodColor="#123B1E" floodOpacity="0.12" />
        </filter>
        <clipPath id="pc-canvas-clip">
          <rect x="50" y="58" width="140" height="132" rx="2" />
        </clipPath>
      </defs>

      {/* Canvas frame */}
      <rect x="44" y="52" width="152" height="144" rx="3" fill="url(#pc-frame)" filter="url(#pc-canvas-shadow)" />
      {/* Canvas surface */}
      <rect x="50" y="58" width="140" height="132" rx="2" fill="url(#pc-canvas)" />
      {/* Canvas texture lines */}
      <line x1="50" y1="90" x2="190" y2="90" stroke="#E5D9C9" strokeWidth="0.3" />
      <line x1="50" y1="122" x2="190" y2="122" stroke="#E5D9C9" strokeWidth="0.3" />
      <line x1="50" y1="155" x2="190" y2="155" stroke="#E5D9C9" strokeWidth="0.3" />

      {/* Paint strokes appearing on canvas */}
      <g clipPath="url(#pc-canvas-clip)">
        <path
          d="M55,82 Q85,72 120,80 T185,76"
          stroke="url(#pc-stroke1)" strokeWidth="10" strokeLinecap="round" fill="none"
          className="loading-anim-stroke" style={{ animationDelay: '0s' }}
        />
        <path
          d="M55,112 Q90,100 130,108 T190,104"
          stroke="url(#pc-stroke2)" strokeWidth="7" strokeLinecap="round" fill="none"
          className="loading-anim-stroke" style={{ animationDelay: '1s' }}
        />
        <path
          d="M55,142 Q95,132 135,140 T190,136"
          stroke="url(#pc-stroke3)" strokeWidth="12" strokeLinecap="round" fill="none"
          className="loading-anim-stroke" style={{ animationDelay: '2s' }}
        />
        <path
          d="M58,168 Q100,158 140,165 T188,162"
          stroke="url(#pc-stroke1)" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.5"
          className="loading-anim-stroke" style={{ animationDelay: '3s' }}
        />
      </g>

      {/* Paintbrush */}
      <g className="loading-anim-brush" style={{ transformOrigin: '180px 65px' }}>
        {/* Handle — long, slightly tapered wooden rod */}
        <path
          d="M177,8 C175,8 173,10 173,13 L172,54 C172,56 174,58 177,58 L183,58 C186,58 188,56 188,54 L187,13 C187,10 185,8 183,8 Z"
          fill="url(#pc-handle)"
          transform="rotate(20, 180, 33)"
        />
        {/* Handle end knob */}
        <ellipse cx="180" cy="9" rx="5" ry="3.5" fill="#F4F8DC" transform="rotate(20, 180, 9)" />
        <ellipse cx="179" cy="7.5" rx="2" ry="1.5" fill="#FFF" opacity="0.35" transform="rotate(20, 180, 9)" />

        {/* Ferrule — silver band, slightly wider than handle */}
        <path
          d="M171,54 L189,54 L190,63 L170,63 Z"
          fill="url(#pc-ferrule)"
          transform="rotate(20, 180, 58)"
        />
        {/* Ferrule highlight */}
        <path
          d="M173,55 L187,55" stroke="#E8E8E8" strokeWidth="1" opacity="0.6"
          transform="rotate(20, 180, 58)"
        />

        {/* Bristles — proper artist brush: widens slightly from ferrule then tapers to a fine point */}
        <path
          d="M173,63 C171,70 169,79 170,84 C171,90 175,94 180,94 C185,94 189,90 190,84 C191,79 189,70 187,63 Z"
          fill="url(#pc-bristle)"
          transform="rotate(20, 180, 78)"
        />
        {/* Bristle texture — fine lines suggesting individual bristles */}
        <path
          d="M179,64 C178,71 177,80 178,88"
          stroke="#7BC48A" strokeWidth="0.9" strokeLinecap="round" fill="none" opacity="0.45"
          transform="rotate(20, 180, 78)"
        />
        <path
          d="M182,64 C183,71 184,80 183,88"
          stroke="#4E8F5B" strokeWidth="0.7" strokeLinecap="round" fill="none" opacity="0.3"
          transform="rotate(20, 180, 78)"
        />
        {/* Tip highlight */}
        <path
          d="M176,67 C175,72 174,78 175,82"
          stroke="#A4D8AB" strokeWidth="0.8" strokeLinecap="round" fill="none" opacity="0.4"
          transform="rotate(20, 180, 78)"
        />
      </g>

      {/* Paint drops */}
      {[
        { cx: 185, cy: 86, r: 2.5, delay: '0.3s' },
        { cx: 190, cy: 92, r: 1.8, delay: '1.4s' },
        { cx: 182, cy: 82, r: 2, delay: '2.5s' },
      ].map((d, i) => (
        <circle
          key={i} cx={d.cx} cy={d.cy} r={d.r}
          fill="#1A5129"
          className="loading-anim-drop"
          style={{ animationDelay: d.delay }}
        />
      ))}
    </svg>
  );
}


/* ═══════════════════════════════════════════════════════
   3. LOTUS & OIL DROP
   Organic curved lotus petals with oil drop and ripples
   ═══════════════════════════════════════════════════════ */
export function LotusOilDrop() {
  return (
    <svg viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <radialGradient id="lo-center">
          <stop offset="0%" stopColor="#EEF4C0" />
          <stop offset="50%" stopColor="#C5D933" />
          <stop offset="100%" stopColor="#A8BB2E" />
        </radialGradient>
        <linearGradient id="lo-petal-1" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#7BC48A" />
          <stop offset="50%" stopColor="#4E8F5B" />
          <stop offset="100%" stopColor="#1A5129" />
        </linearGradient>
        <linearGradient id="lo-petal-2" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#A4D8AB" />
          <stop offset="50%" stopColor="#6BB077" />
          <stop offset="100%" stopColor="#2E6B3B" />
        </linearGradient>
        <linearGradient id="lo-petal-3" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#5FA968" />
          <stop offset="40%" stopColor="#1A5129" />
          <stop offset="100%" stopColor="#164821" />
        </linearGradient>
        <radialGradient id="lo-oil">
          <stop offset="0%" stopColor="#FCFDEA" />
          <stop offset="35%" stopColor="#EEF4C0" />
          <stop offset="70%" stopColor="#C5D933" />
          <stop offset="100%" stopColor="#A8BB2E" />
        </radialGradient>
        <filter id="lo-petal-shadow">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#123B1E" floodOpacity="0.15" />
        </filter>
      </defs>

      {/* Ripple rings */}
      {[0, 1, 2].map((i) => (
        <circle
          key={`rip-${i}`}
          cx="120" cy="165"
          r="10"
          stroke="#C5D933" strokeWidth="1"
          fill="none" opacity="0.35"
          className="loading-anim-ripple"
          style={{ animationDelay: `${i * 1.1}s` }}
        />
      ))}

      {/* Back petals — wide, reaching outward */}
      <path d="M120,165 C110,140 70,120 55,100 C60,95 80,98 95,108 C105,115 115,135 120,165 Z" fill="url(#lo-petal-2)" opacity="0.5" filter="url(#lo-petal-shadow)" className="loading-anim-petal-back" style={{ transformOrigin: '120px 165px', animationDelay: '0s' }} />
      <path d="M120,165 C130,140 170,120 185,100 C180,95 160,98 145,108 C135,115 125,135 120,165 Z" fill="url(#lo-petal-2)" opacity="0.5" filter="url(#lo-petal-shadow)" className="loading-anim-petal-back" style={{ transformOrigin: '120px 165px', animationDelay: '0.15s' }} />
      <path d="M120,165 C115,135 100,105 90,85 C95,82 105,88 112,100 C117,110 119,140 120,165 Z" fill="url(#lo-petal-2)" opacity="0.45" filter="url(#lo-petal-shadow)" className="loading-anim-petal-back" style={{ transformOrigin: '120px 165px', animationDelay: '0.3s' }} />
      <path d="M120,165 C125,135 140,105 150,85 C145,82 135,88 128,100 C123,110 121,140 120,165 Z" fill="url(#lo-petal-2)" opacity="0.45" filter="url(#lo-petal-shadow)" className="loading-anim-petal-back" style={{ transformOrigin: '120px 165px', animationDelay: '0.2s' }} />

      {/* Mid petals */}
      <path d="M120,165 C108,140 82,118 68,105 C74,100 88,108 100,120 C110,130 117,148 120,165 Z" fill="url(#lo-petal-1)" opacity="0.7" className="loading-anim-petal-mid" style={{ transformOrigin: '120px 165px', animationDelay: '0s' }} />
      <path d="M120,165 C132,140 158,118 172,105 C166,100 152,108 140,120 C130,130 123,148 120,165 Z" fill="url(#lo-petal-1)" opacity="0.7" className="loading-anim-petal-mid" style={{ transformOrigin: '120px 165px', animationDelay: '0.2s' }} />

      {/* Front petals — central, most vibrant */}
      <path d="M120,165 C112,142 98,118 88,98 C94,95 104,105 112,118 C118,130 120,150 120,165 Z" fill="url(#lo-petal-3)" className="loading-anim-petal-front" style={{ transformOrigin: '120px 165px', animationDelay: '0s' }} />
      <path d="M120,165 C120,145 120,115 120,90 C124,90 126,100 126,115 C126,135 122,155 120,165 Z" fill="url(#lo-petal-3)" className="loading-anim-petal-front" style={{ transformOrigin: '120px 165px', animationDelay: '0.1s' }} />
      <path d="M120,165 C128,142 142,118 152,98 C146,95 136,105 128,118 C122,130 120,150 120,165 Z" fill="url(#lo-petal-3)" className="loading-anim-petal-front" style={{ transformOrigin: '120px 165px', animationDelay: '0.2s' }} />

      {/* Golden center */}
      <circle cx="120" cy="160" r="11" fill="url(#lo-center)" className="loading-anim-center-pulse" />
      <circle cx="118" cy="157" r="3.5" fill="#FFF" opacity="0.3" />

      {/* Falling oil drop */}
      <g className="loading-anim-oil-drop">
        <path
          d="M120,28 C122,36 126,46 126,52 C126,58 123,62 120,62 C117,62 114,58 114,52 C114,46 118,36 120,28 Z"
          fill="url(#lo-oil)"
        />
        <ellipse cx="118.5" cy="48" rx="2.5" ry="4" fill="#FFF" opacity="0.35" />
      </g>
    </svg>
  );
}


/* ═══════════════════════════════════════════════════════
   4. ALCHEMY FLASK
   Round-bottom flask with bubbling potion and steam
   ═══════════════════════════════════════════════════════ */
export function AlchemyFlask() {
  return (
    <svg viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <linearGradient id="af-glass" x1="70" y1="50" x2="170" y2="220" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#EAF4EA" stopOpacity="0.85" />
          <stop offset="50%" stopColor="#D6E9D6" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#C6DCC6" stopOpacity="0.45" />
        </linearGradient>
        <linearGradient id="af-liquid" x1="75" y1="135" x2="165" y2="200" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4E8F5B" />
          <stop offset="40%" stopColor="#1A5129" />
          <stop offset="80%" stopColor="#164821" />
          <stop offset="100%" stopColor="#123B1E" />
        </linearGradient>
        <linearGradient id="af-liquid-top" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#5FA968" />
          <stop offset="50%" stopColor="#7BC48A" />
          <stop offset="100%" stopColor="#5FA968" />
        </linearGradient>
        <linearGradient id="af-neck" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#C6D8C8" stopOpacity="0.5" />
          <stop offset="50%" stopColor="#EAF4EA" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#C6D8C8" stopOpacity="0.5" />
        </linearGradient>
        <radialGradient id="af-bubble">
          <stop offset="0%" stopColor="#FFF" stopOpacity="0.75" />
          <stop offset="40%" stopColor="#C5D933" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#C5D933" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="af-steam">
          <stop offset="0%" stopColor="#7BC48A" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#7BC48A" stopOpacity="0" />
        </radialGradient>
        <filter id="af-glass-shadow">
          <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#123B1E" floodOpacity="0.12" />
        </filter>
        <clipPath id="af-flask-clip">
          <path d="M105,55 L105,100 C72,115 65,145 65,165 C65,195 88,210 120,210 C152,210 175,195 175,165 C175,145 168,115 135,100 L135,55 Z" />
        </clipPath>
      </defs>

      {/* Floor shadow */}
      <ellipse cx="120" cy="215" rx="55" ry="8" fill="#1A5129" opacity="0.08" className="loading-anim-shadow" />

      {/* Flask body — round bottom with narrow neck */}
      <path
        d="M105,55 L105,100 C72,115 65,145 65,165 C65,195 88,210 120,210 C152,210 175,195 175,165 C175,145 168,115 135,100 L135,55 Z"
        fill="url(#af-glass)"
        stroke="#A5C5A8" strokeWidth="1.5"
        filter="url(#af-glass-shadow)"
      />

      {/* Liquid inside */}
      <g clipPath="url(#af-flask-clip)">
        <rect x="63" y="148" width="114" height="65" fill="url(#af-liquid)" />
        {/* Liquid surface wave */}
        <path
          d="M63,150 Q90,144 120,150 Q150,156 177,150"
          stroke="url(#af-liquid-top)" strokeWidth="3" fill="none"
          className="loading-anim-wave"
        />
        {/* Swirl in liquid */}
        <path
          d="M90,170 Q110,162 130,170 Q150,178 165,170"
          stroke="#7BC48A" strokeWidth="1.5" fill="none" opacity="0.35"
          className="loading-anim-swirl"
        />

        {/* Bubbles */}
        {[
          { cx: 95,  size: 5,   delay: '0s',   dur: '2.4s' },
          { cx: 120, size: 7,   delay: '0.5s', dur: '2.8s' },
          { cx: 145, size: 4,   delay: '1s',   dur: '2.2s' },
          { cx: 108, size: 6,   delay: '1.5s', dur: '2.6s' },
          { cx: 135, size: 3.5, delay: '0.8s', dur: '2.5s' },
          { cx: 100, size: 4.5, delay: '2s',   dur: '2.1s' },
        ].map((b, i) => (
          <circle
            key={i} cx={b.cx} r={b.size}
            fill="url(#af-bubble)"
            className="loading-anim-bubble"
            style={{ animationDelay: b.delay, animationDuration: b.dur }}
          />
        ))}
      </g>

      {/* Glass highlight streaks */}
      <path d="M85,125 C82,148 84,175 88,192" stroke="#FFF" strokeWidth="2" strokeLinecap="round" opacity="0.25" />
      <path d="M80,140 C78,155 79,172 82,185" stroke="#FFF" strokeWidth="1" strokeLinecap="round" opacity="0.15" />

      {/* Flask neck */}
      <rect x="103" y="48" width="34" height="10" rx="2" fill="url(#af-neck)" stroke="#A5C5A8" strokeWidth="1" />
      {/* Neck rim */}
      <rect x="100" y="46" width="40" height="5" rx="2.5" fill="#BFDDC2" stroke="#A5C5A8" strokeWidth="0.5" />

      {/* Steam wisps */}
      {[
        { x: 112, delay: '0s' },
        { x: 128, delay: '0.8s' },
        { x: 120, delay: '1.6s' },
      ].map((s, i) => (
        <circle
          key={`stm-${i}`}
          cx={s.x} r="12"
          fill="url(#af-steam)"
          className="loading-anim-steam"
          style={{ animationDelay: s.delay }}
        />
      ))}

      {/* Sparkles */}
      {[
        { x: 52, y: 150, delay: '0.4s' },
        { x: 188, y: 155, delay: '1.3s' },
        { x: 60, y: 185, delay: '2.2s' },
        { x: 180, y: 182, delay: '0.8s' },
      ].map((s, i) => (
        <g key={`sp-${i}`} className="loading-anim-sparkle" style={{ animationDelay: s.delay }}>
          <line x1={s.x - 4} y1={s.y} x2={s.x + 4} y2={s.y} stroke="#C5D933" strokeWidth="1.2" strokeLinecap="round" />
          <line x1={s.x} y1={s.y - 4} x2={s.x} y2={s.y + 4} stroke="#C5D933" strokeWidth="1.2" strokeLinecap="round" />
        </g>
      ))}
    </svg>
  );
}

/** All loading animations for cycling */
export const LoadingAnimations = [MortarAndPestle, PaintbrushCanvas, LotusOilDrop, AlchemyFlask];
