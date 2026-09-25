'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Pencil, UserX, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { driversApi } from '@/services/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Pagination } from '@/components/ui/pagination';
import { TableSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { DriverForm } from '@/features/drivers/driver-form';
import { formatDate, daysUntil } from '@/lib/utils';
import type { Driver } from '@/types';

const STATUSES = ['AVAILABLE', 'ASSIGNED', 'ON_TRIP', 'ON_LEAVE', 'INACTIVE'];

export default function DriversPage() {
  const { hasRole } = useAuth();
  const canEdit = hasRole('SUPER_ADMIN', 'FLEET_MANAGER');
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Driver | undefined>();

  const { data, isLoading } = useQuery({
    queryKey: ['drivers', page, search, status],
    queryFn: () => driversApi.list({ page, limit: 10, search: search || undefined, status: status || undefined }),
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, next }: { id: string; next: string }) => driversApi.setStatus(id, next),
    onSuccess: (_, vars) => {
      toast.success(vars.next === 'INACTIVE' ? 'Driver deactivated' : 'Driver activated');
      qc.invalidateQueries({ queryKey: ['drivers'] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Drivers</h1>
          <p className="text-sm text-muted-foreground">Driver roster and availability</p>
        </div>
        {canEdit && <Button onClick={() => { setEditing(undefined); setFormOpen(true); }}><Plus /> Add driver</Button>}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="w-64 pl-8" placeholder="Search name / ID / license…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Select value={status || 'ALL'} onValueChange={(v) => { setStatus(v === 'ALL' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <TableSkeleton /> : !data?.items.length ? (
        <EmptyState title="No drivers found" />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Driver</TableHead>
                <TableHead>Employee ID</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>License expiry</TableHead>
                <TableHead>Exp.</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Status</TableHead>
                {canEdit && <TableHead className="w-20" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((d) => {
                const days = daysUntil(d.licenseExpiry);
                return (
                  <TableRow key={d.id}>
                    <TableCell>
                      <Link href={`/drivers/${d.id}`} className="font-medium text-primary hover:underline">{d.name}</Link>
                      <div className="text-xs text-muted-foreground">{d.email}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{d.employeeId}</TableCell>
                    <TableCell>{d.phone}</TableCell>
                    <TableCell>
                      <span className={days != null && days < 30 ? 'font-medium text-red-600' : ''}>
                        {formatDate(d.licenseExpiry)}
                      </span>
                      {days != null && days >= 0 && days < 30 && <span className="ml-1 text-xs text-amber-600">({days}d)</span>}
                      {days != null && days < 0 && <span className="ml-1 text-xs text-red-600">(expired)</span>}
                    </TableCell>
                    <TableCell>{d.experienceYears}y</TableCell>
                    <TableCell>{d.assignedVehicles?.[0]?.vehicleNumber ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell><StatusBadge status={d.status} /></TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => { setEditing(d); setFormOpen(true); }}><Pencil /></Button>
                          {d.status === 'INACTIVE' ? (
                            <Button variant="ghost" size="icon" title="Activate" onClick={() => toggleStatus.mutate({ id: d.id, next: 'AVAILABLE' })}><UserCheck /></Button>
                          ) : (
                            <Button variant="ghost" size="icon" title="Deactivate" onClick={() => {
                              if (confirm(`Deactivate ${d.name}?`)) toggleStatus.mutate({ id: d.id, next: 'INACTIVE' });
                            }}><UserX /></Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="px-3 pb-3">
            <Pagination page={page} totalPages={data.meta?.totalPages ?? 1} total={data.meta?.total} onPage={setPage} />
          </div>
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit driver' : 'Add driver'}</DialogTitle>
          </DialogHeader>
          <DriverForm driver={editing} onDone={() => setFormOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
