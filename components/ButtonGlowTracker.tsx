'use client';
import { useEffect } from 'react';

/**
 * ButtonGlowTracker
 *
 * Single delegated mousemove listener on document.
 *
 * On every move:
 *   --gx / --gy  — pointer position as % of the button's own dimensions
 *                  (used to place the gradient origin)
 *
 * On button change only (cheap cache):
 *   --gw / --gh  — ellipse radii in px, derived from the button's live rect
 *                  so the glow always conforms to the button's aspect ratio.
 *                  Width  = 65 % of button width   (min 30 px)
 *                  Height = 140 % of button height  (min 22 px)
 *                  The height > 100 % lets the glow feather softly past the
 *                  top/bottom edges, which is clipped by border-radius and
 *                  looks like natural light spill.
 */
export default function ButtonGlowTracker() {
  useEffect(() => {
    let lastBtn: HTMLButtonElement | null = null;

    function onMove(e: MouseEvent) {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(
        '[data-glow]:not([disabled])'
      );

      if (!btn) {
        lastBtn = null;
        return;
      }

      const r = btn.getBoundingClientRect();

      // Recompute shape only when the pointer enters a new button
      if (btn !== lastBtn) {
        btn.style.setProperty('--gw', `${Math.max(r.width  * 0.65, 30)}px`);
        btn.style.setProperty('--gh', `${Math.max(r.height * 1.40, 22)}px`);
        lastBtn = btn;
      }

      btn.style.setProperty('--gx', `${((e.clientX - r.left) / r.width)  * 100}%`);
      btn.style.setProperty('--gy', `${((e.clientY - r.top)  / r.height) * 100}%`);
    }

    document.addEventListener('mousemove', onMove, { passive: true });
    return () => document.removeEventListener('mousemove', onMove);
  }, []);

  return null;
}
