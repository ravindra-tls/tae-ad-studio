'use client';

/**
 * useEditEntries — the edit-placeholder state machine shared by Gallery and
 * ImageGallery (previously ~80 duplicated lines in each).
 *
 * Lifecycle, driven by EditPromptModal's callbacks:
 *   addPending(tempId, aspectRatio, sourceImage) → placeholder tile appears
 *   resolveSubmitted(tempId, realId, imageUrl?)  → sync providers (xAI/OpenAI)
 *     pass the final URL and skip polling entirely; async providers (Vertex)
 *     set realId and the 2.5s status poll takes over
 *   removeEntry(tempId)                          → submit failed, drop the tile
 *
 * The poll hits /api/generate/{id}/status for every entry with a realId and
 * promotes finished edits into `freshImages` — a copy of the source image
 * re-skinned with the new id/url/aspect — while failed/nsfw entries are
 * dropped silently. Render freshImages ahead of the server-fetched list.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GeneratedImage } from '@/types';

export interface EditEntry<T extends GeneratedImage = GeneratedImage> {
  /** Client-side UUID — React key + reference while the API call is in flight. */
  tempId:      string;
  /** DB row id once the submit route responds; null = call still in flight. */
  realId:      string | null;
  aspectRatio: string;
  sourceImage: T;
}

export interface UseEditEntriesResult<T extends GeneratedImage> {
  editEntries:      EditEntry<T>[];
  freshImages:      T[];
  addPending:       (tempId: string, aspectRatio: string, sourceImage: T) => void;
  resolveSubmitted: (tempId: string, realId: string, imageUrl?: string) => void;
  removeEntry:      (tempId: string) => void;
}

const POLL_INTERVAL_MS = 2500;

/** The promoted image: the source row re-skinned with the edit result. */
function promote<T extends GeneratedImage>(entry: EditEntry<T>, realId: string, imageUrl: string): T {
  // Spreading a generic keeps every extra field (GalleryImage's creator/product
  // columns) intact; the overridden fields match GeneratedImage's types, so the
  // cast is sound for any T extending it.
  return {
    ...entry.sourceImage,
    id:           realId,
    image_url:    imageUrl,
    aspect_ratio: entry.aspectRatio,
    status:       'completed',
    created_at:   new Date().toISOString(),
  } as T;
}

export function useEditEntries<T extends GeneratedImage = GeneratedImage>(): UseEditEntriesResult<T> {
  const [editEntries, setEditEntries] = useState<EditEntry<T>[]>([]);
  const [freshImages, setFreshImages] = useState<T[]>([]);
  const entriesRef = useRef<EditEntry<T>[]>([]);
  entriesRef.current = editEntries;

  // ── Poll entries that have a real ID ─────────────────────────────────────
  useEffect(() => {
    const pollable = editEntries.filter((e) => e.realId !== null);
    if (pollable.length === 0) return;

    const tick = async () => {
      const current = entriesRef.current.filter((e) => e.realId !== null);
      if (current.length === 0) return;

      const results = await Promise.all(
        current.map(async (entry) => {
          try {
            const res  = await fetch(`/api/generate/${entry.realId}/status`);
            const data = await res.json();
            return { entry, status: data.status as string, imageUrl: data.imageUrl as string | undefined };
          } catch {
            return { entry, status: 'unknown', imageUrl: undefined as string | undefined };
          }
        }),
      );

      const doneIds:   string[] = [];
      const completed: T[]      = [];

      for (const { entry, status, imageUrl } of results) {
        if (status === 'completed' && imageUrl) {
          completed.push(promote(entry, entry.realId!, imageUrl));
          doneIds.push(entry.tempId);
        } else if (status === 'failed' || status === 'nsfw') {
          doneIds.push(entry.tempId);
        }
        // otherwise keep polling
      }

      if (completed.length > 0) setFreshImages((prev) => [...completed, ...prev]);
      if (doneIds.length > 0)   setEditEntries((prev) => prev.filter((e) => !doneIds.includes(e.tempId)));
    };

    const id = setInterval(tick, POLL_INTERVAL_MS);
    tick(); // fire immediately — sync providers usually have the result at once
    return () => clearInterval(id);
  // Re-arm only when the set of pollable real IDs changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editEntries.filter((e) => e.realId).map((e) => e.realId).join(',')]);

  // ── EditPromptModal callbacks ─────────────────────────────────────────────
  const addPending = useCallback((tempId: string, aspectRatio: string, sourceImage: T) => {
    setEditEntries((prev) => [...prev, { tempId, realId: null, aspectRatio, sourceImage }]);
  }, []);

  const resolveSubmitted = useCallback((tempId: string, realId: string, imageUrl?: string) => {
    if (imageUrl) {
      // Sync provider — the submit route already returned the final URL.
      // Promote immediately (deduped by id in case the poll raced us).
      const entry = entriesRef.current.find((e) => e.tempId === tempId);
      if (entry) {
        setFreshImages((prev) => {
          if (prev.some((img) => img.id === realId)) return prev;
          return [promote(entry, realId, imageUrl), ...prev];
        });
      }
      setEditEntries((prev) => prev.filter((e) => e.tempId !== tempId));
    } else {
      // Async provider — record the real id and let the poll pick it up.
      setEditEntries((prev) => prev.map((e) => (e.tempId === tempId ? { ...e, realId } : e)));
    }
  }, []);

  const removeEntry = useCallback((tempId: string) => {
    setEditEntries((prev) => prev.filter((e) => e.tempId !== tempId));
  }, []);

  return { editEntries, freshImages, addPending, resolveSubmitted, removeEntry };
}
