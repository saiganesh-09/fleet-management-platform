'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Truck, Users, Route, Wrench, Fuel, FileWarning, Gauge, CircleDollarSign,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { analyticsApi } from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CardsSkeleton, Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatKm } from '@/lib/utils';
import { cn } from '@/lib/utils';

const PIE_COLORS = ['#10b981', '#6366f1', '#f59e0b', '#94a3b8', '#ef4444'];

function KpiCard({ title, value, sub, icon: Icon, href, tone }: {
  title: string; value: React.ReactNode; sub?: string;
  icon: React.ComponentType<{ className?: string }>; href?: string; tone?: string;
}) {
  const inner = (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex items-center gap-4 pt-5">
        <div className={cn('flex h-11 w-11 items-center justify-center rounded-lg', tone ?? 'bg-accent text-primary')}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className="truncate text-2xl font-bold">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: () => analyticsApi.dashboard(), refetchInterval: 30_000 });
  const { data: charts, isLoading: chartsLoading } = useQuery({ queryKey: ['charts'], queryFn: () => analyticsApi.charts(), refetchInterval: 60_000 });

  const d = data?.data;
  const c = charts?.data;

  const statusPie = d ? [
    { name: 'Available', value: d.vehicles.available },
    { name: 'On Trip', value: d.vehicles.onTrip },
    { name: 'Maintenance', value: d.vehicles.maintenance },
    { name: 'Assigned', value: d.vehicles.assigned },
    { name: 'Inactive', value: d.vehicles.inactive },
  ].filter((s) => s.value > 0) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Fleet overview and key metrics</p>
      </div>

      {isLoading ? <CardsSkeleton /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard title="Total Vehicles" value={d?.vehicles.total} sub={`${d?.vehicles.available ?? 0} available`} icon={Truck} href="/vehicles" />
          <KpiCard title="On Trip" value={d?.vehicles.onTrip} sub={`${d?.vehicles.assigned ?? 0} assigned`} icon={Gauge} href="/fleet/live-map" tone="bg-indigo-100 text-indigo-700" />
          <KpiCard title="Drivers" value={d?.drivers.total} sub={`${d?.drivers.available ?? 0} available`} icon={Users} href="/drivers" tone="bg-emerald-100 text-emerald-700" />
          <KpiCard title="Active Trips" value={d?.trips.active} sub={`${d?.trips.delayed ?? 0} delayed`} icon={Route} href="/trips" tone="bg-sky-100 text-sky-700" />
          <KpiCard title="In Maintenance" value={d?.vehicles.maintenance} icon={Wrench} href="/maintenance" tone="bg-amber-100 text-amber-700" />
          <KpiCard title="Fuel Spend" value={formatCurrency(d?.spend.fuel)} sub={`${Math.round(d?.spend.fuelLiters ?? 0).toLocaleString()} L consumed`} icon={Fuel} href="/fuel" tone="bg-rose-100 text-rose-700" />
          <KpiCard title="Maintenance Spend" value={formatCurrency(d?.spend.maintenance)} icon={CircleDollarSign} href="/maintenance" tone="bg-amber-100 text-amber-700" />
          <KpiCard title="Docs Expiring" value={d?.documentsExpiring} sub="next 30 days / expired" icon={FileWarning} href="/documents" tone="bg-red-100 text-red-700" />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Fuel & Maintenance Cost</CardTitle>
            <CardDescription>Monthly spend over the last 12 months</CardDescription>
          </CardHeader>
          <CardContent>
            {chartsLoading ? <Skeleton className="h-64 w-full" /> : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={(c?.fuelByMonth ?? []).map((f, i) => ({
                  month: f.month.slice(5),
                  fuel: Math.round(f.cost),
                  maintenance: Math.round(c?.maintenanceByMonth[i]?.cost ?? 0),
                }))}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="fuel" name="Fuel" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="maintenance" name="Maintenance" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fleet Status</CardTitle>
            <CardDescription>Utilization {c ? `${c.utilization.pct}%` : ''}</CardDescription>
          </CardHeader>
          <CardContent>
            {chartsLoading ? <Skeleton className="h-64 w-full" /> : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={statusPie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                    {statusPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Trips per Month</CardTitle>
            <CardDescription>Total vs completed vs delayed</CardDescription>
          </CardHeader>
          <CardContent>
            {chartsLoading ? <Skeleton className="h-56 w-full" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={(c?.tripsByMonth ?? []).map((t) => ({ ...t, month: t.month.slice(5) }))}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="total" name="Total" stroke="#6366f1" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="completed" name="Completed" stroke="#10b981" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="delayed" name="Delayed" stroke="#ef4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Vehicles by Trips</CardTitle>
            <CardDescription>Usage leaderboard</CardDescription>
          </CardHeader>
          <CardContent>
            {chartsLoading ? <Skeleton className="h-56 w-full" /> : (
              <div className="space-y-2.5">
                {(c?.vehicleUsage ?? []).slice(0, 7).map((v) => (
                  <div key={v.vehicleId} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{v.vehicleNumber}</span>
                    <span className="text-muted-foreground">{v.trips} trips · {formatKm(v.distance)}</span>
                  </div>
                ))}
                {!c?.vehicleUsage?.length && <p className="text-sm text-muted-foreground">No trip data yet</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
