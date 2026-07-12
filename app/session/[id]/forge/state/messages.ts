'use client';

/**
 * Rotating in-flight narration — ported from Concept Forge.
 * LOADING_MSGS run while a deal streams; GEN_MSGS while an image renders.
 */

import { useEffect, useState } from 'react';

export const LOADING_MSGS = [
  'Forging concepts on the anvil…',
  'Judging every draft against the quality bar…',
  'Hunting for the raw human truth…',
  'Sharpening taglines until they stop thumbs…',
  'Sketching the scene for each idea…',
] as const;

export const GEN_MSGS = [
  'Blocking out the layout…',
  'Composing the scene and framing…',
  'Placing the headline type…',
  'Matching the brand palette…',
  'Rendering skin texture honestly…',
  'Checking label and logo details…',
  'Final pass — lighting and grain…',
] as const;

/**
 * Returns the current message, rotating while `active`. Resets to the first
 * message whenever `active` flips on. Pair with `key={msg}` + a fade-in class
 * for the CF cross-fade feel.
 */
export function useRotatingMessage(
  messages: readonly string[],
  active: boolean,
  intervalMs = 4500,
): string {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) return;
    setIndex(0);
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % messages.length);
    }, intervalMs);
    return () => clearInterval(t);
  }, [active, intervalMs, messages]);

  return messages[index % messages.length];
}
