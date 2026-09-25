import { MaintenanceStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { maintenanceRepository } from '../repositories/maintenance.repository';
import { vehicleRepository } from '../repositories/vehicle.repository';
import { ApiError } from '../utils/apiError';
import { PageParams } from '../utils/pagination';
import { audit } from '../utils/audit';
import { notificationService } from './notification.service';

export const maintenanceService = {
  async list(params: PageParams, filters: { vehicleId?: string; status?: MaintenanceStatus }) {
    const { items, total } = await maintenanceRepository.findMany(params, filters);
    return { items, total, page: params.page, limit: params.limit, totalPages: Math.ceil(total / params.limit) };
  },

  async get(id: string) {
    const record = await maintenanceRepository.findById(id);
    if (!record) throw ApiError.notFound('Maintenance record not found', 'MAINTENANCE_NOT_FOUND');
    return record;
  },

  async create(data: Parameters<typeof maintenanceRepository.create>[0], userId: string) {
    const vehicleId = (data.vehicle as { connect: { id: string } }).connect.id;
    const vehicle = await vehicleRepository.findById(vehicleId);
    if (!vehicle) throw ApiError.notFound('Vehicle not found', 'VEHICLE_NOT_FOUND');

    const record = await prisma.$transaction(async (tx) => {
      const created = await tx.maintenanceRecord.create({ data, include: { vehicle: { select: { id: true, vehicleNumber: true, status: true, currentOdometer: true } } } });
      // Starting work now → vehicle enters maintenance
      if (created.status === 'IN_PROGRESS' && vehicle.status !== 'ON_TRIP') {
        await tx.vehicle.update({ where: { id: vehicleId }, data: { status: 'MAINTENANCE' } });
      }
      return created;
    });

    await audit({ userId, action: 'MAINTENANCE_CREATED', entity: 'MaintenanceRecord', entityId: record.id, newValue: record });
    await notificationService.notifyManagers({
      title: 'Maintenance scheduled',
      message: `${vehicle.vehicleNumber}: ${record.serviceType} on ${record.serviceDate.toDateString()}`,
      type: 'INFO',
    });
    return record;
  },

  async update(id: string, data: Parameters<typeof maintenanceRepository.update>[1], userId: string) {
    const existing = await maintenanceRepository.findById(id);
    if (!existing) throw ApiError.notFound('Maintenance record not found', 'MAINTENANCE_NOT_FOUND');

    const record = await prisma.$transaction(async (tx) => {
      const updated = await tx.maintenanceRecord.update({ where: { id }, data, include: { vehicle: { select: { id: true, vehicleNumber: true, status: true, currentOdometer: true } } } });
      if (data.status === 'IN_PROGRESS') {
        await tx.vehicle.update({ where: { id: existing.vehicleId }, data: { status: 'MAINTENANCE' } });
      } else if ((data.status === 'COMPLETED' || data.status === 'CANCELLED') && updated.vehicle.status === 'MAINTENANCE') {
        // Only release the vehicle if no other in-progress work remains
        const stillOpen = await tx.maintenanceRecord.count({
          where: { vehicleId: existing.vehicleId, status: 'IN_PROGRESS', id: { not: id } },
        });
        if (!stillOpen) {
          await tx.vehicle.update({ where: { id: existing.vehicleId }, data: { status: 'AVAILABLE' } });
        }
      }
      // Update odometer if the service recorded a higher reading
      const newOdometer = typeof data.odometer === 'number' ? data.odometer : undefined;
      if (newOdometer != null && newOdometer > updated.vehicle.currentOdometer) {
        await tx.vehicle.update({ where: { id: existing.vehicleId }, data: { currentOdometer: newOdometer } });
      }
      return updated;
    });

    await audit({ userId, action: 'MAINTENANCE_UPDATED', entity: 'MaintenanceRecord', entityId: id, oldValue: existing, newValue: record });
    if (data.status === 'COMPLETED') {
      await notificationService.notifyManagers({
        title: 'Maintenance completed',
        message: `${record.vehicle.vehicleNumber}: ${record.serviceType} finished ($${record.cost.toFixed(2)})`,
        type: 'SUCCESS',
      });
    }
    return record;
  },

  async dashboard() {
    const [upcoming, overdue, byOdometer, totalCost, byVehicle] = await Promise.all([
      maintenanceRepository.upcoming(30),
      maintenanceRepository.overdue(),
      maintenanceRepository.dueByOdometer(1500),
      prisma.maintenanceRecord.aggregate({ _sum: { cost: true }, _count: { _all: true } }),
      prisma.maintenanceRecord.groupBy({
        by: ['vehicleId'],
        _sum: { cost: true },
        _count: { _all: true },
        orderBy: { vehicleId: 'asc' },
      }),
    ]);
    byVehicle.sort((a, b) => (b._sum.cost ?? 0) - (a._sum.cost ?? 0));
    const topVehicles = byVehicle.slice(0, 10);
    const vehicles = await prisma.vehicle.findMany({
      where: { id: { in: topVehicles.map((v) => v.vehicleId) } },
      select: { id: true, vehicleNumber: true },
    });
    const vehicleNames = new Map(vehicles.map((v) => [v.id, v.vehicleNumber]));
    return {
      upcoming,
      overdue,
      dueByOdometer: byOdometer,
      totalCost: totalCost._sum.cost ?? 0,
      totalRecords: typeof totalCost._count === 'number' ? totalCost._count : totalCost._count?._all ?? 0,
      costByVehicle: topVehicles.map((v) => ({
        vehicleId: v.vehicleId,
        vehicleNumber: vehicleNames.get(v.vehicleId) ?? v.vehicleId,
        cost: v._sum.cost ?? 0,
        services: typeof v._count === 'number' ? v._count : v._count?._all ?? 0,
      })),
    };
  },
};
