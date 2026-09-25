import { prisma } from '../config/prisma';
import { vehicleRepository, VehicleFilters } from '../repositories/vehicle.repository';
import { driverRepository } from '../repositories/driver.repository';
import { tripRepository } from '../repositories/trip.repository';
import { ApiError } from '../utils/apiError';
import { PageParams } from '../utils/pagination';
import { audit } from '../utils/audit';
import { notificationService } from './notification.service';

export const vehicleService = {
  async list(params: PageParams, filters: VehicleFilters) {
    const { items, total } = await vehicleRepository.findMany(params, filters);
    return { items, total, page: params.page, limit: params.limit, totalPages: Math.ceil(total / params.limit) };
  },

  async get(id: string) {
    const vehicle = await vehicleRepository.findDetail(id);
    if (!vehicle) throw ApiError.notFound('Vehicle not found', 'VEHICLE_NOT_FOUND');
    return vehicle;
  },

  async create(data: Parameters<typeof vehicleRepository.create>[0], userId: string) {
    const vehicle = await vehicleRepository.create(data);
    await audit({ userId, action: 'VEHICLE_CREATED', entity: 'Vehicle', entityId: vehicle.id, newValue: vehicle });
    return vehicle;
  },

  async update(id: string, data: Parameters<typeof vehicleRepository.update>[1], userId: string) {
    const existing = await vehicleRepository.findById(id);
    if (!existing) throw ApiError.notFound('Vehicle not found', 'VEHICLE_NOT_FOUND');
    if (data.status === 'MAINTENANCE') {
      const activeTrip = await tripRepository.findActiveForVehicle(id);
      if (activeTrip) {
        throw ApiError.conflict('Vehicle has an active trip and cannot enter maintenance', 'VEHICLE_ON_TRIP');
      }
    }
    const vehicle = await vehicleRepository.update(id, data);
    await audit({ userId, action: 'VEHICLE_UPDATED', entity: 'Vehicle', entityId: id, oldValue: existing, newValue: vehicle });
    return vehicle;
  },

  async deactivate(id: string, userId: string) {
    const existing = await vehicleRepository.findById(id);
    if (!existing) throw ApiError.notFound('Vehicle not found', 'VEHICLE_NOT_FOUND');
    const activeTrip = await tripRepository.findActiveForVehicle(id);
    if (activeTrip) throw ApiError.conflict('Vehicle has an active trip', 'VEHICLE_ON_TRIP');
    const vehicle = await vehicleRepository.update(id, { status: 'INACTIVE' });
    await audit({ userId, action: 'VEHICLE_DEACTIVATED', entity: 'Vehicle', entityId: id });
    return vehicle;
  },

  /** Assign/unassign the primary driver for a vehicle. */
  async assignDriver(vehicleId: string, driverId: string | null, userId: string) {
    const vehicle = await vehicleRepository.findById(vehicleId);
    if (!vehicle) throw ApiError.notFound('Vehicle not found', 'VEHICLE_NOT_FOUND');
    if (vehicle.status === 'ON_TRIP' || vehicle.status === 'MAINTENANCE') {
      throw ApiError.conflict(`Cannot change driver while vehicle is ${vehicle.status}`, 'VEHICLE_UNAVAILABLE');
    }

    if (driverId) {
      const driver = await driverRepository.findById(driverId);
      if (!driver) throw ApiError.notFound('Driver not found', 'DRIVER_NOT_FOUND');
      if (driver.status === 'INACTIVE' || driver.status === 'ON_LEAVE') {
        throw ApiError.conflict(`Driver is ${driver.status.toLowerCase()}`, 'DRIVER_UNAVAILABLE');
      }
    }

    const updated = await vehicleRepository.update(vehicleId, {
      assignedDriver: driverId ? { connect: { id: driverId } } : { disconnect: true },
    });
    await audit({
      userId, action: 'VEHICLE_DRIVER_ASSIGNED', entity: 'Vehicle', entityId: vehicleId,
      oldValue: { assignedDriverId: vehicle.assignedDriverId },
      newValue: { assignedDriverId: driverId },
    });
    if (driverId) {
      const driver = await driverRepository.findById(driverId);
      if (driver?.userId) {
        await notificationService.notifyUser(driver.userId, {
          title: 'Vehicle assigned',
          message: `You have been assigned vehicle ${vehicle.vehicleNumber}`,
          type: 'INFO',
        });
      }
    }
    return updated;
  },

  /** Driver reports a vehicle problem → creates a scheduled maintenance ticket + alerts managers. */
  async reportIssue(vehicleId: string, input: { description: string; severity?: string }, user: { id: string; name: string }) {
    const vehicle = await vehicleRepository.findById(vehicleId);
    if (!vehicle) throw ApiError.notFound('Vehicle not found', 'VEHICLE_NOT_FOUND');

    const record = await prisma.maintenanceRecord.create({
      data: {
        vehicle: { connect: { id: vehicleId } },
        serviceType: 'Driver Reported Issue',
        serviceDate: new Date(),
        cost: 0,
        status: 'SCHEDULED',
        description: `[${input.severity ?? 'NORMAL'}] ${input.description}`,
      },
    });

    await audit({ userId: user.id, action: 'VEHICLE_ISSUE_REPORTED', entity: 'Vehicle', entityId: vehicleId, newValue: input });
    await notificationService.notifyManagers({
      title: 'Driver reported a vehicle problem',
      message: `${user.name}: ${vehicle.vehicleNumber} — ${input.description}`.slice(0, 300),
      type: input.severity === 'HIGH' ? 'ALERT' : 'WARNING',
    });
    return record;
  },

  async statusSummary() {
    return vehicleRepository.countByStatus();
  },

  /** Marks a vehicle location update (used by GPS simulator). */
  updateLocation(vehicleId: string, lat: number, lng: number, speed: number) {
    return prisma.vehicle.update({
      where: { id: vehicleId },
      data: { lastLatitude: lat, lastLongitude: lng, lastSpeed: speed, lastLocationAt: new Date() },
    });
  },
};
