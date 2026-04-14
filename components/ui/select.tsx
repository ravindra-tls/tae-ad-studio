'use client';

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const Select       = SelectPrimitive.Root;
const SelectValue  = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex items-center justify-between gap-1.5',
      'rounded-xl border border-brand-sage/25 bg-white px-3 py-[7px]',
      'text-xs font-medium text-brand-slate',
      'cursor-pointer outline-none select-none whitespace-nowrap',
      'hover:border-brand-forest/40 hover:text-brand-forest',
      'focus:border-brand-forest focus:ring-2 focus:ring-brand-forest/15',
      'data-[state=open]:border-brand-forest data-[state=open]:text-brand-forest',
      'data-[placeholder]:text-brand-slate/70',
      'transition-colors duration-150',
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60 transition-transform duration-150 data-[state=open]:rotate-180" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = 'SelectTrigger';

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      sideOffset={6}
      className={cn(
        'relative z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden',
        'rounded-xl border border-brand-sage/20 bg-white shadow-lg',
        'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
        'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.Viewport className="p-1">
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = 'SelectContent';

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-pointer select-none items-center justify-between',
      'rounded-lg px-3 py-2 text-xs font-medium text-brand-slate outline-none',
      'hover:bg-brand-cream hover:text-brand-forest',
      'focus:bg-brand-cream focus:text-brand-forest',
      'data-[state=checked]:text-brand-forest data-[state=checked]:bg-brand-forest/8',
      'transition-colors duration-100',
      className,
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <SelectPrimitive.ItemIndicator>
      <Check className="h-3 w-3 text-brand-forest" />
    </SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>
));
SelectItem.displayName = 'SelectItem';

export { Select, SelectValue, SelectTrigger, SelectContent, SelectItem };
