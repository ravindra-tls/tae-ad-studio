'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { loadingMessages } from '@/lib/loading-messages';
import { LoadingAnimations } from '@/components/loading-animations';

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
  const [messageIndex, setMessageIndex] = useState(() => Math.floor(Math.random() * loadingMessages.length));
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [animIndex, setAnimIndex] = useState(() => Math.floor(Math.random() * LoadingAnimations.length));
  const [textFading, setTextFading] = useState(false);
  const [animFading, setAnimFading] = useState(false);

  const [isCompleting, setIsCompleting] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const onExitRef = useRef(onExitComplete);
  useEffect(() => { onExitRef.current = onExitComplete; }, [onExitComplete]);

  const AnimComponent = LoadingAnimations[animIndex];

  // When `complete` flips to true: fill bar to 100%, wait for it, fade out, navigate
  useEffect(() => {
    if (!complete || isCompleting) return;
    setIsCompleting(true);
    setProgress(100);

    // After bar fills (800ms), start fade-out
    const fadeTimer = setTimeout(() => setIsExiting(true), 800);

    // After fade-out (700ms), navigate
    const navTimer = setTimeout(() => onExitRef.current?.(), 1500);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(navTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete]);

  // Rotate messages every 4.5s
  useEffect(() => {
    if (isCompleting) return;
    const interval = setInterval(() => {
      setTextFading(true);
      setTimeout(() => {
        setMessageIndex((prev) => (prev + 1) % loadingMessages.length);
        setTextFading(false);
      }, 300);
    }, 4500);
    return () => clearInterval(interval);
  }, [isCompleting]);

  // Elapsed timer
  useEffect(() => {
    if (isCompleting) return;
    const interval = setInterval(() => setElapsed((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [isCompleting]);

  // Fake progress curve
  useEffect(() => {
    if (isCompleting) return;
    const fakeProgress = Math.min(95, (1 - Math.exp(-elapsed / (estimatedSeconds * 0.6))) * 100);
    setProgress(fakeProgress);
  }, [elapsed, estimatedSeconds, isCompleting]);

  // Poll for real status
  useEffect(() => {
    if (!onStatusCheck || isCompleting) return;
    const interval = setInterval(async () => {
      try {
        const result = await onStatusCheck();
        if (result.progress !== undefined) setProgress(result.progress);
        if (result.status === 'completed') setProgress(100);
      } catch { /* continue */ }
    }, pollIntervalMs);
    return () => clearInterval(interval);
  }, [onStatusCheck, pollIntervalMs, isCompleting]);

  // Cycle animations every 10s
  useEffect(() => {
    if (isCompleting) return;
    const interval = setInterval(() => {
      setAnimFading(true);
      setTimeout(() => {
        setAnimIndex((prev) => (prev + 1) % LoadingAnimations.length);
        setAnimFading(false);
      }, 500);
    }, 10000);
    return () => clearInterval(interval);
  }, [isCompleting]);

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
            opacity: animFading ? 0 : 1,
            transform: animFading ? 'scale(0.9) translateY(10px)' : 'scale(1) translateY(0)',
          }}
        >
          <AnimComponent key={animIndex} />
        </div>

        {/* Rotating message */}
        <div className="h-14 flex items-center justify-center mb-5">
          <p
            className="text-center text-base font-medium text-brand-forest/80 transition-[opacity,transform] duration-300 ease-out max-w-sm"
            style={{
              opacity: textFading ? 0 : 1,
              transform: textFading ? 'translateY(6px)' : 'translateY(0)',
            }}
          >
            {loadingMessages[messageIndex]}
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-xs">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-sage/15">
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #2D644E, #4A9E7A, #D4A853)',
                boxShadow: '0 0 10px rgba(45,100,78,0.25)',
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
