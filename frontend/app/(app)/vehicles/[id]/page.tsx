'use client';

import { use, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { ArrowLeft, Sparkles, FilePlus, Fuel as FuelIcon, Wrench, Flag } from 'lucide-react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { vehiclesApi, documentsApi, locationsApi, aiApi } from '@/services/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { MaintenanceForm } from '@/features/maintenance/maintenance-form';
import { FuelForm } from '@/features/fuel/fuel-form';
import { DocumentForm } from '@/features/documents/document-form';
import { formatCurrency, formatDate, formatDateTime, formatKm, timeAgo } from '@/lib/utils';

const VehicleMiniMap = dynamic(() => import('@/components/map/vehicle-mini-map'), { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> });

const RISK_TONE: Record<string, string> = {
  LOW: 'bg-emerald-100 text-emerald-800',
  MEDIUM: 'bg-amber-100 text-amber-800',
  HIGH: 'bg-red-100 text-red-800',
};

function RiskPanel({ vehicleId }: { vehicleId: string }) {
  const [enabled, setEnabled] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ['ai-risk', vehicleId],
    queryFn: () => aiApi.maintenanceRisk(vehicleId),
    enabled,
    retry: false,
  });
  const risk = data?.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" /> AI Maintenance Risk</CardTitle>
      </CardHeader>
      <CardContent>
        {!enabled && !isLoading && (
          <Button variant="outline" size="sm" onClick={() => setEnabled(true)}>Analyze vehicle</Button>
        )}
        {isLoading && <Skeleton className="h-20 w-full" />}
        {error && <p className="text-sm text-muted-foreground">AI service unavailable — start ai-service to enable.</p>}
        {risk && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={RISK_TONE[risk.risk]}>{risk.risk}</Badge>
              <span className="text-sm text-muted-foreground">score {risk.score}/100</span>
            </div>
            <ul className="list-inside list-disc text-sm text-muted-foreground">
              {risk.reasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
            <p className="text-xs italic text-muted-foreground">{risk.disclaimer}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value ?? '—'}</span>
    </div>
  );
}

