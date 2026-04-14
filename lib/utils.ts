import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Downloads an image from a cross-origin URL (e.g. Supabase Storage).
 * The <a download> attribute is ignored for cross-origin URLs, so we
 * fetch the image as a blob first and create a local object URL.
 */
export async function downloadImage(url: string, filename: string) {
  try {
    const res  = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href     = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
  } catch (err) {
    console.error('[downloadImage] failed:', err);
  }
}

export function daysUntilReset(cycleReset: string) {
  const reset = new Date(cycleReset);
  const now = new Date();
  const diff = Math.ceil((reset.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}
