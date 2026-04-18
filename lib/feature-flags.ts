/**
 * Feature flag primitive — server side.
 *
 * Flag evaluation rule:
 *
 *   isEnabled(flagName, userId) is true iff
 *     flag exists AND
 *     flag.enabled = true AND (
 *       userId is in flag.allowed_user_ids
 *       OR
 *       bucket(userId, flagName) < flag.rollout_percentage
 *     )
 *
 * The bucket is a deterministic SHA-256 hash of `${userId}:${flagName}` mod
 * 100, so a given user always lands in the same bucket for a given flag. This
 * means ramping rollout_percentage never re-randomizes assignments.
 *
 * Admin writes go through /api/admin/feature-flags; this file is read-only.
 */

import { createHash } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import type { FeatureFlag } from '@/types';

/** Returns true if `flagName` is enabled for `userId`. */
export async function isEnabled(
  flagName: string,
  userId?: string | null,
): Promise<boolean> {
  const flag = await getFlag(flagName);
  if (!flag || !flag.enabled) return false;

  // Anonymous users only see the flag at 100% rollout — we can't bucket them.
  if (!userId) return flag.rollout_percentage >= 100;

  if (flag.allowed_user_ids.includes(userId)) return true;
  if (flag.rollout_percentage <= 0) return false;
  if (flag.rollout_percentage >= 100) return true;

  return bucketFor(userId, flagName) < flag.rollout_percentage;
}

/** Fetch a single flag by name. Returns null if the flag doesn't exist. */
export async function getFlag(flagName: string): Promise<FeatureFlag | null> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from('feature_flags')
    .select('*')
    .eq('name', flagName)
    .maybeSingle();

  if (error) {
    console.error('[feature-flags] getFlag failed:', error.message);
    return null;
  }
  return (data as FeatureFlag | null) ?? null;
}

/** Fetch every flag. Used by the admin page. */
export async function getAllFlags(): Promise<FeatureFlag[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from('feature_flags')
    .select('*')
    .order('name');

  if (error) {
    console.error('[feature-flags] getAllFlags failed:', error.message);
    return [];
  }
  return (data as FeatureFlag[]) ?? [];
}

/**
 * Deterministic 0-99 bucket for a (user, flag) pair. Exposed for testing —
 * prefer `isEnabled` in application code.
 */
export function bucketFor(userId: string, flagName: string): number {
  const hash = createHash('sha256').update(`${userId}:${flagName}`).digest();
  return hash.readUInt32BE(0) % 100;
}
