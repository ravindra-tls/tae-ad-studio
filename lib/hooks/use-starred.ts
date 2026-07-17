'use client';

/**
 * useStarred — DB-backed image stars, shared by Gallery / ImageGallery /
 * DashboardImagesGrid (replaces their three copies of localStorage star logic).
 *
 *   const { starred, toggleStar, loading } = useStarred(userId);
 *
 * On mount it:
 *   1. One-time import: if the legacy localStorage keys ('tae-starred-<userId>'
 *      / 'tae-dashboard-starred') exist, POSTs their ids to
 *      /api/images/stars/import and removes the keys ONLY after a 2xx — so a
 *      failed import retries on the next mount instead of losing stars.
 *   2. Fetches the caller's starred ids from GET /api/images/stars.
 *
 * toggleStar(id) is optimistic: state flips immediately, then POST/DELETE
 * /api/images/[id]/star runs in the background and reverts on failure.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const DASHBOARD_KEY = 'tae-dashboard-starred';
const userKey = (userId: string) => `tae-starred-${userId}`;

function readIds(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Import legacy localStorage stars, clearing the keys only on a 2xx. */
async function importLegacyStars(userId?: string): Promise<void> {
  if (typeof window === 'undefined') return;

  const keys = userId ? [userKey(userId), DASHBOARD_KEY] : [DASHBOARD_KEY];
  const present = keys.filter((k) => {
    try { return localStorage.getItem(k) !== null; } catch { return false; }
  });
  if (present.length === 0) return;

  const ids = [...new Set(present.flatMap(readIds))].slice(0, 500);

  try {
    const res = await fetch('/api/images/stars/import', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ids }),
    });
    if (res.ok) {
      for (const k of present) {
        try { localStorage.removeItem(k); } catch { /* noop */ }
      }
    }
  } catch {
    // Network failure — keys stay put, retried on next mount.
  }
}

export interface UseStarredResult {
  /** The caller's starred image ids. */
  starred: Set<string>;
  /** Optimistic toggle — flips locally, syncs to the DB, reverts on failure. */
  toggleStar: (id: string) => void;
  /** True until the initial GET resolves. */
  loading: boolean;
}

export function useStarred(userId?: string): UseStarredResult {
  const [starred, setStarred] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Ref mirror so toggleStar reads current state without re-creating itself.
  const starredRef = useRef<Set<string>>(starred);

  const apply = useCallback((next: Set<string>) => {
    starredRef.current = next;
    setStarred(next);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await importLegacyStars(userId);

      try {
        const res  = await fetch('/api/images/stars');
        const data = await res.json();
        if (!cancelled && res.ok && Array.isArray(data.ids)) {
          apply(new Set<string>(data.ids));
        }
      } catch (err) {
        console.error('[useStarred] initial fetch failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [userId, apply]);

  const toggleStar = useCallback((id: string) => {
    const wasStarred = starredRef.current.has(id);

    const next = new Set(starredRef.current);
    wasStarred ? next.delete(id) : next.add(id);
    apply(next);

    const revert = () => {
      const reverted = new Set(starredRef.current);
      wasStarred ? reverted.add(id) : reverted.delete(id);
      apply(reverted);
    };

    fetch(`/api/images/${id}/star`, { method: wasStarred ? 'DELETE' : 'POST' })
      .then((res) => { if (!res.ok) revert(); })
      .catch(() => revert());
  }, [apply]);

  return { starred, toggleStar, loading };
}
