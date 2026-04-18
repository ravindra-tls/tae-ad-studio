'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Folders,
  Shield,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Package,
  Users,
  MessageSquarePlus,
  GalleryHorizontalEnd,
  BarChart3,
  Palette,
  Flag,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  fullName:  string | null;
  email:     string | null;
  isAdmin:   boolean;
}

const NAV = [
  { href: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/session/new',  label: 'New Session',  icon: Folders },
  { href: '/gallery',      label: 'Gallery',      icon: GalleryHorizontalEnd },
  { href: '/feedback',     label: 'Feedback',     icon: MessageSquarePlus },
];

const ADMIN_NAV = [
  { href: '/admin/products',       label: 'Products',       icon: Package },
  { href: '/admin/users',          label: 'Users',          icon: Users },
  { href: '/admin/brand',          label: 'Brand Config',   icon: Palette },
  { href: '/admin/feature-flags',  label: 'Feature Flags',  icon: Flag },
  { href: '/admin/feedback',       label: 'Feedback',       icon: MessageSquarePlus },
  { href: '/admin/stats',          label: 'Stats',          icon: BarChart3 },
];

export function Sidebar({ fullName, email, isAdmin }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  // Persist preference
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved !== null) setCollapsed(saved === 'true');
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      localStorage.setItem('sidebar-collapsed', String(!prev));
      return !prev;
    });
  };

  const initials = fullName
    ? fullName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : (email?.[0] ?? 'U').toUpperCase();

  return (
    <aside
      className={cn(
        'relative flex flex-col h-full border-r border-brand-forest/10 bg-white overflow-y-auto',
        'transition-[width] duration-300',
        collapsed ? 'w-16' : 'w-64',
      )}
      style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
    >
      {/* ── Header ── */}
      <div
        className={cn(
          'flex items-center border-b border-brand-forest/10 px-3 py-[14px]',
          collapsed ? 'justify-center' : 'gap-2',
        )}
      >
        {/* Logo — hidden when collapsed (nav shows icon link instead) */}
        <Link
          href="/dashboard"
          className={cn(
            'flex items-center gap-2 shrink-0 min-w-0 flex-1 overflow-hidden transition-[opacity,width] duration-200',
            collapsed ? 'opacity-0 w-0 pointer-events-none' : 'opacity-100',
          )}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-forest">
            <Sparkles className="h-3.5 w-3.5 text-brand-lime" />
          </div>
          <span className="font-serif text-lg text-brand-forest whitespace-nowrap">
            TAE Ad Studio
          </span>
        </Link>

        {/* Toggle button — always visible in header */}
        <button
          onClick={toggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
            'text-brand-slate/60 hover:text-brand-forest hover:bg-brand-forest/8',
            'transition-all duration-150',
          )}
          style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
        >
          {collapsed
            ? <PanelLeftOpen  className="h-4 w-4" />
            : <PanelLeftClose className="h-4 w-4" />
          }
        </button>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 px-2 py-3">
        <div className="flex flex-col gap-0.5">

          {/* Logo icon link — only shown when collapsed */}
          {collapsed && (
            <Link
              href="/dashboard"
              title="TAE Ad Studio"
              className="flex items-center justify-center rounded-lg py-2 mb-1 hover:bg-brand-cream transition-colors duration-150"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-forest">
                <Sparkles className="h-3.5 w-3.5 text-brand-lime" />
              </div>
            </Link>
          )}

          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={cn(
                  'group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-150',
                  'hover:bg-brand-cream hover:text-brand-forest',
                  active
                    ? 'bg-brand-forest/10 text-brand-forest'
                    : 'text-brand-slate',
                  collapsed && 'justify-center px-0',
                )}
                style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
              >
                <Icon className={cn('h-4 w-4 shrink-0', active && 'text-brand-forest')} />
                <span
                  className={cn(
                    'whitespace-nowrap transition-[opacity,width] duration-200 overflow-hidden',
                    collapsed ? 'opacity-0 w-0' : 'opacity-100',
                  )}
                >
                  {label}
                </span>
              </Link>
            );
          })}

          {isAdmin && (
            <>
              {/* Admin section header */}
              <Link
                href="/admin"
                title={collapsed ? 'Admin' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-brand-wine',
                  'hover:bg-red-50 transition-all duration-150',
                  (pathname === '/admin') && 'bg-red-50',
                  collapsed && 'justify-center px-0',
                )}
              >
                <Shield className="h-4 w-4 shrink-0" />
                <span
                  className={cn(
                    'whitespace-nowrap transition-[opacity,width] duration-200 overflow-hidden',
                    collapsed ? 'opacity-0 w-0' : 'opacity-100',
                  )}
                >
                  Admin Dashboard
                </span>
              </Link>

              {/* Admin sub-nav — shown expanded */}
              {!collapsed && (
                <div className="ml-3 pl-3 border-l border-brand-wine/20 flex flex-col gap-0.5">
                  {ADMIN_NAV.map(({ href, label, icon: Icon }) => {
                    const active = pathname.startsWith(href);
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={cn(
                          'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-xs font-medium transition-all duration-150',
                          active
                            ? 'bg-brand-wine/10 text-brand-wine'
                            : 'text-brand-slate/70 hover:bg-brand-cream hover:text-brand-forest',
                        )}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        {label}
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* Collapsed: icon-only sub-nav */}
              {collapsed && (
                <>
                  {ADMIN_NAV.map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      title={label}
                      className={cn(
                        'flex items-center justify-center rounded-lg px-0 py-2 text-xs font-medium transition-all duration-150',
                        pathname.startsWith(href)
                          ? 'bg-brand-wine/10 text-brand-wine'
                          : 'text-brand-slate/60 hover:bg-brand-cream hover:text-brand-forest',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </Link>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </nav>

      {/* ── Footer ── */}
      <div
        className={cn(
          'border-t border-brand-forest/10 px-2 py-3',
          collapsed ? 'flex flex-col items-center gap-2' : '',
        )}
      >
        {/* Avatar + name */}
        <div
          className={cn(
            'flex items-center gap-2.5 rounded-lg px-2 py-2 mb-1',
            !collapsed && 'hover:bg-brand-cream transition-colors duration-150',
          )}
        >
          <div className="h-7 w-7 shrink-0 rounded-full bg-brand-forest/15 flex items-center justify-center text-[11px] font-bold text-brand-forest">
            {initials}
          </div>
          <div
            className={cn(
              'overflow-hidden transition-[opacity,width] duration-200 min-w-0',
              collapsed ? 'opacity-0 w-0' : 'opacity-100',
            )}
          >
            <p className="text-xs font-semibold text-brand-forest truncate leading-tight">
              {fullName || email}
            </p>
            <p className="text-[10px] text-brand-slate truncate leading-tight">{email}</p>
          </div>
        </div>

        {/* Sign out */}
        <form action="/api/auth/login" method="POST" className={cn(collapsed ? 'w-full flex justify-center' : '')}>
          <button
            type="submit"
            formAction="/api/auth/logout"
            title={collapsed ? 'Sign out' : undefined}
            className={cn(
              'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-brand-slate',
              'hover:bg-red-50 hover:text-brand-wine transition-all duration-150',
              collapsed ? 'justify-center w-10 h-10 p-0' : 'w-full',
            )}
            style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            <span
              className={cn(
                'whitespace-nowrap transition-[opacity,width] duration-200 overflow-hidden',
                collapsed ? 'opacity-0 w-0' : 'opacity-100',
              )}
            >
              Sign out
            </span>
          </button>
        </form>
      </div>

    </aside>
  );
}
