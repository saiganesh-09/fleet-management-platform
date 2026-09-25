import { locationRepository } from '../repositories/misc.repository';
import { vehicleRepository } from '../repositories/vehicle.repository';
import { ApiError } from '../utils/apiError';
import { prisma } from '../config/prisma';

export const locationService = {
  /** All vehicles with their latest known position. */
  live() {
    return locationRepository.latestForVehicles();
  },

  async history(vehicleId: string, limit = 100) {
    const vehicle = await vehicleRepository.findById(vehicleId);
    if (!vehicle) throw ApiError.notFound('Vehicle not found', 'VEHICLE_NOT_FOUND');
    return locationRepository.historyForVehicle(vehicleId, Math.min(limit, 500));
  },

  /** Record a new GPS fix and update the vehicle's denormalized position. */
  async ingest(vehicleId: string, lat: number, lng: number, speed: number, heading?: number) {
    await prisma.$transaction([
      prisma.gpsLocation.create({ data: { vehicleId, latitude: lat, longitude: lng, speed, heading } }),
      prisma.vehicle.update({
        where: { id: vehicleId },
        data: { lastLatitude: lat, lastLongitude: lng, lastSpeed: speed, lastLocationAt: new Date() },
      }),
    ]);
  },
};
