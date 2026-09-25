'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Bell } from 'lucide-react';
import { toast } from 'sonner';
import { notificationsApi } from '@/services/api';
import { getSocket } from '@/lib/socket';
import { useAuth } from '@/lib/auth';
import { cn, timeAgo } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { AppNotification } from '@/types';

const TYPE_DOT: Record<string, string> = {
  INFO: 'bg-sky-500',
  WARNING: 'bg-amber-500',
  ALERT: 'bg-red-500',
  SUCCESS: 'bg-emerald-500',
};

export function NotificationsBell() {
  const { user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list({ limit: 15 }),
    enabled: !!user,
    refetchInterval: 60_000,
  });

  // Realtime push
  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    const onNew = (n: AppNotification | { title: string; message: string }) => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      if ('title' in n) toast.info(`${n.title}: ${'message' in n ? n.message : ''}`);
    };
    socket.on('notification:new', onNew);
    return () => { socket.off('notification:new', onNew); };
  }, [user, qc]);

  const items = data?.data ?? [];
  const unread = (data?.meta as { unread?: number } | undefined)?.unread ?? items.filter((i) => !i.isRead).length;

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          className="z-50 w-80 rounded-lg border bg-popover shadow-lg"
          sideOffset={6}
        >
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <span className="text-sm font-semibold">Notifications</span>
            <button
              className="text-xs text-primary hover:underline"
              onClick={async () => { await notificationsApi.markAllRead(); qc.invalidateQueries({ queryKey: ['notifications'] }); }}
            >
              Mark all read
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {!items.length && <p className="p-6 text-center text-sm text-muted-foreground">No notifications yet</p>}
            {items.map((n) => (
              <button
                key={n.id}
                className={cn('flex w-full gap-3 border-b px-4 py-3 text-left hover:bg-muted/50', !n.isRead && 'bg-accent/40')}
                onClick={async () => {
                  await notificationsApi.markRead(n.id);
                  qc.invalidateQueries({ queryKey: ['notifications'] });
                  setOpen(false);
                  router.push('/notifications');
                }}
              >
                <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', TYPE_DOT[n.type] ?? 'bg-slate-400')} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{n.title}</span>
                  <span className="block text-xs text-muted-foreground">{n.message}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground/70">{timeAgo(n.createdAt)}</span>
                </span>
              </button>
            ))}
          </div>
          <button
            className="block w-full border-t px-4 py-2 text-center text-xs text-primary hover:underline"
            onClick={() => { setOpen(false); router.push('/notifications'); }}
          >
            View all
          </button>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
