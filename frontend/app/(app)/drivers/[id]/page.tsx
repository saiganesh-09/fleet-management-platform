'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { driversApi, documentsApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate, formatDateTime, formatKm, formatCurrency } from '@/lib/utils';

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value ?? '—'}</span>
    </div>
  );
}

export default function DriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, error } = useQuery({ queryKey: ['drivers', id], queryFn: () => driversApi.get(id), retry: false });
  const { data: docs } = useQuery({ queryKey: ['documents', 'driver', id], queryFn: () => documentsApi.list({ entityType: 'DRIVER', entityId: id, limit: 50 }) });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-64 w-full" /></div>;
  if (error || !data?.data) return <EmptyState title="Driver not found" description={error?.message} />;
  const d = data.data;
  const s = d.stats;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild><Link href="/drivers"><ArrowLeft /></Link></Button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{d.name}</h1>
            <StatusBadge status={d.status} />
          </div>
          <p className="text-sm text-muted-foreground">{d.employeeId} · {d.experienceYears} yrs experience</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Total trips', value: s?.totalTrips },
          { label: 'Completed', value: s?.completedTrips },
          { label: 'Cancelled', value: s?.cancelledTrips },
          { label: 'Distance', value: formatKm(s?.distanceTravelled) },
          { label: 'License expires', value: s?.licenseExpiresInDays != null ? `${s.licenseExpiresInDays} days` : '—' },
        ].map((k) => (
          <Card key={k.label}><CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="text-xl font-bold">{k.value ?? '—'}</p>
          </CardContent></Card>
        ))}
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="trips">Trip history</TabsTrigger>
          <TabsTrigger value="fuel">Fuel records</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card><CardContent className="pt-5">
            <InfoRow label="Phone" value={d.phone} />
            <InfoRow label="Email" value={d.email} />
            <InfoRow label="License number" value={d.licenseNumber} />
            <InfoRow label="License expiry" value={formatDate(d.licenseExpiry)} />
            <InfoRow label="Assigned vehicle" value={
              d.assignedVehicles?.length
                ? <Link className="text-primary hover:underline" href={`/vehicles/${d.assignedVehicles[0].id}`}>{d.assignedVehicles[0].vehicleNumber}</Link>
                : 'None'
            } />
            <InfoRow label="Member since" value={formatDate(d.createdAt)} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="trips">
          <Card><CardContent className="pt-5">
            {!d.trips?.length ? <EmptyState title="No trips" /> : (
              <Table>
                <TableHeader><TableRow><TableHead>Trip</TableHead><TableHead>Route</TableHead><TableHead>Vehicle</TableHead><TableHead>Start</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {d.trips.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.tripNumber}</TableCell>
                      <TableCell>{t.source} → {t.destination}</TableCell>
                      <TableCell>{t.vehicle?.vehicleNumber}</TableCell>
                      <TableCell>{formatDateTime(t.startTime)}</TableCell>
                      <TableCell><StatusBadge status={t.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="fuel">
          <Card><CardContent className="pt-5">
            {!d.fuelRecords?.length ? <EmptyState title="No fuel records" /> : (
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Vehicle</TableHead><TableHead>Litres</TableHead><TableHead>Cost</TableHead></TableRow></TableHeader>
                <TableBody>
                  {d.fuelRecords.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell>{formatDate(f.fuelDate)}</TableCell>
                      <TableCell>{f.vehicle?.vehicleNumber}</TableCell>
                      <TableCell>{f.liters} L</TableCell>
                      <TableCell>{formatCurrency(f.totalCost)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card><CardContent className="pt-5">
            {!docs?.items.length ? <EmptyState title="No documents" /> : (
              <Table>
                <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Number</TableHead><TableHead>Expiry</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {docs.items.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>{doc.documentType.replace(/_/g, ' ')}</TableCell>
                      <TableCell className="font-mono text-xs">{doc.documentNumber ?? '—'}</TableCell>
                      <TableCell>{formatDate(doc.expiryDate)}</TableCell>
                      <TableCell><StatusBadge status={doc.computedStatus ?? doc.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
