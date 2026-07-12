'use client';

/**
 * Snackbar — TAE's notify-don't-hijack toast, built on @radix-ui/react-toast.
 *
 * Usage:
 *   <SnackbarProvider>…app…</SnackbarProvider>
 *   const snackbar = useSnackbar();
 *   snackbar.show({ message: 'Concept finalized', action: { label: 'View', onClick } });
 *
 * Tones: 'default' (white, forest border) and 'error' (wine). Durations:
 * 3s default, 6s when tone is error or an action is attached.
 */

import * as React from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface SnackbarOptions {
  message: string;
  tone?: 'default' | 'error';
  action?: { label: string; onClick: () => void };
  /** Override auto duration (ms). */
  duration?: number;
}

interface SnackbarItem extends SnackbarOptions {
  id: number;
}

interface SnackbarContextValue {
  show: (opts: SnackbarOptions) => void;
}

const SnackbarContext = React.createContext<SnackbarContextValue | null>(null);

export function useSnackbar(): SnackbarContextValue {
  const ctx = React.useContext(SnackbarContext);
  if (!ctx) throw new Error('useSnackbar must be used within a <SnackbarProvider>');
  return ctx;
}

let nextId = 1;

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<SnackbarItem[]>([]);

  const show = React.useCallback((opts: SnackbarOptions) => {
    setItems((prev) => [...prev.slice(-2), { ...opts, id: nextId++ }]);
  }, []);

  const remove = React.useCallback((id: number) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const value = React.useMemo(() => ({ show }), [show]);

  return (
    <SnackbarContext.Provider value={value}>
      <ToastPrimitive.Provider swipeDirection="down">
        {children}
        {items.map((item) => {
          const isError = item.tone === 'error';
          const duration = item.duration ?? (isError || item.action ? 6000 : 3000);
          return (
            <ToastPrimitive.Root
              key={item.id}
              duration={duration}
              onOpenChange={(open) => {
                if (!open) remove(item.id);
              }}
              className={cn(
                'pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-2.5 shadow-lg',
                'text-sm font-medium',
                'data-[state=open]:animate-slide-up',
                'data-[swipe=end]:translate-y-2 data-[swipe=end]:opacity-0 data-[swipe=end]:transition-all',
                isError
                  ? 'border-brand-wine/40 bg-brand-wine text-white'
                  : 'border-brand-forest/25 bg-white text-brand-forest',
              )}
            >
              <ToastPrimitive.Description className="max-w-[420px]">
                {item.message}
              </ToastPrimitive.Description>
              {item.action && (
                <ToastPrimitive.Action asChild altText={item.action.label}>
                  <Button
                    size="sm"
                    className="h-7 shrink-0 bg-brand-forest px-3 text-xs text-white hover:bg-brand-forest/90"
                    onClick={item.action.onClick}
                  >
                    {item.action.label}
                  </Button>
                </ToastPrimitive.Action>
              )}
            </ToastPrimitive.Root>
          );
        })}
        <ToastPrimitive.Viewport
          className="fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2 outline-none"
        />
      </ToastPrimitive.Provider>
    </SnackbarContext.Provider>
  );
}
