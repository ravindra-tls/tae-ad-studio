'use client';

/**
 * Chat bubbles: user / assistant, concept chips that jump to the board
 * (Notion-style mentions), a hover action bar (Copy always, Retry on the
 * latest reply), and the thinking indicator.
 */

import { Copy, RotateCw, Sparkle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useForgeStore, truncate } from '../state/forge-store';
import type { ChatMessage } from '../state/types';

export function ThinkingBubble() {
  return (
    <div className="flex max-w-[85%] items-center gap-2 self-start rounded-2xl rounded-bl-sm bg-brand-cream/70 px-3 py-2">
      <span className="flex items-center gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-dot-pulse rounded-full bg-brand-forest/50"
            style={{ animationDelay: `${i * 180}ms` }}
          />
        ))}
      </span>
      <span className="text-xs italic text-brand-slate">thinking…</span>
    </div>
  );
}

export function UserEcho({ text }: { text: string }) {
  return (
    <div className="max-w-[85%] self-end whitespace-pre-wrap rounded-2xl rounded-br-sm bg-brand-forest px-3 py-2 text-xs leading-relaxed text-white">
      {text}
    </div>
  );
}

export function ChatMessageView({
  msg,
  isLastAssistant,
  onRetry,
}: {
  msg: ChatMessage;
  isLastAssistant: boolean;
  onRetry: () => void;
}) {
  const { revealCard, showSnack } = useForgeStore();

  if (msg.role === 'user') return <UserEcho text={msg.text} />;

  const copy = () => {
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(msg.text)
        .then(() => showSnack({ message: 'Copied' }))
        .catch(() => showSnack({ message: 'Copy failed', tone: 'error' }));
    }
  };

  return (
    <div className="group flex max-w-[92%] flex-col gap-1.5 self-start">
      <div className="whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-brand-cream/70 px-3 py-2 text-xs leading-relaxed text-brand-navy">
        {msg.text}
      </div>

      {/* Concepts this reply created — chips that jump to the board */}
      {!!msg.cards?.length && (
        <div className="flex flex-wrap gap-1">
          {msg.cards.map((c) => (
            <button
              key={c.id}
              type="button"
              title="Show on the board"
              onClick={() => revealCard(c.id)}
              className="inline-flex items-center gap-1 rounded-full border border-brand-forest/25 bg-white px-2 py-0.5 text-[11px] font-medium text-brand-forest hover:bg-brand-cream"
            >
              <Sparkle className="h-3 w-3" aria-hidden />
              {truncate(c.tagline, 40)}
            </button>
          ))}
        </div>
      )}

      {/* Hover action bar */}
      <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-brand-slate hover:bg-brand-cream hover:text-brand-forest"
        >
          <Copy className="h-3 w-3" aria-hidden />
          Copy
        </button>
        {isLastAssistant && (
          <button
            type="button"
            title="Regenerate this reply"
            onClick={onRetry}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-brand-slate hover:bg-brand-cream hover:text-brand-forest"
          >
            <RotateCw className="h-3 w-3" aria-hidden />
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

export function SuggestionChip({
  text,
  icon,
  onPick,
}: {
  text: string;
  icon?: React.ReactNode;
  onPick: (text: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(text)}
      className={cn(
        'filter-pill inline-flex items-center gap-1.5 rounded-full border border-brand-sage/40 bg-white',
        'px-2.5 py-1 text-left text-[11px] font-medium text-brand-slate',
        'hover:border-brand-forest/50 hover:text-brand-forest',
      )}
    >
      {icon}
      <span className="min-w-0">{text}</span>
    </button>
  );
}
