/**
 * Reference image URL resolution.
 *
 * Reference images may live in:
 *   1. A private Supabase bucket (`product-references`) — `storage_path` set,
 *      resolved to a signed URL with a short TTL.
 *   2. A legacy/external URL (`url` set, `storage_path` null) — passed through.
 *
 * The pipeline calls `resolveReferenceImage*` right before handing the URL
 * to the image provider's `toInlineImage` helper, which fetches the bytes
 * and base64-encodes them. One hour is plenty — the fetch happens almost
 * immediately and a fresh signed URL is minted on each generation.
 */

import { createServiceClient } from '@/lib/supabase/server';
import type { ProductImage, ResolvedProductImage } from '@/types';

/** Default TTL for signed URLs in seconds. One hour covers even slow pipelines. */
export const REFERENCE_IMAGE_TTL_SECONDS = 60 * 60;

/**
 * Resolve a single product image row to a fetchable URL.
 *
 * Returns `null` only when both `url` and `storage_path` are missing, which
 * the schema forbids via check constraint — but we're defensive.
 */
export async function resolveReferenceImage(
  image: ProductImage,
  ttlSeconds: number = REFERENCE_IMAGE_TTL_SECONDS,
): Promise<ResolvedProductImage | null> {
  if (image.storage_path && image.storage_bucket) {
    const supabase = await createServiceClient();
    const { data, error } = await supabase.storage
      .from(image.storage_bucket)
      .createSignedUrl(image.storage_path, ttlSeconds);

    if (error || !data?.signedUrl) {
      console.error(
        '[reference-images] signed URL failed:',
        image.id,
        error?.message,
      );
      // Fall back to legacy url if present, otherwise give up.
      if (image.url) return { ...image, resolved_url: image.url };
      return null;
    }

    return { ...image, resolved_url: data.signedUrl };
  }

  if (image.url) return { ...image, resolved_url: image.url };

  // Should never happen given the check constraint.
  console.error('[reference-images] row has neither storage_path nor url:', image.id);
  return null;
}

/** Resolve an array of product images. Drops any that fail to resolve. */
export async function resolveReferenceImages(
  images: ProductImage[],
  ttlSeconds: number = REFERENCE_IMAGE_TTL_SECONDS,
): Promise<ResolvedProductImage[]> {
  const resolved = await Promise.all(
    images.map((img) => resolveReferenceImage(img, ttlSeconds)),
  );
  return resolved.filter((r): r is ResolvedProductImage => r !== null);
}
