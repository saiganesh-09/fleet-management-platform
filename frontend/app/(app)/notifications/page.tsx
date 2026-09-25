'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCheck } from 'lucide-react';
import { notificationsApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { cn, formatDateTime } from '@/lib/utils';

const TYPE_STYLE: Record<string, string> = {
  INFO: 'bg-sky-100 text-sky-800',
  WARNING: 'bg-amber-100 text-amber-800',
  ALERT: 'bg-red-100 text-red-800',
  SUCCESS: 'bg-emerald-100 text-emerald-800',
};

export default function NotificationsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'page', page, unreadOnly],
    queryFn: () => notificationsApi.list({ page, limit: 15, unread: unreadOnly || undefined }),
  });

  const items = data?.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground">Alerts for maintenance, expiries, trips and anomalies</p>
        </div>
        <div className="flex gap-2">
          <Button variant={unreadOnly ? 'default' : 'outline'} size="sm" onClick={() => setUnreadOnly(!unreadOnly)}>
            Unread only
          </Button>
          <Button variant="outline" size="sm" onClick={async () => {
            await notificationsApi.markAllRead();
            qc.invalidateQueries({ queryKey: ['notifications'] });
          }}>
            <CheckCheck /> Mark all read
          </Button>
        </div>
      </div>

      {isLoading ? <Skeleton className="h-64 w-full" /> : !items.length ? (
        <EmptyState title="No notifications" description="Alerts will appear here when the system detects events." />
      ) : (
        <div className="divide-y rounded-lg border bg-card">
          {items.map((n) => (
            <div key={n.id} className={cn('flex items-start gap-3 px-4 py-3', !n.isRead && 'bg-accent/40')}>
              <Badge variant="outline" className={cn('mt-0.5 border-transparent', TYPE_STYLE[n.type])}>{n.type}</Badge>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{n.title}</p>
                <p className="text-sm text-muted-foreground">{n.message}</p>
                <p className="mt-0.5 text-xs text-muted-foreground/70">{formatDateTime(n.createdAt)}</p>
              </div>
              {!n.isRead && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
            </div>
          ))}
          <div className="px-3 pb-3">
            <Pagination page={page} totalPages={data?.meta?.totalPages ?? 1} total={data?.meta?.total} onPage={setPage} />
          </div>
        </div>
      )}
    </div>
  );
}
