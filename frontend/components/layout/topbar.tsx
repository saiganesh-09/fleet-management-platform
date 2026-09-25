'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, Search, ChevronDown, LogOut, KeyRound, CircleUser } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { searchApi } from '@/services/api';
import { NotificationsBell } from './notifications-bell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function GlobalSearch() {
  const [q, setQ] = useState('');
  const debounced = useDebounced(q);
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchApi.global>>['data'] | null>(null);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!debounced || debounced.length < 2) { setResults(null); return; }
    searchApi.global(debounced).then((r) => setResults(r.data)).catch(() => {});
  }, [debounced]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const go = (href: string) => { setOpen(false); setQ(''); router.push(href); };

  return (
    <div ref={ref} className="relative hidden w-full max-w-sm md:block">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search vehicles, drivers, trips, docs…"
        className="pl-8"
      />
      {open && results && (
        <div className="absolute top-10 z-50 w-full rounded-md border bg-popover p-1 shadow-lg">
          {!results.vehicles.length && !results.drivers.length && !results.trips.length && !results.documents.length && (
            <p className="p-3 text-sm text-muted-foreground">No results</p>
          )}
          {!!results.vehicles.length && (
            <>
              <p className="px-2 py-1 text-[11px] font-semibold uppercase text-muted-foreground">Vehicles</p>
              {results.vehicles.map((v) => (
                <button key={v.id} onClick={() => go(`/vehicles/${v.id}`)} className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent">
                  {v.vehicleNumber} <span className="text-muted-foreground">· {v.status}</span>
                </button>
              ))}
            </>
          )}
          {!!results.drivers.length && (
            <>
              <p className="px-2 py-1 text-[11px] font-semibold uppercase text-muted-foreground">Drivers</p>
              {results.drivers.map((d) => (
                <button key={d.id} onClick={() => go(`/drivers/${d.id}`)} className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent">
                  {d.name} <span className="text-muted-foreground">· {d.employeeId}</span>
                </button>
              ))}
            </>
          )}
          {!!results.trips.length && (
            <>
              <p className="px-2 py-1 text-[11px] font-semibold uppercase text-muted-foreground">Trips</p>
              {results.trips.map((t) => (
                <button key={t.id} onClick={() => go(`/trips`)} className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent">
                  {t.tripNumber} <span className="text-muted-foreground">· {t.source} → {t.destination}</span>
                </button>
              ))}
            </>
          )}
          {!!results.documents.length && (
            <>
              <p className="px-2 py-1 text-[11px] font-semibold uppercase text-muted-foreground">Documents</p>
              {results.documents.map((doc) => (
                <button key={doc.id} onClick={() => go(`/documents`)} className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent">
                  {doc.documentType.replace(/_/g, ' ')} <span className="text-muted-foreground">· {doc.documentNumber}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function breadcrumbs(pathname: string): string[] {
  return pathname.split('/').filter(Boolean).map((s) => s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
}

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const crumbs = breadcrumbs(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background px-4">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu}>
        <Menu />
      </Button>
      <nav className="hidden items-center gap-1 text-sm text-muted-foreground sm:flex">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span>/</span>}
            <span className={i === crumbs.length - 1 ? 'font-medium text-foreground' : ''}>{c}</span>
          </span>
        ))}
      </nav>
      <div className="flex-1" />
      <GlobalSearch />
      <NotificationsBell />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-2 px-2">
            <CircleUser className="h-5 w-5" />
            <span className="hidden text-sm font-medium sm:block">{user?.name}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>
            <div className="text-sm">{user?.name}</div>
            <div className="text-xs font-normal text-muted-foreground">{user?.email} · {user?.role.replace(/_/g, ' ')}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/profile"><KeyRound /> Profile & password</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => logout()} className="text-destructive">
            <LogOut /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
