import { Prisma, VehicleStatus, VehicleType } from '@prisma/client';
import { prisma } from '../config/prisma';
import { PageParams } from '../utils/pagination';

export interface VehicleFilters {
  status?: VehicleStatus;
  vehicleType?: VehicleType;
  driverId?: string;
}

const vehicleInclude = {
  assignedDriver: { select: { id: true, name: true, employeeId: true, phone: true } },
} satisfies Prisma.VehicleInclude;

export const vehicleRepository = {
  async findMany(params: PageParams, filters: VehicleFilters) {
    const where: Prisma.VehicleWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.vehicleType ? { vehicleType: filters.vehicleType } : {}),
      ...(filters.driverId ? { assignedDriverId: filters.driverId } : {}),
      ...(params.search
        ? {
            OR: [
              { vehicleNumber: { contains: params.search, mode: 'insensitive' } },
              { registrationNumber: { contains: params.search, mode: 'insensitive' } },
              { manufacturer: { contains: params.search, mode: 'insensitive' } },
              { model: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const orderBy = params.sortBy
      ? { [params.sortBy]: params.sortOrder }
      : { createdAt: 'desc' as const };
    const [items, total] = await prisma.$transaction([
      prisma.vehicle.findMany({ where, include: vehicleInclude, orderBy, skip: params.skip, take: params.limit }),
      prisma.vehicle.count({ where }),
    ]);
    return { items, total };
  },

  findById(id: string) {
    return prisma.vehicle.findUnique({ where: { id }, include: vehicleInclude });
  },

  findDetail(id: string) {
    return prisma.vehicle.findUnique({
      where: { id },
      include: {
        ...vehicleInclude,
        trips: { orderBy: { createdAt: 'desc' }, take: 10, include: { driver: { select: { id: true, name: true } } } },
        maintenanceRecords: { orderBy: { serviceDate: 'desc' }, take: 10 },
        fuelRecords: { orderBy: { fuelDate: 'desc' }, take: 10, include: { driver: { select: { id: true, name: true } } } },
      },
    });
  },

  create(data: Prisma.VehicleCreateInput) {
    return prisma.vehicle.create({ data, include: vehicleInclude });
  },

  update(id: string, data: Prisma.VehicleUpdateInput) {
    return prisma.vehicle.update({ where: { id }, data, include: vehicleInclude });
  },

  updateStatus(id: string, status: VehicleStatus) {
    return prisma.vehicle.update({ where: { id }, data: { status } });
  },

  async countByStatus() {
    const rows = await prisma.vehicle.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } });
    return Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
  },
};
