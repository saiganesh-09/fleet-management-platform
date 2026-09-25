import { DriverStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { driverRepository } from '../repositories/driver.repository';
import { tripRepository } from '../repositories/trip.repository';
import { ApiError } from '../utils/apiError';
import { PageParams } from '../utils/pagination';
import { audit } from '../utils/audit';
import { daysUntil } from '../utils/generators';

export const driverService = {
  async list(params: PageParams, filters: { status?: DriverStatus }) {
    const { items, total } = await driverRepository.findMany(params, filters);
    return { items, total, page: params.page, limit: params.limit, totalPages: Math.ceil(total / params.limit) };
  },

  async get(id: string) {
    const driver = await driverRepository.findDetail(id);
    if (!driver) throw ApiError.notFound('Driver not found', 'DRIVER_NOT_FOUND');

    const [tripStats, distance] = await prisma.$transaction([
      prisma.trip.groupBy({ by: ['status'], where: { driverId: id }, _count: { _all: true }, orderBy: { status: 'asc' } }),
      prisma.trip.aggregate({ where: { driverId: id, status: 'COMPLETED' }, _sum: { distance: true } }),
    ]);
    const countOf = (r: { _count?: unknown }) =>
      typeof r._count === 'number' ? r._count : (r._count as { _all?: number } | undefined)?._all ?? 0;
    const byStatus = Object.fromEntries(tripStats.map((r) => [r.status, countOf(r)]));
    return {
      ...driver,
      stats: {
        totalTrips: tripStats.reduce((s, r) => s + countOf(r), 0),
        completedTrips: byStatus.COMPLETED ?? 0,
        cancelledTrips: byStatus.CANCELLED ?? 0,
        distanceTravelled: distance._sum.distance ?? 0,
        licenseExpiresInDays: daysUntil(driver.licenseExpiry),
      },
    };
  },

  async create(data: Prisma.DriverCreateInput, userId: string) {
    const driver = await driverRepository.create(data);
    await audit({ userId, action: 'DRIVER_CREATED', entity: 'Driver', entityId: driver.id, newValue: driver });
    return driver;
  },

  async update(id: string, data: Prisma.DriverUpdateInput, userId: string) {
    const existing = await driverRepository.findById(id);
    if (!existing) throw ApiError.notFound('Driver not found', 'DRIVER_NOT_FOUND');
    const driver = await driverRepository.update(id, data);
    await audit({ userId, action: 'DRIVER_UPDATED', entity: 'Driver', entityId: id, oldValue: existing, newValue: driver });
    return driver;
  },

  async setStatus(id: string, status: DriverStatus, userId: string) {
    const existing = await driverRepository.findById(id);
    if (!existing) throw ApiError.notFound('Driver not found', 'DRIVER_NOT_FOUND');
    if (status === 'INACTIVE') {
      const activeTrip = await tripRepository.findActiveForDriver(id);
      if (activeTrip) throw ApiError.conflict('Driver has an active trip', 'DRIVER_ON_TRIP');
    }
    const driver = await driverRepository.updateStatus(id, status);
    await audit({ userId, action: 'DRIVER_STATUS_CHANGED', entity: 'Driver', entityId: id, oldValue: { status: existing.status }, newValue: { status } });
    return driver;
  },
};
