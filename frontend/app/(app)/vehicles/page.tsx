'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Pencil, Ban, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { vehiclesApi, driversApi } from '@/services/api';
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
import { VehicleForm } from '@/features/vehicles/vehicle-form';
import { formatKm } from '@/lib/utils';
import type { Vehicle } from '@/types';

const STATUSES = ['AVAILABLE', 'ASSIGNED', 'ON_TRIP', 'MAINTENANCE', 'INACTIVE'];
const TYPES = ['TRUCK', 'VAN', 'CAR', 'BUS', 'MINIBUS', 'TRAILER', 'PICKUP', 'OTHER'];

function AssignDriverDialog({ vehicle, open, onClose }: { vehicle: Vehicle; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [driverId, setDriverId] = useState(vehicle.assignedDriverId ?? '');
  const { data: drivers } = useQuery({ queryKey: ['drivers', 'assignable'], queryFn: () => driversApi.list({ limit: 100 }) });
  const mutation = useMutation({
    mutationFn: () => vehiclesApi.assignDriver(vehicle.id, driverId || null),
    onSuccess: () => {
      toast.success('Driver assignment updated');
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign driver — {vehicle.vehicleNumber}</DialogTitle>
          <DialogDescription>Pick a driver or clear the assignment</DialogDescription>
        </DialogHeader>
        <Select value={driverId} onValueChange={setDriverId}>
          <SelectTrigger><SelectValue placeholder="No driver" /></SelectTrigger>
          <SelectContent>
            {(drivers?.items ?? []).map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.name} · {d.employeeId} · {d.status}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => { setDriverId(''); mutation.mutate(); }} disabled={mutation.isPending}>Clear</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>Assign</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function VehiclesPage() {
  const { hasRole } = useAuth();
  const canEdit = hasRole('SUPER_ADMIN', 'FLEET_MANAGER');
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | undefined>();
  const [assigning, setAssigning] = useState<Vehicle | undefined>();

  const { data, isLoading } = useQuery({
    queryKey: ['vehicles', page, search, status, type],
    queryFn: () => vehiclesApi.list({ page, limit: 10, search: search || undefined, status: status || undefined, vehicleType: type || undefined }),
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => vehiclesApi.deactivate(id),
    onSuccess: () => { toast.success('Vehicle deactivated'); qc.invalidateQueries({ queryKey: ['vehicles'] }); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Vehicles</h1>
          <p className="text-sm text-muted-foreground">Manage your fleet inventory</p>
        </div>
        {canEdit && (
          <Button onClick={() => { setEditing(undefined); setFormOpen(true); }}>
            <Plus /> Add vehicle
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="w-64 pl-8" placeholder="Search number / model…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Select value={status || 'ALL'} onValueChange={(v) => { setStatus(v === 'ALL' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={type || 'ALL'} onValueChange={(v) => { setType(v === 'ALL' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <TableSkeleton /> : !data?.items.length ? (
        <EmptyState title="No vehicles found" description="Try adjusting filters, or add your first vehicle." />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehicle</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Make / Model</TableHead>
                <TableHead>Fuel</TableHead>
                <TableHead>Odometer</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Status</TableHead>
                {canEdit && <TableHead className="w-24" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>
                    <Link href={`/vehicles/${v.id}`} className="font-medium text-primary hover:underline">{v.vehicleNumber}</Link>
                    <div className="text-xs text-muted-foreground">{v.registrationNumber}</div>
                  </TableCell>
                  <TableCell>{v.vehicleType}</TableCell>
                  <TableCell>{v.manufacturer} {v.model} <span className="text-muted-foreground">({v.manufacturingYear})</span></TableCell>
                  <TableCell>{v.fuelType}</TableCell>
                  <TableCell>{formatKm(v.currentOdometer)}</TableCell>
                  <TableCell>{v.assignedDriver?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell><StatusBadge status={v.status} /></TableCell>
                  {canEdit && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" title="Assign driver" onClick={() => setAssigning(v)}><UserPlus /></Button>
                        <Button variant="ghost" size="icon" title="Edit" onClick={() => { setEditing(v); setFormOpen(true); }}><Pencil /></Button>
                        {v.status !== 'INACTIVE' && (
                          <Button variant="ghost" size="icon" title="Deactivate" onClick={() => {
                            if (confirm(`Deactivate ${v.vehicleNumber}?`)) deactivate.mutate(v.id);
                          }}><Ban /></Button>
                        )}
                      </div>
                    </TableCell>
                  )}
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
            <DialogTitle>{editing ? 'Edit vehicle' : 'Add vehicle'}</DialogTitle>
            <DialogDescription>{editing ? `Editing ${editing.vehicleNumber}` : 'Register a new fleet vehicle'}</DialogDescription>
          </DialogHeader>
          <VehicleForm vehicle={editing} onDone={() => setFormOpen(false)} />
        </DialogContent>
      </Dialog>

      {assigning && <AssignDriverDialog vehicle={assigning} open onClose={() => setAssigning(undefined)} />}
    </div>
  );
}
