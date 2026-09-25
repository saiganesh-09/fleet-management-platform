import { prisma } from '../config/prisma';

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(headers.map((h) => esc(row[h])).join(','));
  return lines.join('\n');
}

export const reportService = {
  async fleetReport() {
    const vehicles = await prisma.vehicle.findMany({
      include: {
        assignedDriver: { select: { name: true } },
        _count: { select: { trips: true, maintenanceRecords: true, fuelRecords: true } },
      },
      orderBy: { vehicleNumber: 'asc' },
    });
    const rows = vehicles.map((v) => ({
      vehicleNumber: v.vehicleNumber,
      registration: v.registrationNumber,
      type: v.vehicleType,
      manufacturer: v.manufacturer,
      model: v.model,
      year: v.manufacturingYear,
      fuel: v.fuelType,
      status: v.status,
      odometer: v.currentOdometer,
      assignedDriver: v.assignedDriver?.name ?? '',
      trips: v._count.trips,
      maintenanceRecords: v._count.maintenanceRecords,
      fuelRecords: v._count.fuelRecords,
    }));
    return { json: { total: vehicles.length, rows }, csv: toCsv(rows) };
  },

  async fuelReport(from?: Date, to?: Date) {
    const records = await prisma.fuelRecord.findMany({
      where: from || to ? { fuelDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {},
      include: { vehicle: { select: { vehicleNumber: true } }, driver: { select: { name: true } } },
      orderBy: { fuelDate: 'desc' },
    });
    const rows = records.map((r) => ({
      date: r.fuelDate.toISOString().slice(0, 10),
      vehicle: r.vehicle.vehicleNumber,
      driver: r.driver?.name ?? '',
      fuelType: r.fuelType,
      liters: r.liters,
      pricePerLiter: r.pricePerLiter,
      totalCost: r.totalCost,
      odometer: r.odometer ?? '',
      station: r.station ?? '',
    }));
    const totalCost = records.reduce((s, r) => s + r.totalCost, 0);
    const totalLiters = records.reduce((s, r) => s + r.liters, 0);
    return { json: { total: records.length, totalCost, totalLiters, rows }, csv: toCsv(rows) };
  },

  async maintenanceReport(from?: Date, to?: Date) {
    const records = await prisma.maintenanceRecord.findMany({
      where: from || to ? { serviceDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {},
      include: { vehicle: { select: { vehicleNumber: true } } },
      orderBy: { serviceDate: 'desc' },
    });
    const rows = records.map((r) => ({
      date: r.serviceDate.toISOString().slice(0, 10),
      vehicle: r.vehicle.vehicleNumber,
      serviceType: r.serviceType,
      status: r.status,
      odometer: r.odometer ?? '',
      nextServiceOdometer: r.nextServiceOdometer ?? '',
      cost: r.cost,
      workshop: r.workshop ?? '',
    }));
    const totalCost = records.reduce((s, r) => s + r.cost, 0);
    return { json: { total: records.length, totalCost, rows }, csv: toCsv(rows) };
  },

  async tripReport(from?: Date, to?: Date) {
    const trips = await prisma.trip.findMany({
      where: from || to ? { startTime: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {},
      include: { vehicle: { select: { vehicleNumber: true } }, driver: { select: { name: true } } },
      orderBy: { startTime: 'desc' },
    });
    const rows = trips.map((t) => ({
      tripNumber: t.tripNumber,
      vehicle: t.vehicle.vehicleNumber,
      driver: t.driver.name,
      source: t.source,
      destination: t.destination,
      status: t.status,
      startTime: t.startTime.toISOString(),
      expectedEnd: t.expectedEndTime?.toISOString() ?? '',
      actualEnd: t.actualEndTime?.toISOString() ?? '',
      distance: t.distance ?? '',
    }));
    const byStatus = trips.reduce<Record<string, number>>((acc, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1;
      return acc;
    }, {});
    return { json: { total: trips.length, byStatus, rows }, csv: toCsv(rows) };
  },
};
