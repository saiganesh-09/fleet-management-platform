import { DriverStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { PageParams } from '../utils/pagination';

export const driverRepository = {
  async findMany(params: PageParams, filters: { status?: DriverStatus }) {
    const where: Prisma.DriverWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' } },
              { employeeId: { contains: params.search, mode: 'insensitive' } },
              { licenseNumber: { contains: params.search, mode: 'insensitive' } },
              { email: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const orderBy = params.sortBy
      ? { [params.sortBy]: params.sortOrder }
      : { createdAt: 'desc' as const };
    const [items, total] = await prisma.$transaction([
      prisma.driver.findMany({
        where,
        orderBy,
        skip: params.skip,
        take: params.limit,
        include: { assignedVehicles: { select: { id: true, vehicleNumber: true } } },
      }),
      prisma.driver.count({ where }),
    ]);
    return { items, total };
  },

  findById(id: string) {
    return prisma.driver.findUnique({
      where: { id },
      include: { assignedVehicles: { select: { id: true, vehicleNumber: true, status: true } } },
    });
  },

  findDetail(id: string) {
    return prisma.driver.findUnique({
      where: { id },
      include: {
        assignedVehicles: { select: { id: true, vehicleNumber: true, vehicleType: true, status: true } },
        trips: { orderBy: { createdAt: 'desc' }, take: 15, include: { vehicle: { select: { id: true, vehicleNumber: true } } } },
        fuelRecords: { orderBy: { fuelDate: 'desc' }, take: 10, include: { vehicle: { select: { id: true, vehicleNumber: true } } } },
      },
    });
  },

  create(data: Prisma.DriverCreateInput) {
    return prisma.driver.create({ data });
  },

  update(id: string, data: Prisma.DriverUpdateInput) {
    return prisma.driver.update({ where: { id }, data });
  },

  updateStatus(id: string, status: DriverStatus) {
    return prisma.driver.update({ where: { id }, data: { status } });
  },

  async countByStatus() {
    const rows = await prisma.driver.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } });
    return Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
  },
};
