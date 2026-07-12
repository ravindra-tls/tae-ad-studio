'use client';

/**
 * The creative-partner rail. Inline column at xl+ (collapsible to a strip
 * with a lime unread dot); below xl it lives behind a floating button as a
 * fixed overlay sheet sliding in from the right.
 */

import { useEffect, useRef } from 'react';
import {
  Brain,
  Clapperboard,
  Lightbulb,
  PanelRightClose,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useForgeStore } from '../state/forge-store';
import { useForgeChat, type ForgeChatApi } from '../state/use-forge-chat';
import { ChatMessageView, SuggestionChip, ThinkingBubble, UserEcho } from './chat-message';
import { ChatContextStrip } from './chat-context-strip';
import { ChatComposer } from './chat-composer';

const STARTER_ICONS = [Sparkles, Clapperboard, Lightbulb, Target];

function UnreadDot({ className }: { className?: string }) {
  return (
    <span
      className={cn('h-2 w-2 animate-dot-pulse rounded-full bg-brand-lime', className)}
      aria-label="New reply"
    />
  );
}

function ChatPanel({ chat, onCollapse }: { chat: ForgeChatApi; onCollapse: () => void }) {
  const { state } = useForgeStore();
  const logRef = useRef<HTMLDivElement | null>(null);
  const messages = state.session?.chat || [];
  const suggestions = state.suggestions;

  const lastAssistant = messages.map((m) => m.role).lastIndexOf('assistant');

  // Keep the log pinned to the latest turn.
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, chat.echo, chat.pending]);

  const pick = (text: string) => void chat.send(text);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-brand-sage/20 px-3 py-2.5">
        <Brain className="h-4 w-4 shrink-0 text-brand-forest" aria-hidden />
        <div className="min-w-0 flex-1">
          <span className="text-xs font-semibold text-brand-forest">Creative partner</span>{' '}
          <span className="text-[10px] text-brand-slate/70">steer me anytime</span>
        </div>
        <button
          type="button"
          title="Collapse chat"
          onClick={onCollapse}
          className="rounded-lg p-1 text-brand-slate/60 hover:bg-brand-cream hover:text-brand-forest"
        >
          <PanelRightClose className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {/* Log */}
      <div ref={logRef} className="scroll-spring flex flex-1 flex-col gap-2 overflow-y-auto p-3">
        {!messages.length && !chat.echo ? (
          <div className="flex flex-col gap-3 pt-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-forest">
              <Brain className="h-4 w-4" aria-hidden />
              Your creative partner
            </div>
            <p className="text-xs leading-relaxed text-brand-slate">
              Share a half-formed idea, pin a Brief above, or start from one of these:
            </p>
            <div className="flex flex-col items-start gap-1.5">
              {suggestions.map((s, i) => {
                const Icon = STARTER_ICONS[i % STARTER_ICONS.length];
                return (
                  <SuggestionChip
                    key={s}
                    text={s}
                    icon={<Icon className="h-3 w-3 shrink-0 text-brand-forest" aria-hidden />}
                    onPick={pick}
                  />
                );
              })}
            </div>
          </div>
        ) : (
          <>
            {messages.map((m, i) => (
              <ChatMessageView
                key={i}
                msg={m}
                isLastAssistant={i === lastAssistant && !chat.pending}
                onRetry={() => void chat.send(null, { retry: true })}
              />
            ))}
            {chat.echo && <UserEcho text={chat.echo} />}
            {chat.pending && <ThinkingBubble />}
          </>
        )}
      </div>

      {/* Suggestions below the log once the conversation has started */}
      {messages.length > 0 && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2">
          {suggestions.map((s) => (
            <SuggestionChip key={s} text={s} onPick={pick} />
          ))}
        </div>
      )}

      <ChatContextStrip />
      <ChatComposer chat={chat} />
    </div>
  );
}

export function ChatRail() {
  const { state, dispatch, setRail } = useForgeStore();
  const chat = useForgeChat();
  const { railOpen, overlayOpen, unread } = state.ui;

  return (
    <>
      {/* ── Inline column (xl+) ── */}
      <aside
        className={cn(
          'hidden h-full min-h-0 shrink-0 flex-col border-l border-brand-forest/10 bg-white xl:flex',
          railOpen ? 'w-[340px]' : 'w-12',
        )}
      >
        {railOpen ? (
          <ChatPanel chat={chat} onCollapse={() => setRail(false)} />
        ) : (
          <button
            type="button"
            title="Open the creative partner ( / )"
            onClick={() => setRail(true, { focus: true })}
            className="relative flex h-full w-full flex-col items-center gap-2 pt-4 text-brand-slate/70 hover:bg-brand-cream/50 hover:text-brand-forest"
          >
            <Brain className="h-5 w-5" aria-hidden />
            {unread && <UnreadDot className="absolute right-2.5 top-3" />}
            <span className="text-[10px] font-semibold uppercase tracking-widest [writing-mode:vertical-rl]">
              Partner
            </span>
          </button>
        )}
      </aside>

      {/* ── Floating button + overlay sheet (below xl) ── */}
      <div className="xl:hidden">
        {!overlayOpen && (
          <button
            type="button"
            title="Open the creative partner ( / )"
            onClick={() => dispatch({ type: 'SET_OVERLAY', open: true })}
            className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-brand-forest text-white shadow-lg hover:bg-brand-forest/90"
          >
            <Brain className="h-5 w-5" aria-hidden />
            {unread && <UnreadDot className="absolute right-1 top-1" />}
          </button>
        )}
        {overlayOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/25"
              onClick={() => dispatch({ type: 'SET_OVERLAY', open: false })}
              aria-hidden
            />
            <div className="fixed inset-y-0 right-0 z-50 flex w-[360px] max-w-[92vw] animate-slide-in-right flex-col border-l border-brand-forest/10 bg-white shadow-2xl">
              <div className="flex justify-end border-b border-brand-sage/20 px-2 py-1.5">
                <button
                  type="button"
                  title="Close chat"
                  onClick={() => dispatch({ type: 'SET_OVERLAY', open: false })}
                  className="rounded-lg p-1 text-brand-slate/60 hover:bg-brand-cream hover:text-brand-forest"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <div className="min-h-0 flex-1">
                <ChatPanel
                  chat={chat}
                  onCollapse={() => dispatch({ type: 'SET_OVERLAY', open: false })}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
