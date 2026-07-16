'use client';

/**
 * useLoadingStages — the stage machinery behind TAE's designed loading
 * experience: rotating Ayurveda SVG scenes, rotating copy, a fake progress
 * curve, optional real-status polling, and a completion snap to 100%.
 *
 * Extracted from components/LoadingExperience.tsx so the same engine drives
 * both the full-screen overlay (LoadingExperience) and inline loaders
 * (LoadingInline). Every interval/timeout is cleared on unmount and once
 * `isCompleting` flips true.
 */

import { useEffect, useState } from 'react';
import { loadingMessages } from '@/lib/loading-messages';
import { LoadingAnimations } from '@/components/loading-animations';

/** Brand progress-bar fill: forest → mid green → lime. */
export const LOADING_BAR_GRADIENT = 'linear-gradient(90deg, #1A5129, #4E8F5B, #C5D933)';
/** Soft forest glow under the progress bar. */
export const LOADING_BAR_SHADOW = '0 0 10px rgba(26,81,41,0.25)';

export interface UseLoadingStagesOptions {
  /** Shapes the fake progress curve — roughly how long the job takes. */
  estimatedSeconds?: number;
  /** Ceiling for fake progress until completion snaps the bar to 100. */
  cap?: number;
  /** Flip to true when the real work finishes — snaps progress to 100. */
  complete?: boolean;
  /** Optional real-status poll. Terminal statuses snap progress to 100. */
  onStatusCheck?: () => Promise<{ status: string; progress?: number }>;
  pollIntervalMs?: number;
}

export interface UseLoadingStagesResult {
  /** 0–100 — fake curve, real poll progress, or the completion snap. */
  progress: number;
  /** Current rotating loading message (swaps every 4.5s). */
  message: string;
  /** True during the 300ms message cross-fade. */
  messageFading: boolean;
  /** Current SVG scene (cycles every 10s). */
  SceneComponent: (typeof LoadingAnimations)[number];
  /** Index of the current scene — use as a React key to remount the SVG. */
  sceneIndex: number;
  /** True during the 500ms scene cross-fade. */
  sceneFading: boolean;
  /** True once `complete` or a terminal poll status fired — stages stop. */
  isCompleting: boolean;
  /** Whole seconds since the loader mounted. */
  elapsed: number;
}

export function useLoadingStages({
  estimatedSeconds = 30,
  cap = 95,
  complete = false,
  onStatusCheck,
  pollIntervalMs = 2000,
}: UseLoadingStagesOptions = {}): UseLoadingStagesResult {
  const [messageIndex, setMessageIndex] = useState(() => Math.floor(Math.random() * loadingMessages.length));
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [sceneIndex, setSceneIndex] = useState(() => Math.floor(Math.random() * LoadingAnimations.length));
  const [messageFading, setMessageFading] = useState(false);
  const [sceneFading, setSceneFading] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  // When `complete` flips true: stop the stages and snap the bar to 100%.
  useEffect(() => {
    if (!complete || isCompleting) return;
    setIsCompleting(true);
    setProgress(100);
  }, [complete, isCompleting]);

  // Rotate messages every 4.5s (300ms fade-out before the swap)
  useEffect(() => {
    if (isCompleting) return;
    let fadeTimer: ReturnType<typeof setTimeout> | undefined;
    const interval = setInterval(() => {
      setMessageFading(true);
      fadeTimer = setTimeout(() => {
        setMessageIndex((prev) => (prev + 1) % loadingMessages.length);
        setMessageFading(false);
      }, 300);
    }, 4500);
    return () => {
      clearInterval(interval);
      if (fadeTimer) clearTimeout(fadeTimer);
    };
  }, [isCompleting]);

  // Elapsed timer
  useEffect(() => {
    if (isCompleting) return;
    const interval = setInterval(() => setElapsed((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [isCompleting]);

  // Fake progress curve — approaches `cap` asymptotically
  useEffect(() => {
    if (isCompleting) return;
    setProgress(Math.min(cap, (1 - Math.exp(-elapsed / (estimatedSeconds * 0.6))) * 100));
  }, [elapsed, estimatedSeconds, cap, isCompleting]);

  // Poll for real status
  useEffect(() => {
    if (!onStatusCheck || isCompleting) return;
    const interval = setInterval(async () => {
      try {
        const result = await onStatusCheck();
        if (result.progress !== undefined) setProgress(result.progress);
        // Terminal states: stop fake progress first, then fill to 100%
        if (result.status === 'completed' || result.status === 'failed' || result.status === 'nsfw') {
          setIsCompleting(true);
          setProgress(100);
        }
      } catch { /* continue */ }
    }, pollIntervalMs);
    return () => clearInterval(interval);
  }, [onStatusCheck, pollIntervalMs, isCompleting]);

  // Cycle scenes every 10s (500ms fade-out before the swap)
  useEffect(() => {
    if (isCompleting) return;
    let fadeTimer: ReturnType<typeof setTimeout> | undefined;
    const interval = setInterval(() => {
      setSceneFading(true);
      fadeTimer = setTimeout(() => {
        setSceneIndex((prev) => (prev + 1) % LoadingAnimations.length);
        setSceneFading(false);
      }, 500);
    }, 10000);
    return () => {
      clearInterval(interval);
      if (fadeTimer) clearTimeout(fadeTimer);
    };
  }, [isCompleting]);

  return {
    progress,
    message: loadingMessages[messageIndex],
    messageFading,
    SceneComponent: LoadingAnimations[sceneIndex],
    sceneIndex,
    sceneFading,
    isCompleting,
    elapsed,
  };
}
