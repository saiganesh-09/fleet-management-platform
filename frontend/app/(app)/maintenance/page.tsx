'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Wrench, AlertTriangle, CalendarClock, CircleDollarSign } from 'lucide-react';
import { maintenanceApi } from '@/services/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Pagination } from '@/components/ui/pagination';
import { TableSkeleton, Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { MaintenanceForm } from '@/features/maintenance/maintenance-form';
import { formatCurrency, formatDate, formatKm } from '@/lib/utils';

const STATUSES = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

function StatCard({ title, value, icon: Icon, tone }: { title: string; value: React.ReactNode; icon: React.ComponentType<{ className?: string }>; tone: string }) {
  return (
    <Card><CardContent className="flex items-center gap-4 pt-5">
      <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${tone}`}><Icon className="h-5 w-5" /></div>
      <div><p className="text-xs text-muted-foreground">{title}</p><p className="text-2xl font-bold">{value}</p></div>
    </CardContent></Card>
  );
}

export default function MaintenancePage() {
  const { hasRole } = useAuth();
  const canEdit = hasRole('SUPER_ADMIN', 'FLEET_MANAGER');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const { data: dash, isLoading: dashLoading } = useQuery({
    queryKey: ['maintenance', 'dashboard'],
    queryFn: () => maintenanceApi.dashboard(),
  });
  const { data, isLoading } = useQuery({
    queryKey: ['maintenance', page, status],
    queryFn: () => maintenanceApi.list({ page, limit: 10, status: status || undefined }),
  });

  const d = dash?.data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Maintenance</h1>
          <p className="text-sm text-muted-foreground">Service schedule and costs</p>
        </div>
        {canEdit && <Button onClick={() => setFormOpen(true)}><Plus /> Schedule service</Button>}
      </div>

      {dashLoading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Upcoming (30d)" value={d?.upcoming.length} icon={CalendarClock} tone="bg-sky-100 text-sky-700" />
          <StatCard title="Overdue" value={d?.overdue.length} icon={AlertTriangle} tone="bg-red-100 text-red-700" />
          <StatCard title="Due by odometer" value={d?.dueByOdometer.length} icon={Wrench} tone="bg-amber-100 text-amber-700" />
          <StatCard title="Total spend" value={formatCurrency(d?.totalCost)} icon={CircleDollarSign} tone="bg-emerald-100 text-emerald-700" />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Upcoming & overdue services</CardTitle><CardDescription>Sorted by due date</CardDescription></CardHeader>
          <CardContent>
            {!d?.upcoming.length && !d?.overdue.length ? (
              <p className="text-sm text-muted-foreground">Nothing scheduled</p>
            ) : (
              <div className="space-y-2">
                {[...new Map([...(d?.overdue ?? []), ...(d?.upcoming ?? [])].map((m) => [m.id, m])).values()].slice(0, 8).map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <div>
                      <span className="font-medium">{m.vehicle?.vehicleNumber}</span>
                      <span className="text-muted-foreground"> · {m.serviceType}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{formatDate(m.serviceDate)}</span>
                      <StatusBadge status={new Date(m.serviceDate) < new Date() && m.status === 'SCHEDULED' ? 'DELAYED' : m.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Cost by vehicle</CardTitle><CardDescription>Top spenders</CardDescription></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(d?.costByVehicle ?? []).slice(0, 8).map((v) => (
                <div key={v.vehicleId} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{v.vehicleNumber}</span>
                  <span className="text-muted-foreground">{formatCurrency(v.cost)} · {v.services} svc</span>
                </div>
              ))}
              {!d?.costByVehicle.length && <p className="text-sm text-muted-foreground">No data</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">All records</h2>
        <Select value={status || 'ALL'} onValueChange={(v) => { setStatus(v === 'ALL' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <TableSkeleton /> : !data?.items.length ? (
        <EmptyState title="No maintenance records" />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehicle</TableHead><TableHead>Service</TableHead><TableHead>Date</TableHead>
                <TableHead>Odometer</TableHead><TableHead>Next due</TableHead><TableHead>Workshop</TableHead>
                <TableHead>Cost</TableHead><TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.vehicle?.vehicleNumber}</TableCell>
                  <TableCell>{m.serviceType}</TableCell>
                  <TableCell>{formatDate(m.serviceDate)}</TableCell>
                  <TableCell>{formatKm(m.odometer)}</TableCell>
                  <TableCell>{m.nextServiceOdometer ? formatKm(m.nextServiceOdometer) : '—'}</TableCell>
                  <TableCell>{m.workshop ?? '—'}</TableCell>
                  <TableCell>{formatCurrency(m.cost)}</TableCell>
                  <TableCell><StatusBadge status={m.status} /></TableCell>
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
          <DialogHeader><DialogTitle>Schedule service</DialogTitle></DialogHeader>
          <MaintenanceForm onDone={() => setFormOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
