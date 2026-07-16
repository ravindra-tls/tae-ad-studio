'use client';

/**
 * LoadingExperience — full-screen loading overlay (portal) — a thin shell
 * over the shared stage engine in lib/hooks/use-loading-stages.ts.
 *
 * When `complete` flips true the bar snaps to 100%, the overlay fades out,
 * and onExitComplete fires (parent navigates). onExitComplete is held in a
 * ref and its timer is cleared on unmount, so it can never fire after
 * unmount. For non-overlay contexts use components/LoadingInline.tsx.
 */

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  useLoadingStages,
  LOADING_BAR_GRADIENT,
  LOADING_BAR_SHADOW,
} from '@/lib/hooks/use-loading-stages';

interface LoadingExperienceProps {
  estimatedSeconds?: number;
  templateCount?: number;
  /** When true, bar fills to 100% on the same screen, then fades out and navigates */
  complete?: boolean;
  /** Called after the fade-out finishes — parent should navigate here */
  onExitComplete?: () => void;
  onStatusCheck?: () => Promise<{ status: string; progress?: number }>;
  pollIntervalMs?: number;
}

export function LoadingExperience({
  estimatedSeconds = 30,
  templateCount = 1,
  complete = false,
  onExitComplete,
  onStatusCheck,
  pollIntervalMs = 2000,
}: LoadingExperienceProps) {
  const {
    progress,
    message,
    messageFading,
    SceneComponent,
    sceneIndex,
    sceneFading,
    isCompleting,
  } = useLoadingStages({ estimatedSeconds, cap: 95, complete, onStatusCheck, pollIntervalMs });

  const [isExiting, setIsExiting] = useState(false);

  const onExitRef = useRef(onExitComplete);
  useEffect(() => { onExitRef.current = onExitComplete; }, [onExitComplete]);

  // When `complete` flips true: the hook snaps the bar to 100%; here we wait
  // for the fill (800ms), fade the overlay out, then navigate (1500ms).
  // Skipped if a status poll already completed — those pages navigate
  // themselves. Timers clear on unmount so onExitComplete never fires late.
  useEffect(() => {
    if (!complete || isCompleting) return;

    const fadeTimer = setTimeout(() => setIsExiting(true), 800);
    const navTimer = setTimeout(() => onExitRef.current?.(), 1500);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(navTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete]);

  const overlay = (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center transition-[opacity,transform] duration-700 ease-out"
      style={{
        background: 'linear-gradient(145deg, rgba(245,240,230,0.97) 0%, rgba(255,255,255,0.98) 40%, rgba(245,240,230,0.96) 100%)',
        backdropFilter: 'blur(12px)',
        animation: !isExiting ? 'overlayIn 0.5s ease forwards' : undefined,
        opacity: isExiting ? 0 : 1,
        transform: isExiting ? 'scale(1.03)' : 'scale(1)',
      }}
    >
      <div className="flex flex-col items-center max-w-md px-6">
        {/* Animated SVG illustration */}
        <div
          className="mb-6 relative transition-[opacity,transform] duration-500 ease-out"
          style={{
            width: 220,
            height: 220,
            animation: 'floatBob 4s ease-in-out infinite',
            opacity: sceneFading ? 0 : 1,
            transform: sceneFading ? 'scale(0.9) translateY(10px)' : 'scale(1) translateY(0)',
          }}
        >
          <SceneComponent key={sceneIndex} />
        </div>

        {/* Rotating message */}
        <div className="h-14 flex items-center justify-center mb-5">
          <p
            className="text-center text-base font-medium text-brand-forest/80 transition-[opacity,transform] duration-300 ease-out max-w-sm"
            style={{
              opacity: messageFading ? 0 : 1,
              transform: messageFading ? 'translateY(6px)' : 'translateY(0)',
            }}
          >
            {message}
          </p>
        </div>

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
            <span>
              {templateCount > 1
                ? `Creating ${templateCount} ad images...`
                : 'Crafting your ad image...'}
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-[10px] text-brand-slate/35 text-center">
          Good things take time — about 15–30s per image
        </p>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
