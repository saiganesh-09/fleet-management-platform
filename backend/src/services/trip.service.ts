import { Prisma, TripStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { tripRepository, TripFilters } from '../repositories/trip.repository';
import { vehicleRepository } from '../repositories/vehicle.repository';
import { driverRepository } from '../repositories/driver.repository';
import { ApiError } from '../utils/apiError';
import { PageParams } from '../utils/pagination';
import { audit } from '../utils/audit';
import { nextTripNumber } from '../utils/generators';
import { notificationService } from './notification.service';
import { emitToAll } from '../realtime';

export const tripService = {
  async list(params: PageParams, filters: TripFilters) {
    const { items, total } = await tripRepository.findMany(params, filters);
    return { items, total, page: params.page, limit: params.limit, totalPages: Math.ceil(total / params.limit) };
  },

  async get(id: string) {
    const trip = await tripRepository.findById(id);
    if (!trip) throw ApiError.notFound('Trip not found', 'TRIP_NOT_FOUND');
    return trip;
  },

  /** Trips visible to a driver user account (their own assignments). */
  async listForDriverUser(userId: string, params: PageParams) {
    const driver = await prisma.driver.findUnique({ where: { userId } });
    if (!driver) return { items: [], total: 0, page: params.page, limit: params.limit, totalPages: 0 };
    const { items, total } = await tripRepository.findMany(params, { driverId: driver.id });
    return { items, total, page: params.page, limit: params.limit, totalPages: Math.ceil(total / params.limit) };
  },

  async create(input: {
    vehicleId: string; driverId: string; source: string; destination: string;
    startTime: Date; expectedEndTime?: Date; distance?: number; notes?: string;
    sourceLat?: number; sourceLng?: number; destinationLat?: number; destinationLng?: number;
  }, userId: string) {
    const vehicle = await vehicleRepository.findById(input.vehicleId);
    if (!vehicle) throw ApiError.notFound('Vehicle not found', 'VEHICLE_NOT_FOUND');
    if (vehicle.status === 'MAINTENANCE') {
      throw ApiError.conflict('Vehicle is currently under maintenance', 'VEHICLE_UNAVAILABLE');
    }
    if (vehicle.status === 'INACTIVE') {
      throw ApiError.conflict('Vehicle is inactive', 'VEHICLE_UNAVAILABLE');
    }
    if (vehicle.status === 'ON_TRIP') {
      throw ApiError.conflict('Vehicle is already on a trip', 'VEHICLE_UNAVAILABLE');
    }

    const driver = await driverRepository.findById(input.driverId);
    if (!driver) throw ApiError.notFound('Driver not found', 'DRIVER_NOT_FOUND');
    if (driver.status === 'INACTIVE' || driver.status === 'ON_LEAVE') {
      throw ApiError.conflict(`Driver is ${driver.status.toLowerCase()}`, 'DRIVER_UNAVAILABLE');
    }
    if (driver.licenseExpiry < new Date()) {
      throw ApiError.conflict('Driver license has expired — cannot assign a trip', 'LICENSE_EXPIRED');
    }

    const existingVehicleTrip = await tripRepository.findActiveForVehicle(input.vehicleId);
    if (existingVehicleTrip) {
      throw ApiError.conflict('Vehicle already has an active trip', 'VEHICLE_UNAVAILABLE');
    }
    const existingDriverTrip = await tripRepository.findActiveForDriver(input.driverId);
    if (existingDriverTrip) {
      throw ApiError.conflict('Driver already has an active trip', 'DRIVER_UNAVAILABLE');
    }
    if (input.expectedEndTime && input.expectedEndTime <= input.startTime) {
      throw ApiError.badRequest('Expected end time must be after start time', 'INVALID_SCHEDULE');
    }

    const tripNumber = await nextTripNumber();

    const trip = await prisma.$transaction(async (tx) => {
      const created = await tx.trip.create({
        data: {
          tripNumber,
          vehicleId: input.vehicleId,
          driverId: input.driverId,
          source: input.source,
          destination: input.destination,
          sourceLat: input.sourceLat,
          sourceLng: input.sourceLng,
          destinationLat: input.destinationLat,
          destinationLng: input.destinationLng,
          startTime: input.startTime,
          expectedEndTime: input.expectedEndTime,
          distance: input.distance,
          notes: input.notes,
          status: 'SCHEDULED',
          createdById: userId,
        },
        include: {
          vehicle: { select: { id: true, vehicleNumber: true, vehicleType: true, status: true } },
          driver: { select: { id: true, name: true, employeeId: true, phone: true, status: true } },
        },
      });
      await tx.vehicle.update({ where: { id: input.vehicleId }, data: { status: 'ASSIGNED', assignedDriverId: input.driverId } });
      await tx.driver.update({ where: { id: input.driverId }, data: { status: 'ASSIGNED' } });
      return created;
    });

    await audit({ userId, action: 'TRIP_CREATED', entity: 'Trip', entityId: trip.id, newValue: trip });
    if (driver.userId) {
      await notificationService.notifyUser(driver.userId, {
        title: 'New trip assigned',
        message: `Trip ${trip.tripNumber}: ${trip.source} → ${trip.destination}`,
        type: 'INFO',
      });
    }
    emitToAll('trip:updated', { id: trip.id, status: trip.status });
    return trip;
  },

  async update(id: string, data: Prisma.TripUpdateInput, userId: string) {
    const existing = await tripRepository.findById(id);
    if (!existing) throw ApiError.notFound('Trip not found', 'TRIP_NOT_FOUND');
    if (['COMPLETED', 'CANCELLED'].includes(existing.status)) {
      throw ApiError.conflict(`Cannot edit a ${existing.status.toLowerCase()} trip`, 'TRIP_CLOSED');
    }
    const trip = await tripRepository.update(id, data);
    await audit({ userId, action: 'TRIP_UPDATED', entity: 'Trip', entityId: id, oldValue: existing, newValue: trip });
    return trip;
  },

  /**
   * Advances a trip through its lifecycle, keeping vehicle & driver statuses
   * consistent inside a transaction. `actor` may be a manager or the assigned driver.
   */
  async transition(id: string, target: 'STARTED' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED' | 'DELAYED', actor: { id: string; role: string }, odometer?: number) {
    const trip = await tripRepository.findById(id);
    if (!trip) throw ApiError.notFound('Trip not found', 'TRIP_NOT_FOUND');

    // Drivers may only act on their own trips
    if (actor.role === 'DRIVER') {
      const driverProfile = await prisma.driver.findUnique({ where: { userId: actor.id } });
      if (!driverProfile || driverProfile.id !== trip.driverId) {
        throw ApiError.forbidden('You can only update trips assigned to you', 'NOT_YOUR_TRIP');
      }
    }

    const allowed: Record<TripStatus, TripStatus[]> = {
      SCHEDULED: ['STARTED', 'CANCELLED'],
      STARTED: ['IN_TRANSIT', 'COMPLETED', 'CANCELLED', 'DELAYED'],
      IN_TRANSIT: ['COMPLETED', 'DELAYED', 'CANCELLED'],
      DELAYED: ['IN_TRANSIT', 'COMPLETED', 'CANCELLED'],
      COMPLETED: [],
      CANCELLED: [],
    };
    if (!allowed[trip.status].includes(target)) {
      throw ApiError.conflict(`Trip cannot move from ${trip.status} to ${target}`, 'INVALID_TRANSITION');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const t = await tx.trip.update({
        where: { id },
        data: {
          status: target,
          actualEndTime: target === 'COMPLETED' || target === 'CANCELLED' ? new Date() : undefined,
        },
        include: {
          vehicle: { select: { id: true, vehicleNumber: true, vehicleType: true, status: true } },
          driver: { select: { id: true, name: true, employeeId: true, phone: true, status: true } },
        },
      });

      if (target === 'STARTED' || target === 'IN_TRANSIT') {
        await tx.vehicle.update({ where: { id: trip.vehicleId }, data: { status: 'ON_TRIP' } });
        await tx.driver.update({ where: { id: trip.driverId }, data: { status: 'ON_TRIP' } });
      } else if (target === 'COMPLETED' || target === 'CANCELLED') {
        const vehicleData: Prisma.VehicleUpdateInput = { status: 'AVAILABLE' };
        if (odometer != null) {
          const vehicle = await tx.vehicle.findUnique({ where: { id: trip.vehicleId } });
          if (vehicle && odometer > vehicle.currentOdometer) vehicleData.currentOdometer = odometer;
        }
        await tx.vehicle.update({ where: { id: trip.vehicleId }, data: vehicleData });
        await tx.driver.update({ where: { id: trip.driverId }, data: { status: 'AVAILABLE' } });
      } else if (target === 'DELAYED') {
        // vehicle/driver remain ON_TRIP
      }
      return t;
    });

    await audit({
      userId: actor.id, action: `TRIP_${target}`, entity: 'Trip', entityId: id,
      oldValue: { status: trip.status }, newValue: { status: target },
    });
    if (target === 'DELAYED') {
      await notificationService.notifyManagers({
        title: 'Trip delayed',
        message: `Trip ${trip.tripNumber} (${trip.source} → ${trip.destination}) is delayed`,
        type: 'WARNING',
      });
    }
    emitToAll('trip:updated', { id: updated.id, status: updated.status, tripNumber: updated.tripNumber });
    return updated;
  },
};
