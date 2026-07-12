/**
 * Client-side image compression — shared by the Copy-Ad modal, the session
 * reference-image upload step, and Concept Forge's reference picker.
 *
 * Downscales to a max long edge and JPEG-encodes so we never blow the
 * ~5MB sessionStorage quota or a JSON request body limit. Phone photos come
 * in at 4-8MB as PNG data URLs; after this they are typically 150-400KB.
 *
 * Behavior is identical to the previous inline duplicates in
 * WorkflowCards.tsx and product-selector.tsx.
 */

export interface CompressImageOptions {
  /** Longest edge in px after downscale. Default 1280. */
  maxEdgePx?: number;
  /** JPEG quality 0..1. Default 0.85. */
  quality?: number;
}

export function compressImageToDataUrl(
  file: File,
  { maxEdgePx = 1280, quality = 0.85 }: CompressImageOptions = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const src = reader.result as string;
      const img = new window.Image();
      img.onerror = () => reject(new Error('Image decode failed'));
      img.onload = () => {
        const longEdge = Math.max(img.width, img.height);
        const scale = longEdge > maxEdgePx ? maxEdgePx / longEdge : 1;
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // Fallback to the raw dataUrl — caller handles any size issues downstream.
          resolve(src);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}
