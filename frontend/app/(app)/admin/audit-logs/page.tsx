'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditApi } from '@/services/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import { TableSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDateTime } from '@/lib/utils';

const ENTITIES = ['User', 'Vehicle', 'Driver', 'Trip', 'MaintenanceRecord', 'FuelRecord', 'Document'];

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, entity],
    queryFn: () => auditApi.list({ page, limit: 20, entity: entity || undefined }),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Audit Logs</h1>
          <p className="text-sm text-muted-foreground">Every mutating action, with before/after values (admin only)</p>
        </div>
        <Select value={entity || 'ALL'} onValueChange={(v) => { setEntity(v === 'ALL' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All entities</SelectItem>
            {ENTITIES.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <TableSkeleton /> : !data?.items.length ? (
        <EmptyState title="No audit entries" description="Actions will appear here as users work." />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead><TableHead>User</TableHead><TableHead>Action</TableHead>
                <TableHead>Entity</TableHead><TableHead>Changes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(l.timestamp)}</TableCell>
                  <TableCell>
                    <span className="font-medium">{l.user?.name ?? 'System'}</span>
                    <div className="text-xs text-muted-foreground">{l.user?.email}</div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{l.action.replace(/_/g, ' ')}</Badge></TableCell>
                  <TableCell>
                    {l.entity}
                    <div className="max-w-40 truncate font-mono text-[10px] text-muted-foreground">{l.entityId}</div>
                  </TableCell>
                  <TableCell className="max-w-64">
                    <DiffPreview oldValue={l.oldValue} newValue={l.newValue} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="px-3 pb-3">
            <Pagination page={page} totalPages={data.meta?.totalPages ?? 1} total={data.meta?.total} onPage={setPage} />
          </div>
        </div>
      )}
    </div>
  );
}

function DiffPreview({ oldValue, newValue }: { oldValue?: unknown; newValue?: unknown }) {
  if (oldValue == null && newValue == null) return <span className="text-xs text-muted-foreground">—</span>;
  const keys = new Set([
    ...Object.keys((oldValue ?? {}) as Record<string, unknown>),
    ...Object.keys((newValue ?? {}) as Record<string, unknown>),
  ]);
  const changes = [...keys].filter((k) => {
    const a = (oldValue as Record<string, unknown> | undefined)?.[k];
    const b = (newValue as Record<string, unknown> | undefined)?.[k];
    return JSON.stringify(a) !== JSON.stringify(b);
  }).slice(0, 4);
  if (!changes.length) return <span className="text-xs text-muted-foreground">created</span>;
  return (
    <div className="space-y-0.5 text-[11px]">
      {changes.map((k) => {
        const a = (oldValue as Record<string, unknown> | undefined)?.[k];
        const b = (newValue as Record<string, unknown> | undefined)?.[k];
        return (
          <div key={k}>
            <span className="font-mono text-muted-foreground">{k}:</span>{' '}
            <span className="text-red-600 line-through">{fmt(a)}</span> → <span className="text-emerald-700">{fmt(b)}</span>
          </div>
        );
      })}
    </div>
  );
}

function fmt(v: unknown): string {
  if (v == null) return '∅';
  if (typeof v === 'object') return '{…}';
  const s = String(v);
  return s.length > 28 ? s.slice(0, 28) + '…' : s;
}
