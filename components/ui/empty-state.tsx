import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * EmptyState — the app's dashed "nothing here yet" idiom.
 *
 *   <EmptyState icon={Images} title="No images found" subtitle="Generate some ads." />
 *
 * Pass `action` for an optional CTA rendered under the copy.
 */
export interface EmptyStateProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  icon: LucideIcon;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  subtitle,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-dashed border-brand-sage/30 bg-brand-cream/30 py-16 text-center',
        className,
      )}
      {...props}
    >
      <Icon className="mx-auto h-8 w-8 text-brand-sage" aria-hidden />
      <p className="mt-3 text-sm font-medium text-brand-forest">{title}</p>
      {subtitle !== undefined && (
        <p className="mt-1 text-xs text-brand-slate">{subtitle}</p>
      )}
      {action !== undefined && (
        <div className="mt-4 flex justify-center">{action}</div>
      )}
    </div>
  );
}
