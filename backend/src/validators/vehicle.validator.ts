import { z } from 'zod';

const vehicleType = z.enum(['TRUCK', 'VAN', 'CAR', 'BUS', 'MINIBUS', 'TRAILER', 'PICKUP', 'OTHER']);
const fuelType = z.enum(['DIESEL', 'PETROL', 'CNG', 'LPG', 'ELECTRIC', 'HYBRID']);
const vehicleStatus = z.enum(['AVAILABLE', 'ASSIGNED', 'ON_TRIP', 'MAINTENANCE', 'INACTIVE']);

export const createVehicleSchema = z.object({
  vehicleNumber: z.string().min(3).max(20),
  registrationNumber: z.string().min(3).max(30),
  vehicleType,
  manufacturer: z.string().min(1).max(60),
  model: z.string().min(1).max(60),
  manufacturingYear: z.number().int().min(1990).max(new Date().getFullYear() + 1),
  fuelType,
  capacity: z.number().positive().optional(),
  currentOdometer: z.number().min(0).default(0),
  purchaseDate: z.coerce.date().optional(),
});

export const updateVehicleSchema = createVehicleSchema.partial().extend({
  status: vehicleStatus.optional(),
});

export const assignDriverSchema = z.object({
  driverId: z.string().uuid().nullable(),
});

export const reportIssueSchema = z.object({
  description: z.string().min(5).max(500),
  severity: z.enum(['LOW', 'NORMAL', 'HIGH']).default('NORMAL'),
});
