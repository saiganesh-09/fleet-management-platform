import { MaintenanceStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { PageParams } from '../utils/pagination';

const include = { vehicle: { select: { id: true, vehicleNumber: true, status: true, currentOdometer: true } } } satisfies Prisma.MaintenanceRecordInclude;

export const maintenanceRepository = {
  async findMany(params: PageParams, filters: { vehicleId?: string; status?: MaintenanceStatus }) {
    const where: Prisma.MaintenanceRecordWhereInput = {
      ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(params.search
        ? {
            OR: [
              { serviceType: { contains: params.search, mode: 'insensitive' } },
              { workshop: { contains: params.search, mode: 'insensitive' } },
              { vehicle: { vehicleNumber: { contains: params.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.maintenanceRecord.findMany({ where, include, orderBy: { serviceDate: 'desc' }, skip: params.skip, take: params.limit }),
      prisma.maintenanceRecord.count({ where }),
    ]);
    return { items, total };
  },

  findById(id: string) {
    return prisma.maintenanceRecord.findUnique({ where: { id }, include });
  },

  create(data: Prisma.MaintenanceRecordCreateInput) {
    return prisma.maintenanceRecord.create({ data, include });
  },

  update(id: string, data: Prisma.MaintenanceRecordUpdateInput) {
    return prisma.maintenanceRecord.update({ where: { id }, data, include });
  },

  /** Services coming up (scheduled, sorted by date). */
  upcoming(days = 30) {
    const now = new Date();
    const until = new Date(now.getTime() + days * 86_400_000);
    return prisma.maintenanceRecord.findMany({
      // gte: now keeps overdue records out — they belong to `overdue()` only
      where: { status: 'SCHEDULED', serviceDate: { gte: now, lte: until } },
      include,
      orderBy: { serviceDate: 'asc' },
    });
  },

  overdue() {
    return prisma.maintenanceRecord.findMany({
      where: { status: 'SCHEDULED', serviceDate: { lt: new Date() } },
      include,
      orderBy: { serviceDate: 'asc' },
    });
  },

  /** Vehicles approaching their next service odometer (within `withinKm`). */
  async dueByOdometer(withinKm = 1500) {
    const records = await prisma.maintenanceRecord.findMany({
      where: { status: 'COMPLETED', nextServiceOdometer: { not: null } },
      include,
      orderBy: { serviceDate: 'desc' },
    });
    const latestByVehicle = new Map<string, (typeof records)[number]>();
    for (const r of records) {
      if (!latestByVehicle.has(r.vehicleId)) latestByVehicle.set(r.vehicleId, r);
    }
    return [...latestByVehicle.values()].filter(
      (r) => r.vehicle && r.nextServiceOdometer != null && r.vehicle.currentOdometer >= r.nextServiceOdometer - withinKm,
    );
  },
};
