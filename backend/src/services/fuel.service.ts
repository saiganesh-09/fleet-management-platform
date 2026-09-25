import { prisma } from '../config/prisma';
import { fuelRepository } from '../repositories/fuel.repository';
import { vehicleRepository } from '../repositories/vehicle.repository';
import { ApiError } from '../utils/apiError';
import { PageParams } from '../utils/pagination';
import { audit } from '../utils/audit';
import { notificationService } from './notification.service';

export interface FuelEfficiencyResult {
  vehicleId: string;
  vehicleNumber: string;
  avgEfficiency: number | null; // km per liter
  records: number;
  anomaly: boolean;
  recentEfficiency: number | null;
}

/**
 * Computes per-vehicle fuel efficiency (km/L) by diffing consecutive odometer
 * readings against liters consumed between them.
 */
export function computeEfficiency(records: { liters: number; odometer: number | null; fuelDate: Date }[]) {
  const sorted = records.filter((r) => r.odometer != null).sort((a, b) => (a.odometer ?? 0) - (b.odometer ?? 0));
  const segments: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const dist = (sorted[i].odometer ?? 0) - (sorted[i - 1].odometer ?? 0);
    const liters = sorted[i].liters;
    if (dist > 0 && liters > 0) segments.push(dist / liters);
  }
  if (!segments.length) return { avg: null, recent: null };
  const avg = segments.reduce((s, v) => s + v, 0) / segments.length;
  const recent = segments[segments.length - 1];
  return { avg, recent };
}

export const fuelService = {
  async list(params: PageParams, filters: { vehicleId?: string; driverId?: string; from?: Date; to?: Date }) {
    const { items, total } = await fuelRepository.findMany(params, filters);
    return { items, total, page: params.page, limit: params.limit, totalPages: Math.ceil(total / params.limit) };
  },

  async get(id: string) {
    const record = await fuelRepository.findById(id);
    if (!record) throw ApiError.notFound('Fuel record not found', 'FUEL_NOT_FOUND');
    return record;
  },

  async create(input: {
    vehicleId: string; driverId?: string; fuelDate: Date; fuelType: never;
    liters: number; pricePerLiter: number; odometer?: number; station?: string; receiptUrl?: string;
  }, userId: string) {
    const vehicle = await vehicleRepository.findById(input.vehicleId);
    if (!vehicle) throw ApiError.notFound('Vehicle not found', 'VEHICLE_NOT_FOUND');
    if (input.odometer != null && input.odometer < vehicle.currentOdometer * 0.9) {
      throw ApiError.badRequest('Odometer reading is inconsistent with vehicle records', 'ODOMETER_INVALID');
    }

    const totalCost = input.liters * input.pricePerLiter;
    const record = await prisma.$transaction(async (tx) => {
      const created = await tx.fuelRecord.create({
        data: {
          vehicleId: input.vehicleId,
          driverId: input.driverId,
          fuelDate: input.fuelDate,
          fuelType: input.fuelType,
          liters: input.liters,
          pricePerLiter: input.pricePerLiter,
          totalCost,
          odometer: input.odometer,
          station: input.station,
          receiptUrl: input.receiptUrl,
        },
        include: {
          vehicle: { select: { id: true, vehicleNumber: true, fuelType: true } },
          driver: { select: { id: true, name: true, employeeId: true } },
        },
      });
      if (input.odometer != null && input.odometer > vehicle.currentOdometer) {
        await tx.vehicle.update({ where: { id: input.vehicleId }, data: { currentOdometer: input.odometer } });
      }
      return created;
    });

    await audit({ userId, action: 'FUEL_RECORD_CREATED', entity: 'FuelRecord', entityId: record.id, newValue: record });

    // Anomaly check: compare latest segment efficiency to the vehicle's history
    const history = await fuelRepository.forVehicle(input.vehicleId);
    const { avg, recent } = computeEfficiency(history);
    if (avg != null && recent != null && history.length >= 5 && recent < avg * 0.7) {
      await notificationService.notifyManagers({
        title: 'Unusual fuel efficiency detected',
        message: `${vehicle.vehicleNumber}: recent efficiency ${recent.toFixed(1)} km/L vs average ${avg.toFixed(1)} km/L`,
        type: 'ALERT',
      });
    }
    return record;
  },

  async delete(id: string, userId: string) {
    const existing = await fuelRepository.findById(id);
    if (!existing) throw ApiError.notFound('Fuel record not found', 'FUEL_NOT_FOUND');
    await fuelRepository.delete(id);
    await audit({ userId, action: 'FUEL_RECORD_DELETED', entity: 'FuelRecord', entityId: id, oldValue: existing });
  },

  /** Efficiency per vehicle for the analytics/fuel endpoint. */
  async efficiencyReport(): Promise<FuelEfficiencyResult[]> {
    const vehicles = await prisma.vehicle.findMany({
      select: { id: true, vehicleNumber: true },
    });
    const results: FuelEfficiencyResult[] = [];
    for (const v of vehicles) {
      const records = await fuelRepository.forVehicle(v.id);
      const { avg, recent } = computeEfficiency(records);
      results.push({
        vehicleId: v.id,
        vehicleNumber: v.vehicleNumber,
        avgEfficiency: avg,
        recentEfficiency: recent,
        records: records.length,
        anomaly: avg != null && recent != null && records.length >= 5 && recent < avg * 0.7,
      });
    }
    return results;
  },
};
