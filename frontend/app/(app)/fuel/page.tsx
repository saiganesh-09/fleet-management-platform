'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, AlertTriangle, TrendingDown } from 'lucide-react';
import { fuelApi, aiApi } from '@/services/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Pagination } from '@/components/ui/pagination';
import { TableSkeleton, Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { FuelForm } from '@/features/fuel/fuel-form';
import { formatCurrency, formatDate, formatKm, cn } from '@/lib/utils';

export default function FuelPage() {
  const { hasRole } = useAuth();
  const canEdit = hasRole('SUPER_ADMIN', 'FLEET_MANAGER', 'DRIVER');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['fuel', page, search],
    queryFn: () => fuelApi.list({ page, limit: 12, search: search || undefined }),
  });
  const { data: efficiency } = useQuery({ queryKey: ['fuel', 'efficiency'], queryFn: () => fuelApi.efficiency() });
  const { data: anomalies } = useQuery({ queryKey: ['fuel', 'anomalies'], queryFn: () => aiApi.fuelAnomalies(), retry: false });

  const anomalyVehicles = new Set((anomalies?.data.anomalies ?? []).map((a) => a.vehicleNumber));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Fuel</h1>
          <p className="text-sm text-muted-foreground">Consumption, cost and efficiency tracking</p>
        </div>
        {canEdit && <Button onClick={() => setFormOpen(true)}><Plus /> Add fuel record</Button>}
      </div>

      {(anomalies?.data.anomalies?.length ?? 0) > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-red-800">
              <AlertTriangle className="h-4 w-4" /> Fuel anomalies detected
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-red-800">
            {anomalies!.data.anomalies.map((a, i) => <p key={i}>{a.message}</p>)}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><TrendingDown className="h-4 w-4" /> Fuel efficiency (km/L)</CardTitle>
          <CardDescription>Computed from consecutive odometer readings — flagged vehicles show recent drops</CardDescription>
        </CardHeader>
        <CardContent>
          {!efficiency ? <Skeleton className="h-24 w-full" /> : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {efficiency.data.filter((e) => e.avgEfficiency != null).map((e) => (
                <div key={e.vehicleId} className={cn('rounded-md border px-3 py-2 text-sm', e.anomaly && 'border-red-300 bg-red-50')}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{e.vehicleNumber}</span>
                    {e.anomaly && <Badge variant="outline" className="bg-red-100 text-red-800">Anomaly</Badge>}
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    avg {e.avgEfficiency?.toFixed(1)} km/L
                    {e.recentEfficiency != null && (
                      <span className={cn('ml-2', e.anomaly && 'font-medium text-red-700')}>recent {e.recentEfficiency.toFixed(1)}</span>
                    )}
                  </div>
                </div>
              ))}
              {!efficiency.data.some((e) => e.avgEfficiency != null) && (
                <p className="text-sm text-muted-foreground">Add fuel records with odometer readings to compute efficiency.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="w-64 pl-8" placeholder="Search vehicle / station…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      {isLoading ? <TableSkeleton /> : !data?.items.length ? (
        <EmptyState title="No fuel records" />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead><TableHead>Vehicle</TableHead><TableHead>Driver</TableHead>
                <TableHead>Type</TableHead><TableHead>Litres</TableHead><TableHead>₹/L</TableHead>
                <TableHead>Total</TableHead><TableHead>Odometer</TableHead><TableHead>Station</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((f) => (
                <TableRow key={f.id}>
                  <TableCell>{formatDate(f.fuelDate)}</TableCell>
                  <TableCell className="font-medium">
                    {f.vehicle?.vehicleNumber}
                    {f.vehicle?.vehicleNumber && anomalyVehicles.has(f.vehicle.vehicleNumber) && (
                      <Badge variant="outline" className="ml-2 border-transparent bg-red-100 px-1.5 py-0 text-[10px] text-red-800">!</Badge>
                    )}
                  </TableCell>
                  <TableCell>{f.driver?.name ?? '—'}</TableCell>
                  <TableCell>{f.fuelType}</TableCell>
                  <TableCell>{f.liters} L</TableCell>
                  <TableCell>{formatCurrency(f.pricePerLiter)}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(f.totalCost)}</TableCell>
                  <TableCell>{formatKm(f.odometer)}</TableCell>
                  <TableCell>{f.station ?? '—'}</TableCell>
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
          <DialogHeader><DialogTitle>Add fuel record</DialogTitle></DialogHeader>
          <FuelForm onDone={() => setFormOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
