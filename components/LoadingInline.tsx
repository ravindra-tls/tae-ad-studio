'use client';

/**
 * LoadingInline — the staged loading experience (rotating Ayurveda scenes,
 * rotating copy, fake progress) rendered inline: no portal, no fixed
 * overlay. Drop it inside modals, panels, or empty regions.
 *
 * Flip `complete` to true when the real work finishes — the bar snaps to
 * 100% over 700ms; the parent owns any step change after that.
 */

import {
  useLoadingStages,
  LOADING_BAR_GRADIENT,
  LOADING_BAR_SHADOW,
} from '@/lib/hooks/use-loading-stages';

interface LoadingInlineProps {
  estimatedSeconds?: number;
  /** Left-hand caption under the bar (e.g. "Crafting your template…"). */
  label?: string;
  /** Flip to true when the real work finishes — bar snaps to 100%. */
  complete?: boolean;
  /** Fake-progress ceiling before completion (default 95). */
  cap?: number;
}

export function LoadingInline({
  estimatedSeconds = 30,
  label,
  complete = false,
  cap = 95,
}: LoadingInlineProps) {
  const {
    progress,
    message,
    messageFading,
    SceneComponent,
    sceneIndex,
    sceneFading,
    isCompleting,
  } = useLoadingStages({ estimatedSeconds, cap, complete });

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {/* Animated SVG scene */}
      <div
        style={{
          width: 180,
          height: 180,
          animation: 'floatBob 4s ease-in-out infinite',
          opacity: sceneFading ? 0 : 1,
          transform: sceneFading ? 'scale(0.9) translateY(10px)' : 'scale(1) translateY(0)',
          transition: 'opacity 500ms ease, transform 500ms ease',
        }}
      >
        <SceneComponent key={sceneIndex} />
      </div>

      {/* Rotating message */}
      <p
        className="max-w-xs text-center text-sm font-medium text-brand-forest/80"
        style={{
          opacity: messageFading ? 0 : 1,
          transform: messageFading ? 'translateY(6px)' : 'translateY(0)',
          transition: 'opacity 300ms ease, transform 300ms ease',
        }}
      >
        {message}
      </p>

      {/* Progress bar */}
      <div className="w-full max-w-xs">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-sage/15">
          <div
            className="h-full rounded-full"
            style={{
              width: `${progress}%`,
              background: LOADING_BAR_GRADIENT,
              boxShadow: LOADING_BAR_SHADOW,
              transition: isCompleting
                ? 'width 700ms cubic-bezier(0.4, 0, 0.2, 1)'
                : 'width 1000ms ease-out',
            }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-brand-slate/50">
          <span>{label}</span>
          <span>{Math.round(progress)}%</span>
        </div>
      </div>
    </div>
  );
}
