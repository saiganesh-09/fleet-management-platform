import { z } from 'zod';

export const createFuelSchema = z.object({
  vehicleId: z.string().uuid(),
  driverId: z.string().uuid().optional(),
  fuelDate: z.coerce.date(),
  fuelType: z.enum(['DIESEL', 'PETROL', 'CNG', 'LPG', 'ELECTRIC', 'HYBRID']),
  liters: z.number().positive().max(2000),
  pricePerLiter: z.number().positive().max(1000),
  odometer: z.number().min(0).optional(),
  station: z.string().max(120).optional(),
  receiptUrl: z.string().url().optional(),
});

export const updateFuelSchema = createFuelSchema.partial().omit({ vehicleId: true });
