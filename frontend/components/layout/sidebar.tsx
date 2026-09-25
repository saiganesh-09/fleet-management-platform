'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Truck, Users, Route, Wrench, Fuel, FileText,
  Bell, BarChart3, Map, Sparkles, ShieldCheck, UserCog, ScrollText, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
}

const ALL = ['SUPER_ADMIN', 'FLEET_MANAGER', 'DRIVER', 'VIEWER'];
const MANAGER_UP = ['SUPER_ADMIN', 'FLEET_MANAGER'];
const ADMIN = ['SUPER_ADMIN'];

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: 'Operations',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ALL },
      { label: 'Live Map', href: '/fleet/live-map', icon: Map, roles: ALL },
      { label: 'Trips', href: '/trips', icon: Route, roles: ALL },
      { label: 'Vehicles', href: '/vehicles', icon: Truck, roles: ALL },
      { label: 'Drivers', href: '/drivers', icon: Users, roles: ALL },
    ],
  },
  {
    section: 'Management',
    items: [
      { label: 'Maintenance', href: '/maintenance', icon: Wrench, roles: MANAGER_UP },
      { label: 'Fuel', href: '/fuel', icon: Fuel, roles: MANAGER_UP },
      { label: 'Documents', href: '/documents', icon: FileText, roles: MANAGER_UP },
      { label: 'Notifications', href: '/notifications', icon: Bell, roles: ALL },
    ],
  },
  {
    section: 'Insights',
    items: [
      { label: 'Reports', href: '/reports', icon: BarChart3, roles: ALL },
      { label: 'AI Assistant', href: '/ai', icon: Sparkles, roles: ['SUPER_ADMIN', 'FLEET_MANAGER', 'VIEWER'] },
    ],
  },
  {
    section: 'Administration',
    items: [
      { label: 'Users', href: '/admin/users', icon: UserCog, roles: ADMIN },
      { label: 'Audit Logs', href: '/admin/audit-logs', icon: ScrollText, roles: ADMIN },
    ],
  },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { user, hasRole } = useAuth();

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} />}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-white/10 px-4">
          <Truck className="h-6 w-6 text-blue-400" />
          <span className="text-lg font-bold text-white">FleetOps</span>
          <Button variant="ghost" size="icon" className="ml-auto text-sidebar-foreground lg:hidden" onClick={onClose}>
            <X />
          </Button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV.map((group) => {
            const visible = group.items.filter((i) => i.roles.some((r) => hasRole(r as never)));
            if (!visible.length) return null;
            return (
              <div key={group.section} className="mb-5">
                <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                  {group.section}
                </p>
                {visible.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + '/');
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        'mb-0.5 flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                        active ? 'bg-sidebar-accent text-white' : 'hover:bg-sidebar-accent/60 hover:text-white',
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-4 text-xs text-sidebar-foreground/60">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            <span>{user?.role.replace(/_/g, ' ') ?? '—'}</span>
          </div>
        </div>
      </aside>
    </>
  );
}
