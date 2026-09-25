import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function lastNMonths(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(monthKey(d));
  }
  return out;
}

type StatusGroup = { status: string; _count?: unknown };

function countOf(row: { _count?: unknown }): number {
  const c = row._count;
  if (c == null) return 0;
  if (typeof c === 'number') return c;
  return (c as { _all?: number })._all ?? 0;
}

function toStatusMap(rows: StatusGroup[]): Record<string, number> {
  return Object.fromEntries(rows.map((r) => [r.status, countOf(r)]));
}
const sumCounts = (rows: StatusGroup[]) => rows.reduce((s, r) => s + countOf(r), 0);

export const analyticsService = {
  /** Top-level KPI cards for the dashboard. */
  async dashboard(from?: Date, to?: Date) {
    const tripDateFilter: Prisma.TripWhereInput =
      from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {};

    const [
      vehiclesByStatus,
      driversByStatus,
      tripsByStatus,
      fuelAgg,
      maintAgg,
      expiringDocs,
      totalDistance,
    ] = await prisma.$transaction([
      prisma.vehicle.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } }),
      prisma.driver.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } }),
      prisma.trip.groupBy({ by: ['status'], _count: { _all: true }, where: tripDateFilter, orderBy: { status: 'asc' } }),
      prisma.fuelRecord.aggregate({
        _sum: { totalCost: true, liters: true },
        where: from || to ? { fuelDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {},
      }),
      prisma.maintenanceRecord.aggregate({
        _sum: { cost: true },
        where: from || to ? { serviceDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {},
      }),
      prisma.document.count({ where: { status: { in: ['EXPIRING_SOON', 'EXPIRED'] } } }),
      prisma.trip.aggregate({ _sum: { distance: true }, where: { status: 'COMPLETED' } }),
    ]);

    const v = toStatusMap(vehiclesByStatus);
    const d = toStatusMap(driversByStatus);
    const t = toStatusMap(tripsByStatus);

    return {
      vehicles: {
        total: sumCounts(vehiclesByStatus),
        available: v.AVAILABLE ?? 0,
        onTrip: v.ON_TRIP ?? 0,
        maintenance: v.MAINTENANCE ?? 0,
        assigned: v.ASSIGNED ?? 0,
        inactive: v.INACTIVE ?? 0,
      },
      drivers: {
        total: sumCounts(driversByStatus),
        available: d.AVAILABLE ?? 0,
        onTrip: d.ON_TRIP ?? 0,
      },
      trips: {
        total: sumCounts(tripsByStatus),
        active: (t.SCHEDULED ?? 0) + (t.STARTED ?? 0) + (t.IN_TRANSIT ?? 0),
        completed: t.COMPLETED ?? 0,
        delayed: t.DELAYED ?? 0,
        cancelled: t.CANCELLED ?? 0,
      },
      spend: {
        fuel: fuelAgg._sum.totalCost ?? 0,
        fuelLiters: fuelAgg._sum.liters ?? 0,
        maintenance: maintAgg._sum.cost ?? 0,
        total: (fuelAgg._sum.totalCost ?? 0) + (maintAgg._sum.cost ?? 0),
      },
      distanceTravelled: totalDistance._sum.distance ?? 0,
      documentsExpiring: expiringDocs,
    };
  },

  /** Chart data for the dashboard (last 12 months). */
  async charts() {
    const months = lastNMonths(12);
    const since = new Date();
    since.setMonth(since.getMonth() - 11);
    since.setDate(1);

    const [fuel, maintenance, trips] = await prisma.$transaction([
      prisma.fuelRecord.findMany({ where: { fuelDate: { gte: since } }, select: { fuelDate: true, totalCost: true, liters: true } }),
      prisma.maintenanceRecord.findMany({ where: { serviceDate: { gte: since } }, select: { serviceDate: true, cost: true } }),
      prisma.trip.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true, status: true, distance: true } }),
    ]);

    const fuelByMonth = new Map(months.map((m) => [m, { month: m, cost: 0, liters: 0 }]));
    for (const f of fuel) {
      const row = fuelByMonth.get(monthKey(f.fuelDate));
      if (row) { row.cost += f.totalCost; row.liters += f.liters; }
    }

    const maintByMonth = new Map(months.map((m) => [m, { month: m, cost: 0, count: 0 }]));
    for (const m of maintenance) {
      const row = maintByMonth.get(monthKey(m.serviceDate));
      if (row) { row.cost += m.cost; row.count += 1; }
    }

    const tripsByMonth = new Map(months.map((m) => [m, { month: m, total: 0, completed: 0, cancelled: 0, delayed: 0 }]));
    for (const t of trips) {
      const row = tripsByMonth.get(monthKey(t.createdAt));
      if (row) {
        row.total += 1;
        if (t.status === 'COMPLETED') row.completed += 1;
        if (t.status === 'CANCELLED') row.cancelled += 1;
        if (t.status === 'DELAYED') row.delayed += 1;
      }
    }

    // Fleet utilization: share of vehicles ON_TRIP or ASSIGNED
    const vehiclesByStatus = await prisma.vehicle.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } });
    const totalVehicles = sumCounts(vehiclesByStatus);
    const busy = vehiclesByStatus
      .filter((r) => r.status === 'ON_TRIP' || r.status === 'ASSIGNED')
      .reduce((s, r) => s + countOf(r), 0);

    // Vehicle usage: trips + distance per vehicle
    const usage = await prisma.trip.groupBy({
      by: ['vehicleId'],
      _count: { _all: true },
      _sum: { distance: true },
      orderBy: { vehicleId: 'asc' },
    });
    usage.sort((a, b) => countOf(b) - countOf(a));
    const topUsage = usage.slice(0, 10);
    const vehicleRows = await prisma.vehicle.findMany({
      where: { id: { in: topUsage.map((u) => u.vehicleId) } },
      select: { id: true, vehicleNumber: true },
    });
    const names = new Map(vehicleRows.map((r) => [r.id, r.vehicleNumber]));

    // Driver activity: trips per driver
    const driverActivity = await prisma.trip.groupBy({ by: ['driverId'], _count: { _all: true }, orderBy: { driverId: 'asc' } });
    driverActivity.sort((a, b) => countOf(b) - countOf(a));
    const topDrivers = driverActivity.slice(0, 10);
    const driverRows = await prisma.driver.findMany({
      where: { id: { in: topDrivers.map((x) => x.driverId) } },
      select: { id: true, name: true },
    });
    const driverNames = new Map(driverRows.map((r) => [r.id, r.name]));

    return {
      fuelByMonth: [...fuelByMonth.values()],
      maintenanceByMonth: [...maintByMonth.values()],
      tripsByMonth: [...tripsByMonth.values()],
      utilization: {
        total: totalVehicles,
        busy,
        pct: totalVehicles ? Math.round((busy / totalVehicles) * 100) : 0,
      },
      vehicleUsage: topUsage.map((u) => ({
        vehicleId: u.vehicleId,
        vehicleNumber: names.get(u.vehicleId) ?? u.vehicleId,
        trips: countOf(u),
        distance: u._sum.distance ?? 0,
      })),
      driverActivity: topDrivers.map((x) => ({
        driverId: x.driverId,
        driverName: driverNames.get(x.driverId) ?? x.driverId,
        trips: countOf(x),
      })),
    };
  },
};
