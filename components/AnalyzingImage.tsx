'use client';

/**
 * AnalyzingImage — scan-line placeholder for image generation / edit loading states.
 *
 * Matches the loading-ui @loading-ui/analyzing-image visual language:
 *  - Rectangular image frame outline
 *  - Four corner brackets (viewfinder style)
 *  - Horizontal scan gradient that sweeps top → bottom → top
 *  - Optional centre crosshair
 *
 * Sizing:  use Tailwind size-* utilities (size-20, size-24, etc.)
 * Color:   inherits currentColor — set text-brand-forest on the parent
 * Surface: set --analyzing-bg to match the card background so the scan
 *          mask blends correctly (defaults to transparent)
 */

import { cn } from '@/lib/utils';

interface AnalyzingImageProps {
  className?: string;
}

export function AnalyzingImage({ className }: AnalyzingImageProps) {
  const id = 'ai-scan'; // stable — only one instance visible at a time

  return (
    <svg
      viewBox="0 0 96 96"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('size-20', className)}
      aria-label="Generating…"
      role="img"
    >
      <defs>
        {/* Vertical gradient for the sweep line */}
        <linearGradient id={`${id}-grad`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%"   stopColor="currentColor" stopOpacity="0"   />
          <stop offset="35%"  stopColor="currentColor" stopOpacity="0.18"/>
          <stop offset="50%"  stopColor="currentColor" stopOpacity="0.7" />
          <stop offset="65%"  stopColor="currentColor" stopOpacity="0.18"/>
          <stop offset="100%" stopColor="currentColor" stopOpacity="0"   />
        </linearGradient>

        {/* Clip the sweep to the image rect */}
        <clipPath id={`${id}-clip`}>
          <rect x="10" y="10" width="76" height="76" rx="5" />
        </clipPath>
      </defs>

      {/* ── Image frame ─────────────────────────────────────────── */}
      <rect
        x="10" y="10" width="76" height="76" rx="5"
        fill="none"
        stroke="currentColor" strokeOpacity="0.18" strokeWidth="1.5"
      />

      {/* ── Corner brackets ──────────────────────────────────────── */}
      {/* top-left */}
      <path d="M10 26 L10 10 L26 10"    fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* top-right */}
      <path d="M70 10 L86 10 L86 26"    fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* bottom-right */}
      <path d="M86 70 L86 86 L70 86"    fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* bottom-left */}
      <path d="M26 86 L10 86 L10 70"    fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* ── Scan sweep ───────────────────────────────────────────── */}
      {/* A tall gradient rect that translates up and down */}
      <rect
        x="10" y="10"
        width="76" height="24"
        fill={`url(#${id}-grad)`}
        clipPath={`url(#${id}-clip)`}
        className="analyzing-scan-line"
      />

      {/* ── Centre crosshair ─────────────────────────────────────── */}
      <line x1="48" y1="38" x2="48" y2="58" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1"   strokeLinecap="round" />
      <line x1="38" y1="48" x2="58" y2="48" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1"   strokeLinecap="round" />
      <circle cx="48" cy="48" r="5"            stroke="currentColor" strokeOpacity="0.25" strokeWidth="1" fill="none" />

      {/* ── Corner dots ──────────────────────────────────────────── */}
      <circle cx="10" cy="10" r="2" fill="currentColor" fillOpacity="0.5" />
      <circle cx="86" cy="10" r="2" fill="currentColor" fillOpacity="0.5" />
      <circle cx="86" cy="86" r="2" fill="currentColor" fillOpacity="0.5" />
      <circle cx="10" cy="86" r="2" fill="currentColor" fillOpacity="0.5" />
    </svg>
  );
}
