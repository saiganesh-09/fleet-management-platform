'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Play, CheckCircle2, XCircle, AlertTriangle, Navigation } from 'lucide-react';
import { toast } from 'sonner';
import { tripsApi } from '@/services/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Pagination } from '@/components/ui/pagination';
import { TableSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { TripForm } from '@/features/trips/trip-form';
import { formatDateTime, formatKm } from '@/lib/utils';
import type { Trip } from '@/types';

const STATUSES = ['SCHEDULED', 'STARTED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED', 'DELAYED'];

function TripActions({ trip, onDone }: { trip: Trip; onDone: () => void }) {
  const { hasRole } = useAuth();
  const isManager = hasRole('SUPER_ADMIN', 'FLEET_MANAGER');
  const isDriver = hasRole('DRIVER');
  const transition = useMutation({
    mutationFn: (action: 'start' | 'transit' | 'complete' | 'cancel' | 'delay') =>
      tripsApi.transition(trip.id, action),
    onSuccess: (_, action) => { toast.success(`Trip ${action === 'transit' ? 'in transit' : action.toLowerCase()}`); onDone(); },
    onError: (e) => toast.error(e.message),
  });

  const busy = transition.isPending;
  return (
    <div className="flex flex-wrap gap-1">
      {trip.status === 'SCHEDULED' && (isManager || isDriver) && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => transition.mutate('start')}><Play /> Start</Button>
      )}
      {trip.status === 'STARTED' && (isManager || isDriver) && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => transition.mutate('transit')}><Navigation /> Transit</Button>
      )}
      {['STARTED', 'IN_TRANSIT', 'DELAYED'].includes(trip.status) && (isManager || isDriver) && (
        <>
          <Button size="sm" variant="default" disabled={busy} onClick={() => transition.mutate('complete')}><CheckCircle2 /> Complete</Button>
          {trip.status !== 'DELAYED' && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => transition.mutate('delay')}><AlertTriangle /> Delay</Button>
          )}
        </>
      )}
      {['SCHEDULED', 'STARTED', 'IN_TRANSIT', 'DELAYED'].includes(trip.status) && isManager && (
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => {
          if (confirm(`Cancel ${trip.tripNumber}?`)) transition.mutate('cancel');
        }}><XCircle /> Cancel</Button>
      )}
    </div>
  );
}

export default function TripsPage() {
  const { hasRole, user } = useAuth();
  const isManager = hasRole('SUPER_ADMIN', 'FLEET_MANAGER');
  const isDriver = hasRole('DRIVER');
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['trips'] });
    qc.invalidateQueries({ queryKey: ['vehicles'] });
    qc.invalidateQueries({ queryKey: ['drivers'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const { data, isLoading } = useQuery({
    queryKey: ['trips', page, search, status, isDriver ? user?.id : 'all'],
    queryFn: () =>
      isDriver
        ? tripsApi.mine({ page, limit: 10 })
        : tripsApi.list({ page, limit: 10, search: search || undefined, status: status || undefined }),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{isDriver ? 'My Trips' : 'Trips'}</h1>
          <p className="text-sm text-muted-foreground">{isDriver ? 'Your assigned trips' : 'Plan, assign and track trips'}</p>
        </div>
        {isManager && <Button onClick={() => setFormOpen(true)}><Plus /> Create trip</Button>}
      </div>

      {!isDriver && (
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="w-64 pl-8" placeholder="Search trip # / route…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <Select value={status || 'ALL'} onValueChange={(v) => { setStatus(v === 'ALL' ? '' : v); setPage(1); }}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {isLoading ? <TableSkeleton /> : !data?.items.length ? (
        <EmptyState title="No trips found" description={isManager ? 'Create your first trip to get started.' : 'No trips assigned to you yet.'} />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trip</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>ETA</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <span className="font-medium">{t.tripNumber}</span>
                    {t.distance != null && <div className="text-xs text-muted-foreground">{formatKm(t.distance)}</div>}
                  </TableCell>
                  <TableCell>{t.source} → {t.destination}</TableCell>
                  <TableCell>{t.vehicle?.vehicleNumber}</TableCell>
                  <TableCell>{t.driver?.name}</TableCell>
                  <TableCell>{formatDateTime(t.startTime)}</TableCell>
                  <TableCell>{formatDateTime(t.expectedEndTime)}</TableCell>
                  <TableCell><StatusBadge status={t.status} /></TableCell>
                  <TableCell><TripActions trip={t} onDone={invalidate} /></TableCell>
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
          <DialogHeader>
            <DialogTitle>Create trip</DialogTitle>
            <DialogDescription>Only available vehicles and drivers with valid licenses can be assigned.</DialogDescription>
          </DialogHeader>
          <TripForm onDone={() => { setFormOpen(false); invalidate(); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
