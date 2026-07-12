'use client';

/**
 * Chat input — auto-growing textarea (Enter to send, Shift+Enter newline).
 * The Send button doubles as Stop while a reply is in flight; an aborted
 * send gives the draft back.
 */

import { useState } from 'react';
import { Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useForgeStore } from '../state/forge-store';
import type { ForgeChatApi } from '../state/use-forge-chat';

export function ChatComposer({ chat }: { chat: ForgeChatApi }) {
  const { chatInputRef } = useForgeStore();
  const [value, setValue] = useState('');

  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const submit = () => {
    if (chat.pending) {
      chat.stop();
      return;
    }
    const text = value.trim();
    if (!text) return;
    setValue('');
    const el = chatInputRef.current;
    if (el) {
      el.style.height = 'auto';
    }
    void chat.send(text, { onAborted: (draft) => setValue(draft) });
  };

  return (
    <div className="flex items-end gap-2 border-t border-brand-sage/20 p-3">
      <textarea
        ref={(el) => {
          chatInputRef.current = el;
        }}
        rows={1}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          autoGrow(e.target);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Share an idea, or ask for concepts… (Enter to send, Shift+Enter for a new line)"
        className="max-h-[120px] min-h-[36px] flex-1 resize-none rounded-xl border border-brand-sage/30 bg-white px-3 py-2 text-xs leading-relaxed text-brand-navy placeholder:text-brand-slate/50 focus:border-brand-forest focus:outline-none focus:ring-1 focus:ring-brand-forest/20"
      />
      <button
        type="button"
        data-glow=""
        onClick={submit}
        disabled={!chat.pending && !value.trim()}
        className={cn(
          'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold text-white transition-colors disabled:opacity-50',
          chat.pending ? 'bg-brand-wine hover:bg-brand-wine/90' : 'bg-brand-forest hover:bg-brand-forest/90',
        )}
      >
        {chat.pending ? (
          <>
            <Square className="h-3 w-3 fill-current" aria-hidden />
            Stop
          </>
        ) : (
          'Send'
        )}
      </button>
    </div>
  );
}
