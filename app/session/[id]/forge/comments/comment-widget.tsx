'use client';

/**
 * Floating comment popover — the ONLY modal-ish surface in the forge.
 * Fixed positioning (the selection rect is viewport-based) so it lands on
 * the selection even inside the scrolled detail view or a scrolled feed.
 * Keys typed here must never reach page-level shortcut handlers.
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { truncate } from '../state/forge-store';
import type { SelectionTarget } from './use-text-selection';

interface CommentWidgetProps {
  target: SelectionTarget;
  onAdd: (comment: string) => void;
  onClose: () => void;
}

export function CommentWidget({ target, onAdd, onClose }: CommentWidgetProps) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const [value, setValue] = useState('');

  useEffect(() => {
    taRef.current?.focus({ preventScroll: true });
    // Survive the mouseup/entry-animation race.
    requestAnimationFrame(() => taRef.current?.focus({ preventScroll: true }));
  }, []);

  // Click anywhere outside dismisses.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el?.closest?.('[data-comment-widget]')) {
        window.getSelection()?.removeAllRanges();
        onClose();
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [onClose]);

  const add = () => {
    const comment = value.trim();
    if (!comment) {
      taRef.current?.focus();
      return;
    }
    window.getSelection()?.removeAllRanges();
    onAdd(comment);
  };

  const cancel = () => {
    window.getSelection()?.removeAllRanges();
    onClose();
  };

  const top = Math.min(target.rect.bottom + 6, window.innerHeight - 180);
  const left = Math.min(Math.max(target.rect.left, 8), window.innerWidth - 290);

  return createPortal(
    <div
      data-comment-widget
      className="fixed z-50 flex w-[280px] flex-col gap-2 rounded-xl border border-brand-forest/20 bg-white p-3 shadow-xl animate-modal-in"
      style={{ top, left }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') cancel();
      }}
      onKeyUp={(e) => e.stopPropagation()}
    >
      <div className="text-[11px] italic leading-snug text-brand-slate">
        &ldquo;{truncate(target.quote, 120)}&rdquo;
      </div>
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) add();
        }}
        placeholder="What should change about this? (e.g. make it warmer, shorter, more specific)"
        rows={3}
        className="w-full resize-none rounded-lg border border-brand-sage/40 bg-white px-2.5 py-1.5 text-xs text-brand-navy placeholder:text-brand-slate/50 focus:border-brand-forest focus:outline-none focus:ring-1 focus:ring-brand-forest/20"
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs" onClick={cancel}>
          Cancel
        </Button>
        <Button size="sm" className="h-7 px-2.5 text-xs" onClick={add}>
          Add comment
        </Button>
      </div>
    </div>,
    document.body,
  );
}
