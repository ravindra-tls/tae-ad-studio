import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-forest focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-brand-forest text-white hover:bg-brand-forest/90',
        destructive: 'bg-brand-wine text-white hover:bg-brand-wine/90',
        outline: 'border border-brand-forest/20 bg-white hover:bg-brand-cream text-brand-forest',
        secondary: 'bg-brand-cream text-brand-forest hover:bg-brand-cream/80',
        ghost: 'hover:bg-brand-cream/50 text-brand-forest',
        gold: 'bg-brand-lime text-white hover:bg-brand-lime/90',
        wine: 'bg-brand-wine text-white hover:bg-brand-wine/90',
        link: 'text-brand-forest underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-xl px-3',
        lg: 'h-11 rounded-xl px-8 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    // Pointer-tracking glow is reserved for primary CTAs (default + gold) —
    // secondary/ghost/outline/etc. stay quiet. Callers can still opt in
    // explicitly by passing data-glow themselves.
    const hasGlow = (variant ?? 'default') === 'default' || variant === 'gold';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...(hasGlow ? { 'data-glow': '' } : {})}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
