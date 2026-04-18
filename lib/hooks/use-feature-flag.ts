'use client';

import { useEffect, useState } from 'react';

/**
 * Client hook for feature flag evaluation.
 *
 *   const { enabled, loading } = useFeatureFlag('brief_first_ui');
 *   if (loading) return <Skeleton />;
 *   return enabled ? <BriefFirstUI /> : <TemplateGrid />;
 *
 * Calls /api/feature-flags/check once per mount, per flag. Cheap — the route
 * is a single indexed row lookup in Postgres.
 *
 * For pages that read flags at render time (SSR), prefer calling
 * `isEnabled()` directly from a server component instead of this hook.
 */
export function useFeatureFlag(flagName: string): {
  enabled: boolean;
  loading: boolean;
} {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`/api/feature-flags/check?flag=${encodeURIComponent(flagName)}`, {
      credentials: 'include',
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setEnabled(Boolean(data?.enabled));
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[useFeatureFlag] failed:', err);
        setEnabled(false);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [flagName]);

  return { enabled, loading };
}
