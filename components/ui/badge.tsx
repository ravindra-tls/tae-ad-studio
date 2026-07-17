import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-brand-forest text-white',
        secondary: 'border-transparent bg-brand-cream text-brand-forest',
        outline: 'border-brand-forest/20 text-brand-forest',
        wine: 'border-transparent bg-brand-wine text-white',
        gold: 'border-transparent bg-brand-lime text-white',
        success: 'border-transparent bg-brand-forest/10 text-brand-forest',
        warning: 'border-transparent bg-amber-100 text-amber-700',
        destructive: 'border-transparent bg-brand-wine/10 text-brand-wine',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
