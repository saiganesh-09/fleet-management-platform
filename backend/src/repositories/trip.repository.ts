import { Prisma, TripStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { PageParams } from '../utils/pagination';

export interface TripFilters {
  status?: TripStatus;
  vehicleId?: string;
  driverId?: string;
  from?: Date;
  to?: Date;
}

const tripInclude = {
  vehicle: { select: { id: true, vehicleNumber: true, vehicleType: true, status: true } },
  driver: { select: { id: true, name: true, employeeId: true, phone: true, status: true } },
} satisfies Prisma.TripInclude;

export const tripRepository = {
  async findMany(params: PageParams, filters: TripFilters) {
    const where: Prisma.TripWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
      ...(filters.driverId ? { driverId: filters.driverId } : {}),
      ...(filters.from || filters.to
        ? { startTime: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
        : {}),
      ...(params.search
        ? {
            OR: [
              { tripNumber: { contains: params.search, mode: 'insensitive' } },
              { source: { contains: params.search, mode: 'insensitive' } },
              { destination: { contains: params.search, mode: 'insensitive' } },
              { vehicle: { vehicleNumber: { contains: params.search, mode: 'insensitive' } } },
              { driver: { name: { contains: params.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const orderBy = params.sortBy
      ? { [params.sortBy]: params.sortOrder }
      : { createdAt: 'desc' as const };
    const [items, total] = await prisma.$transaction([
      prisma.trip.findMany({ where, include: tripInclude, orderBy, skip: params.skip, take: params.limit }),
      prisma.trip.count({ where }),
    ]);
    return { items, total };
  },

  findById(id: string) {
    return prisma.trip.findUnique({ where: { id }, include: tripInclude });
  },

  create(data: Prisma.TripCreateInput) {
    return prisma.trip.create({ data, include: tripInclude });
  },

  update(id: string, data: Prisma.TripUpdateInput) {
    return prisma.trip.update({ where: { id }, data, include: tripInclude });
  },

  async countByStatus() {
    const rows = await prisma.trip.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } });
    return Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
  },

  /** Active trips whose vehicle/driver is locked. */
  findActiveForVehicle(vehicleId: string) {
    return prisma.trip.findFirst({
      where: { vehicleId, status: { in: ['SCHEDULED', 'STARTED', 'IN_TRANSIT', 'DELAYED'] } },
    });
  },

  findActiveForDriver(driverId: string) {
    return prisma.trip.findFirst({
      where: { driverId, status: { in: ['SCHEDULED', 'STARTED', 'IN_TRANSIT', 'DELAYED'] } },
    });
  },
};
