'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, Package, CheckCircle, FileText, Settings, LayoutDashboard, MessageSquarePlus } from 'lucide-react';
import { cn } from '@/lib/utils';

const adminLinks = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/products', label: 'Products', icon: Package },
  { href: '/admin/approvals', label: 'Approvals', icon: CheckCircle },
  { href: '/admin/feedback', label: 'Feedback', icon: MessageSquarePlus },
  { href: '/admin/templates', label: 'Templates', icon: FileText },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-4">
      <h2 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-brand-slate/60">Admin Panel</h2>
      {adminLinks.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || (href !== '/admin' && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-brand-teal text-white'
                : 'text-brand-slate hover:bg-brand-cream/50 hover:text-brand-teal'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
