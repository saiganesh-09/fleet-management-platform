'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { reportsApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ReportTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) return <p className="p-4 text-sm text-muted-foreground">No data in range.</p>;
  const cols = Object.keys(rows[0]);
  return (
    <div className="max-h-[480px] overflow-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>{cols.map((c) => <TableHead key={c} className="whitespace-nowrap">{c}</TableHead>)}</TableRow>
        </TableHeader>
        <TableBody>
          {rows.slice(0, 100).map((r, i) => (
            <TableRow key={i}>{cols.map((c) => <TableCell key={c} className="whitespace-nowrap text-xs">{String(r[c] ?? '')}</TableCell>)}</TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function ReportsPage() {
  const [tab, setTab] = useState<'fleet' | 'fuel' | 'maintenance' | 'trips'>('fleet');
  const [downloading, setDownloading] = useState(false);

  const { data: fleet, isLoading: l1 } = useQuery({ queryKey: ['report', 'fleet'], queryFn: () => reportsApi.fleet() });
  const { data: fuel, isLoading: l2 } = useQuery({ queryKey: ['report', 'fuel'], queryFn: () => reportsApi.fuel() });
  const { data: maint, isLoading: l3 } = useQuery({ queryKey: ['report', 'maintenance'], queryFn: () => reportsApi.maintenance() });
  const { data: trips, isLoading: l4 } = useQuery({ queryKey: ['report', 'trips'], queryFn: () => reportsApi.trips() });

  const handleCsv = async () => {
    setDownloading(true);
    try {
      const csv = await reportsApi.downloadCsv(tab);
      downloadCsv(`${tab}-report.csv`, csv);
      toast.success('CSV downloaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setDownloading(false);
    }
  };

  const summaries: Record<string, React.ReactNode> = {
    fleet: fleet && <span>{fleet.data.total} vehicles</span>,
    fuel: fuel && <span>{fuel.data.total} records · {fuel.data.totalLiters.toFixed(0)} L · {formatCurrency(fuel.data.totalCost)}</span>,
    maintenance: maint && <span>{maint.data.total} records · {formatCurrency(maint.data.totalCost)}</span>,
    trips: trips && (
      <span>
        {trips.data.total} trips · {Object.entries(trips.data.byStatus).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(' · ')}
      </span>
    ),
  };

  const rows: Record<string, Record<string, unknown>[] | undefined> = {
    fleet: fleet?.data.rows,
    fuel: fuel?.data.rows,
    maintenance: maint?.data.rows,
    trips: trips?.data.rows,
  };
  const loading = { fleet: l1, fuel: l2, maintenance: l3, trips: l4 }[tab];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-sm text-muted-foreground">Operational reports with CSV export</p>
        </div>
        <Button onClick={handleCsv} disabled={downloading}>
          <Download /> {downloading ? 'Preparing…' : 'Export CSV'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><FileSpreadsheet className="h-4 w-4" /> Operational reports</CardTitle>
          <CardDescription>{summaries[tab]}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList>
              <TabsTrigger value="fleet">Fleet</TabsTrigger>
              <TabsTrigger value="fuel">Fuel</TabsTrigger>
              <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
              <TabsTrigger value="trips">Trips</TabsTrigger>
            </TabsList>
            <div className="mt-4">
              {loading ? <Skeleton className="h-64 w-full" /> : <ReportTable rows={rows[tab] ?? []} />}
            </div>
            {/* Keep TabsContent mounted for a11y */}
            {(['fleet', 'fuel', 'maintenance', 'trips'] as const).map((t) => (
              <TabsContent key={t} value={t} className="hidden" />
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
