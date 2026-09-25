'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { locationsApi, vehiclesApi, driversApi } from '@/services/api';
import { getSocket } from '@/lib/socket';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { timeAgo } from '@/lib/utils';
import type { LiveLocation } from '@/types';

const FleetMap = dynamic(() => import('@/components/map/fleet-map'), {
  ssr: false,
  loading: () => <Skeleton className="h-[500px] w-full" />,
});

const STATUSES = ['AVAILABLE', 'ASSIGNED', 'ON_TRIP', 'MAINTENANCE', 'INACTIVE'];

export default function LiveMapPage() {
  const [live, setLive] = useState<Map<string, LiveLocation>>(new Map());
  const [statusFilter, setStatusFilter] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [driverFilter, setDriverFilter] = useState('');

  // Initial snapshot
  const { data } = useQuery({ queryKey: ['locations', 'live'], queryFn: () => locationsApi.live(), refetchInterval: 60_000 });
  const { data: vehicles } = useQuery({ queryKey: ['vehicles', 'all'], queryFn: () => vehiclesApi.list({ limit: 100 }) });
  const { data: drivers } = useQuery({ queryKey: ['drivers', 'all'], queryFn: () => driversApi.list({ limit: 100 }) });

  // Merge REST snapshot
  useEffect(() => {
    if (!data?.data) return;
    setLive((prev) => {
      const next = new Map(prev);
      for (const v of data.data) next.set(v.id, v);
      return next;
    });
  }, [data]);

  // Realtime updates from the GPS simulator
  useEffect(() => {
    const socket = getSocket();
    const onBatch = (batch: LiveLocation[]) => {
      setLive((prev) => {
        const next = new Map(prev);
        for (const v of batch) next.set(v.vehicleId ?? v.id, { ...next.get(v.vehicleId ?? v.id), ...v });
        return next;
      });
    };
    socket.on('fleet:locations', onBatch);
    return () => { socket.off('fleet:locations', onBatch); };
  }, []);

  const list = useMemo(() => {
    let items = [...live.values()];
    if (statusFilter) items = items.filter((v) => v.status === statusFilter);
    if (vehicleFilter) items = items.filter((v) => (v.id ?? v.vehicleId) === vehicleFilter);
    if (driverFilter) items = items.filter((v) => (v.driver?.id ?? v.assignedDriver?.id) === driverFilter);
    return items;
  }, [live, statusFilter, vehicleFilter, driverFilter]);

  const onTripCount = [...live.values()].filter((v) => v.status === 'ON_TRIP').length;

  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Live Fleet Map</h1>
          <p className="text-sm text-muted-foreground">
            {list.length} tracked · {onTripCount} on trip · realtime via GPS simulator
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={vehicleFilter || 'ALL'} onValueChange={(v) => setVehicleFilter(v === 'ALL' ? '' : v)}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All vehicles" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All vehicles</SelectItem>
              {(vehicles?.items ?? []).map((v) => <SelectItem key={v.id} value={v.id}>{v.vehicleNumber}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={driverFilter || 'ALL'} onValueChange={(v) => setDriverFilter(v === 'ALL' ? '' : v)}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All drivers" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All drivers</SelectItem>
              {(drivers?.items ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter || 'ALL'} onValueChange={(v) => setStatusFilter(v === 'ALL' ? '' : v)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid flex-1 gap-4 lg:grid-cols-[1fr_280px]">
        <Card className="overflow-hidden">
          <CardContent className="h-full p-0">
            <FleetMap vehicles={list} />
          </CardContent>
        </Card>
        <Card className="max-h-[70vh] overflow-hidden">
          <div className="border-b px-4 py-2.5 text-sm font-semibold">Tracked vehicles</div>
          <div className="max-h-[64vh] overflow-y-auto">
            {list.map((v) => (
              <div key={v.id ?? v.vehicleId} className="border-b px-4 py-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{v.vehicleNumber}</span>
                  <StatusBadge status={v.status} />
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {(v.driver ?? v.assignedDriver)?.name ?? 'No driver'} · {Math.round(v.speed ?? v.lastSpeed ?? 0)} km/h
                  <br />updated {timeAgo(v.timestamp ?? v.lastLocationAt)}
                </div>
              </div>
            ))}
            {!list.length && <p className="p-4 text-sm text-muted-foreground">No vehicles match the filters.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
