import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { PageParams } from '../utils/pagination';

const include = {
  vehicle: { select: { id: true, vehicleNumber: true, fuelType: true } },
  driver: { select: { id: true, name: true, employeeId: true } },
} satisfies Prisma.FuelRecordInclude;

export const fuelRepository = {
  async findMany(params: PageParams, filters: { vehicleId?: string; driverId?: string; from?: Date; to?: Date }) {
    const where: Prisma.FuelRecordWhereInput = {
      ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
      ...(filters.driverId ? { driverId: filters.driverId } : {}),
      ...(filters.from || filters.to
        ? { fuelDate: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
        : {}),
      ...(params.search
        ? {
            OR: [
              { station: { contains: params.search, mode: 'insensitive' } },
              { vehicle: { vehicleNumber: { contains: params.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.fuelRecord.findMany({ where, include, orderBy: { fuelDate: 'desc' }, skip: params.skip, take: params.limit }),
      prisma.fuelRecord.count({ where }),
    ]);
    return { items, total };
  },

  findById(id: string) {
    return prisma.fuelRecord.findUnique({ where: { id }, include });
  },

  create(data: Prisma.FuelRecordCreateInput) {
    return prisma.fuelRecord.create({ data, include });
  },

  update(id: string, data: Prisma.FuelRecordUpdateInput) {
    return prisma.fuelRecord.update({ where: { id }, data, include });
  },

  delete(id: string) {
    return prisma.fuelRecord.delete({ where: { id } });
  },

  /** All fuel records for a vehicle ordered by odometer — used for efficiency calc. */
  forVehicle(vehicleId: string) {
    return prisma.fuelRecord.findMany({ where: { vehicleId }, orderBy: { odometer: 'asc' } });
  },
};
