'use client';

/**
 * Select-text-to-comment. Only actual creative copy is commentable — every
 * commentable element carries `data-commentable`, and both selection
 * endpoints must sit inside the SAME one. The owning card/champion is found
 * via the nearest `[data-comment-scope][data-comment-id]` ancestor.
 */

import { useEffect } from 'react';
import type { CommentItem } from '../state/types';

export interface SelectionRect {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export interface SelectionTarget {
  mode: 'card' | 'champion';
  id: string;
  quote: string;
  rect: SelectionRect;
}

function toElement(node: Node | null): HTMLElement | null {
  if (!node) return null;
  const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement);
  return el instanceof HTMLElement ? el : null;
}

export function useTextSelection(onSelect: (target: SelectionTarget) => void): void {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const origin = e.target as HTMLElement | null;
      if (origin?.closest?.('[data-comment-widget]')) return;
      // Selection settles after mouseup — read it on the next tick.
      setTimeout(() => {
        const sel = window.getSelection();
        const text = sel ? sel.toString().trim() : '';
        if (!sel || !text || text.length < 2 || !sel.rangeCount) return;
        const a = toElement(sel.anchorNode);
        const b = toElement(sel.focusNode);
        if (!a || !b) return;
        const commentable = a.closest('[data-commentable]');
        if (!commentable || commentable !== b.closest('[data-commentable]')) return;
        const scope = commentable.closest<HTMLElement>('[data-comment-scope]');
        if (!scope) return;
        const mode = scope.dataset.commentScope;
        const id = scope.dataset.commentId;
        if (!id || (mode !== 'card' && mode !== 'champion')) return;
        const r = sel.getRangeAt(0).getBoundingClientRect();
        onSelect({
          mode,
          id,
          quote: text,
          rect: { top: r.top, left: r.left, bottom: r.bottom, right: r.right },
        });
      }, 0);
    };
    document.addEventListener('mouseup', handler);
    return () => document.removeEventListener('mouseup', handler);
  }, [onSelect]);
}

// ── Fuzzy comment→copy marker assignment (shared by board + detail) ──────────

export function normalizeQuote(s: string | undefined | null): string {
  return String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Assign each comment to the FIRST field (in display order) whose text
 * contains its quote. Returns fieldKey → comment indices.
 */
export function assignCommentMarkers(
  comments: CommentItem[],
  fields: Array<{ key: string; text: string }>,
): Record<string, number[]> {
  const map: Record<string, number[]> = {};
  comments.forEach((cm, i) => {
    const q = normalizeQuote(cm.quote);
    if (!q) return;
    const field = fields.find((f) => normalizeQuote(f.text).includes(q));
    if (!field) return;
    (map[field.key] = map[field.key] || []).push(i);
  });
  return map;
}
