/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          // ── Primary palette — TAE brand identity ──────────────────
          forest:  '#1A5129',   // Deep forest green  (primary dark)
          green:   '#5F982F',   // Medium green       (primary mid)
          lime:    '#C5D933',   // Chartreuse / lime  (primary accent)
          black:   '#101010',   // Near-black
          white:   '#FFFFFF',   // Pure white
          // ── Secondary palette ──────────────────────────────────────
          cream:   '#F2E8DD',   // Warm cream         (backgrounds)
          sage:    '#B9B78F',   // Sage / olive       (muted accent)
          // ── UI state colors ────────────────────────────────────────
          wine:    '#7B1E1E',   // Error / over-limit states (usage meter)
          // ── Text tokens ────────────────────────────────────────────
          navy:    '#1E293B',   // Dark text (legibility)
          slate:   '#475569',   // Secondary text
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['DM Serif Display', 'Georgia', 'serif'],
      },

      // ── Spring physics timing curves ──────────────────────────────
      transitionTimingFunction: {
        // Slight overshoot — the main "springy" curve
        spring:       'cubic-bezier(0.34, 1.56, 0.64, 1)',
        // Gentler spring — for larger elements like modals
        'spring-soft': 'cubic-bezier(0.25, 1.20, 0.5, 1)',
        // Smooth deceleration — for exits / closing
        smooth:       'cubic-bezier(0.4, 0, 0.2, 1)',
        // Fast snap — for instant-feeling micro taps
        snappy:       'cubic-bezier(0.2, 0, 0, 1)',
      },

      // ── Keyframes ─────────────────────────────────────────────────
      keyframes: {
        // Page entrance
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        // Modal / panel entrance — spring scale from slightly below
        modalIn: {
          '0%':   { opacity: '0', transform: 'scale(0.90) translateY(16px)' },
          '60%':  { opacity: '1', transform: 'scale(1.02) translateY(-2px)' },
          '100%': { opacity: '1', transform: 'scale(1)    translateY(0)' },
        },
        // Backdrop fade
        overlayIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        // Tiny badge / count pop — spring scale from centre
        badgePop: {
          '0%':   { transform: 'scale(0.4)', opacity: '0' },
          '55%':  { transform: 'scale(1.18)' },
          '80%':  { transform: 'scale(0.96)' },
          '100%': { transform: 'scale(1)',    opacity: '1' },
        },
        // Sticky bar spring slide-up
        slideUp: {
          '0%':   { transform: 'translateY(110%)' },
          '65%':  { transform: 'translateY(-6px)' },
          '100%': { transform: 'translateY(0)' },
        },
        // Filter pill press ripple
        pillPress: {
          '0%':   { transform: 'scale(1)' },
          '40%':  { transform: 'scale(0.88)' },
          '100%': { transform: 'scale(1)' },
        },
        // Staggered grid entrance
        staggerIn: {
          from: { opacity: '0', transform: 'translateY(12px) scale(0.97)' },
          to:   { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        // ── Concept Forge ─────────────────────────────────────────
        // Skeleton / busy-card gradient sweep
        shimmer: {
          from: { backgroundPosition: '-400px 0' },
          to:   { backgroundPosition: '400px 0' },
        },
        // Slim indeterminate progress bar sweep
        progressSlide: {
          from: { backgroundPosition: '-200px 0' },
          to:   { backgroundPosition: '200px 0' },
        },
        // Tab-count lime glow ring after a background finalize lands
        countGlow: {
          '0%':   { boxShadow: '0 0 0 0 #C5D933' },
          '60%':  { boxShadow: '0 0 0 6px rgba(197, 217, 51, 0)' },
          '100%': { boxShadow: 'none' },
        },
        // Full-plane detail entrance
        detailIn: {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        // Board card highlight when revealed from a chat chip
        cardFlash: {
          '0%':   { boxShadow: '0 0 0 3px #C5D933' },
          '100%': { boxShadow: '0 0 0 0 rgba(197, 217, 51, 0)' },
        },
        // Thinking dots / unread indicator pulse
        dotPulse: {
          '0%, 100%': { opacity: '0.35', transform: 'scale(0.85)' },
          '50%':      { opacity: '1',    transform: 'scale(1)' },
        },
        // Overlay sheet entrance from the right edge
        slideInRight: {
          from: { transform: 'translateX(100%)' },
          to:   { transform: 'translateX(0)' },
        },
      },

      // ── Named animation utilities ──────────────────────────────────
      animation: {
        'fade-in':    'fadeIn 0.45s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'modal-in':   'modalIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'overlay-in': 'overlayIn 0.2s ease forwards',
        'badge-pop':  'badgePop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'slide-up':    'slideUp 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'pill-press':  'pillPress 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'stagger-in':  'staggerIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) both',
        // ── Concept Forge ──────────────────────────────────────────────
        'shimmer':        'shimmer 1.4s linear infinite',
        'progress-slide': 'progressSlide 1.2s linear infinite',
        'count-glow':     'countGlow 0.9s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'detail-in':      'detailIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) both',
        'card-flash':     'cardFlash 1.6s ease-out',
        'dot-pulse':      'dotPulse 1.2s ease-in-out infinite',
        'slide-in-right': 'slideInRight 0.3s cubic-bezier(0.25, 1.20, 0.5, 1) both',
      },
    },
  },
  plugins: [],
};