export default function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { hasRole } = useAuth();
  const canEdit = hasRole('SUPER_ADMIN', 'FLEET_MANAGER');
  const canReport = hasRole('DRIVER', 'SUPER_ADMIN', 'FLEET_MANAGER');
  const [maintOpen, setMaintOpen] = useState(false);
  const [fuelOpen, setFuelOpen] = useState(false);
  const [docOpen, setDocOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueText, setIssueText] = useState('');
  const [severity, setSeverity] = useState<'LOW' | 'NORMAL' | 'HIGH'>('NORMAL');

  const reportIssue = useMutation({
    mutationFn: () => vehiclesApi.reportIssue(id, issueText, severity),
    onSuccess: () => {
      toast.success('Issue reported — managers have been notified');
      setIssueOpen(false);
      setIssueText('');
    },
    onError: (e) => toast.error(e.message),
  });

  const { data, isLoading, error } = useQuery({ queryKey: ['vehicles', id], queryFn: () => vehiclesApi.get(id), retry: false });
  const { data: docs } = useQuery({ queryKey: ['documents', 'vehicle', id], queryFn: () => documentsApi.list({ entityType: 'VEHICLE', entityId: id, limit: 50 }) });
  const { data: history } = useQuery({ queryKey: ['locations', id], queryFn: () => locationsApi.history(id) });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-64 w-full" /></div>;
  if (error || !data?.data) return <EmptyState title="Vehicle not found" description={error?.message} />;
  const v = data.data;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild><Link href="/vehicles"><ArrowLeft /></Link></Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{v.vehicleNumber}</h1>
            <StatusBadge status={v.status} />
          </div>
          <p className="text-sm text-muted-foreground">{v.manufacturer} {v.model} · {v.manufacturingYear}</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setMaintOpen(true)}><Wrench /> Service</Button>
            <Button variant="outline" size="sm" onClick={() => setFuelOpen(true)}><FuelIcon /> Fuel</Button>
            <Button variant="outline" size="sm" onClick={() => setDocOpen(true)}><FilePlus /> Document</Button>
          </div>
        )}
        {canReport && (
          <Button variant="outline" size="sm" onClick={() => setIssueOpen(true)}><Flag /> Report issue</Button>
        )}
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trips">Trips</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="fuel">Fuel</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="location">Location</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-base">Vehicle details</CardTitle></CardHeader>
              <CardContent>
                <InfoRow label="Registration" value={v.registrationNumber} />
                <InfoRow label="Type" value={v.vehicleType} />
                <InfoRow label="Fuel type" value={v.fuelType} />
                <InfoRow label="Capacity" value={v.capacity ? `${v.capacity} t` : '—'} />
                <InfoRow label="Odometer" value={formatKm(v.currentOdometer)} />
                <InfoRow label="Purchase date" value={formatDate(v.purchaseDate)} />
                <InfoRow label="Assigned driver" value={v.assignedDriver ? `${v.assignedDriver.name} (${v.assignedDriver.employeeId})` : 'Unassigned'} />
                <InfoRow label="Last seen" value={v.lastLocationAt ? timeAgo(v.lastLocationAt) : 'Never'} />
              </CardContent>
            </Card>
            <RiskPanel vehicleId={id} />
          </div>
        </TabsContent>

        <TabsContent value="trips">
          <Card><CardContent className="pt-5">
            {!v.trips?.length ? <EmptyState title="No trips yet" /> : (
              <Table>
                <TableHeader><TableRow><TableHead>Trip</TableHead><TableHead>Route</TableHead><TableHead>Driver</TableHead><TableHead>Start</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {v.trips.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.tripNumber}</TableCell>
                      <TableCell>{t.source} → {t.destination}</TableCell>
                      <TableCell>{t.driver?.name}</TableCell>
                      <TableCell>{formatDateTime(t.startTime)}</TableCell>
                      <TableCell><StatusBadge status={t.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="maintenance">
          <Card><CardContent className="pt-5">
            {!v.maintenanceRecords?.length ? <EmptyState title="No maintenance records" /> : (
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Service</TableHead><TableHead>Odometer</TableHead><TableHead>Next due</TableHead><TableHead>Cost</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {v.maintenanceRecords.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>{formatDate(m.serviceDate)}</TableCell>
                      <TableCell>{m.serviceType}</TableCell>
                      <TableCell>{formatKm(m.odometer)}</TableCell>
                      <TableCell>{m.nextServiceOdometer ? formatKm(m.nextServiceOdometer) : '—'}</TableCell>
                      <TableCell>{formatCurrency(m.cost)}</TableCell>
                      <TableCell><StatusBadge status={m.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="fuel">
          <Card><CardContent className="pt-5">
            {!v.fuelRecords?.length ? <EmptyState title="No fuel records" /> : (
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Litres</TableHead><TableHead>Price/L</TableHead><TableHead>Total</TableHead><TableHead>Odometer</TableHead><TableHead>Station</TableHead></TableRow></TableHeader>
                <TableBody>
                  {v.fuelRecords.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell>{formatDate(f.fuelDate)}</TableCell>
                      <TableCell>{f.liters} L</TableCell>
                      <TableCell>{formatCurrency(f.pricePerLiter)}</TableCell>
                      <TableCell>{formatCurrency(f.totalCost)}</TableCell>
                      <TableCell>{formatKm(f.odometer)}</TableCell>
                      <TableCell>{f.station ?? '—'}</TableCell>
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
                <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Number</TableHead><TableHead>Issued</TableHead><TableHead>Expiry</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {docs.items.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>{d.documentType.replace(/_/g, ' ')}</TableCell>
                      <TableCell className="font-mono text-xs">{d.documentNumber ?? '—'}</TableCell>
                      <TableCell>{formatDate(d.issueDate)}</TableCell>
                      <TableCell>{formatDate(d.expiryDate)}</TableCell>
                      <TableCell><StatusBadge status={d.computedStatus ?? d.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="location">
          <Card><CardContent className="pt-5">
            {v.lastLatitude != null && v.lastLongitude != null ? (
              <div className="space-y-3">
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>Speed: <b className="text-foreground">{v.lastSpeed ?? 0} km/h</b></span>
                  <span>Updated: <b className="text-foreground">{timeAgo(v.lastLocationAt)}</b></span>
                </div>
                <VehicleMiniMap
                  lat={v.lastLatitude}
                  lng={v.lastLongitude}
                  trail={(history?.data ?? []).map((p) => ({ lat: p.latitude, lng: p.longitude }))}
                  label={v.vehicleNumber}
                />
              </div>
            ) : <EmptyState title="No location data" description="The GPS simulator will populate this once running." />}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={maintOpen} onOpenChange={setMaintOpen}>
        <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Schedule service — {v.vehicleNumber}</DialogTitle></DialogHeader>
          <MaintenanceForm defaultVehicleId={v.id} onDone={() => setMaintOpen(false)} />
        </DialogContent>
      </Dialog>
      <Dialog open={fuelOpen} onOpenChange={setFuelOpen}>
        <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Add fuel record — {v.vehicleNumber}</DialogTitle></DialogHeader>
          <FuelForm defaultVehicleId={v.id} onDone={() => setFuelOpen(false)} />
        </DialogContent>
      </Dialog>
      <Dialog open={docOpen} onOpenChange={setDocOpen}>
        <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Add document — {v.vehicleNumber}</DialogTitle></DialogHeader>
          <DocumentForm defaultEntity={{ type: 'VEHICLE', id: v.id }} onDone={() => setDocOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Report a problem — {v.vehicleNumber}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Severity</label>
              <div className="mt-1 flex gap-2">
                {(['LOW', 'NORMAL', 'HIGH'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSeverity(s)}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium ${severity === s ? 'border-primary bg-accent' : 'hover:bg-muted'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Describe the issue</label>
              <textarea
                className="mt-1 min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="e.g. Brake pedal feels spongy on downhill sections…"
                value={issueText}
                onChange={(e) => setIssueText(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIssueOpen(false)}>Cancel</Button>
              <Button onClick={() => reportIssue.mutate()} disabled={issueText.trim().length < 5 || reportIssue.isPending}>
                {reportIssue.isPending ? 'Sending…' : 'Report'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
