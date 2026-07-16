'use client';

/**
 * Modal — TAE's standard dialog scaffolding (portal + overlay + panel).
 *
 * Usage:
 *   <Modal open onClose={close} title="Add Product" subtitle="Optional line" footer={<Buttons/>}>
 *     <div className="flex-1 overflow-y-auto px-6 py-4">…body…</div>
 *   </Modal>
 *
 * The panel is a flex column capped at 90vh — callers own their scroll
 * container inside `children` (usually `flex-1 overflow-y-auto`). Omit
 * `title` to bring your own header; omit `footer` to bring your own footer.
 *
 * Behavior: Escape closes (unless a [data-lightbox-open] element is stacked
 * on top), overlay click closes, panel clicks don't propagate, body scroll is
 * locked while open. Pass `disableClose` to block all close paths while a
 * request is in flight.
 *
 * Entrance animations use the raw modalIn/overlayIn keyframes from
 * globals.css via inline style — Tailwind animate-* classes do not reach
 * portalled elements in this app.
 */

import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Standard header row (font-serif, brand-forest) with an X close button. */
  title?: React.ReactNode;
  /** Small muted line under the title. */
  subtitle?: React.ReactNode;
  /** Tailwind max-width class for the panel. Default 'max-w-2xl'. */
  maxWidth?: string;
  /** Extra classes for the panel (e.g. 'max-h-[80vh]', 'overflow-hidden'). */
  className?: string;
  /** Standard footer row (border-t + px-6 py-4). Provide your own flex layout inside. */
  footer?: React.ReactNode;
  /** Block Escape / overlay click / X while true (e.g. request in flight). */
  disableClose?: boolean;
  children: React.ReactNode;
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  maxWidth = 'max-w-2xl',
  className,
  footer,
  disableClose = false,
  children,
}: ModalProps) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);

  // Escape closes while open — skipped when a lightbox is stacked above us.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('[data-lightbox-open]')) return;
      if (!disableClose) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, disableClose, onClose]);

  // Lock body scroll while open (save/restore whatever was there before).
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open || !mounted) return null;

  const requestClose = () => { if (!disableClose) onClose(); };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        animation: 'overlayIn 0.2s ease both',
      }}
      onClick={requestClose}
    >
      <div
        className={cn(
          'relative flex max-h-[90vh] w-full flex-col rounded-2xl bg-white shadow-xl',
          maxWidth,
          className,
        )}
        style={{ animation: 'modalIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both' }}
        onClick={(e) => e.stopPropagation()}
      >
        {title !== undefined && (
          <div className="flex items-start justify-between border-b border-brand-sage/20 px-6 py-4">
            <div className="min-w-0 flex-1">
              <h2 className="font-serif text-lg text-brand-forest">{title}</h2>
              {subtitle !== undefined && (
                <p className="mt-0.5 text-xs text-brand-slate">{subtitle}</p>
              )}
            </div>
            <button
              type="button"
              onClick={requestClose}
              aria-label="Close"
              className="ml-3 mt-0.5 shrink-0 rounded-lg p-1.5 text-brand-slate transition-colors hover:bg-brand-cream hover:text-brand-forest"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {children}
        {footer !== undefined && (
          <div className="shrink-0 border-t border-brand-sage/20 px-6 py-4">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}
