import Link from 'next/link';
import { LayoutDashboard, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export interface Crumb {
  label: string;
  href?: string;   // omit for the current (last) crumb
}

interface BreadcrumbProps {
  crumbs: Crumb[];
  actions?: ReactNode;
  className?: string;
}

export function Breadcrumb({ crumbs, actions, className }: BreadcrumbProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        'mb-5 flex items-center gap-1 text-xs text-brand-slate',
        className,
      )}
    >
      {/* Home — always present */}
      <Link
        href="/dashboard"
        className="flex items-center gap-1 rounded-md px-2 py-1 transition-colors
                   hover:text-brand-forest hover:bg-brand-cream"
        style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
      >
        <LayoutDashboard className="h-3 w-3" />
        Dashboard
      </Link>

      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 text-brand-sage/60 flex-shrink-0" />
            {crumb.href && !isLast ? (
              <Link
                href={crumb.href}
                className="max-w-[200px] truncate rounded-md px-1 py-1 font-medium
                           text-brand-navy transition-colors hover:text-brand-forest
                           hover:bg-brand-cream"
                style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
              >
                {crumb.label}
              </Link>
            ) : (
              <span
                className={cn(
                  'max-w-[200px] truncate px-1 py-1 font-medium',
                  isLast ? 'text-brand-forest' : 'text-brand-navy',
                )}
              >
                {crumb.label}
              </span>
            )}
          </span>
        );
      })}

      {/* Right-side actions */}
      {actions && (
        <>
          <span className="flex-1" />
          <div className="flex items-center gap-2">{actions}</div>
        </>
      )}
    </nav>
  );
}
