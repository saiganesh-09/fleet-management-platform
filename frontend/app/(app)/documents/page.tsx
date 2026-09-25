'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, ExternalLink } from 'lucide-react';
import { documentsApi } from '@/services/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Pagination } from '@/components/ui/pagination';
import { TableSkeleton, CardsSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { DocumentForm } from '@/features/documents/document-form';
import { formatDate, daysUntil } from '@/lib/utils';

const DOC_STATUSES = ['VALID', 'EXPIRING_SOON', 'EXPIRED'];

export default function DocumentsPage() {
  const { hasRole } = useAuth();
  const canEdit = hasRole('SUPER_ADMIN', 'FLEET_MANAGER');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [entityType, setEntityType] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['documents', page, search, status, entityType],
    queryFn: () => documentsApi.list({
      page, limit: 12,
      search: search || undefined,
      status: status || undefined,
      entityType: entityType || undefined,
    }),
  });
  const { data: expiring } = useQuery({
    queryKey: ['documents', 'expiring'],
    queryFn: () => documentsApi.list({ expiringInDays: 30, limit: 8 }),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Documents</h1>
          <p className="text-sm text-muted-foreground">Registration, insurance, PUC, permits and licenses</p>
        </div>
        {canEdit && <Button onClick={() => setFormOpen(true)}><Plus /> Add document</Button>}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {!expiring ? <CardsSkeleton count={3} /> : (
          <>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Expiring / expired soon</p>
              <p className="text-2xl font-bold">{expiring.meta?.total ?? 0}</p></CardContent></Card>
            <Card className="sm:col-span-2"><CardContent className="pt-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Closest expiries</p>
              <div className="flex flex-wrap gap-2">
                {(expiring.items ?? []).slice(0, 6).map((d) => {
                  const days = daysUntil(d.expiryDate);
                  return (
                    <span key={d.id} className="rounded-full border px-2.5 py-1 text-xs">
                      {d.documentType.replace(/_/g, ' ')} — <b>{days != null && days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`}</b>
                    </span>
                  );
                })}
                {!expiring.items?.length && <span className="text-sm text-muted-foreground">Nothing expiring in 30 days</span>}
              </div>
            </CardContent></Card>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="w-64 pl-8" placeholder="Search document number…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Select value={entityType || 'ALL'} onValueChange={(v) => { setEntityType(v === 'ALL' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All entities</SelectItem>
            <SelectItem value="VEHICLE">Vehicles</SelectItem>
            <SelectItem value="DRIVER">Drivers</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status || 'ALL'} onValueChange={(v) => { setStatus(v === 'ALL' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {DOC_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <TableSkeleton /> : !data?.items.length ? (
        <EmptyState title="No documents" />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead><TableHead>Number</TableHead><TableHead>Entity</TableHead>
                <TableHead>Issued</TableHead><TableHead>Expiry</TableHead><TableHead>Status</TableHead><TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.documentType.replace(/_/g, ' ')}</TableCell>
                  <TableCell className="font-mono text-xs">{d.documentNumber ?? '—'}</TableCell>
                  <TableCell>
                    <Link
                      className="text-primary hover:underline"
                      href={d.entityType === 'VEHICLE' ? `/vehicles/${d.entityId}` : `/drivers/${d.entityId}`}
                    >
                      {d.entityType === 'VEHICLE' ? 'Vehicle' : 'Driver'}
                    </Link>
                  </TableCell>
                  <TableCell>{formatDate(d.issueDate)}</TableCell>
                  <TableCell>{formatDate(d.expiryDate)}</TableCell>
                  <TableCell><StatusBadge status={d.computedStatus ?? d.status} /></TableCell>
                  <TableCell>
                    {d.fileUrl && (
                      <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
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

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Add document</DialogTitle></DialogHeader>
          <DocumentForm onDone={() => setFormOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
