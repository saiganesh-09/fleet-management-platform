import { z } from 'zod';

export const createMaintenanceSchema = z.object({
  vehicleId: z.string().uuid(),
  serviceType: z.string().min(2).max(100),
  serviceDate: z.coerce.date(),
  odometer: z.number().min(0).optional(),
  nextServiceOdometer: z.number().min(0).optional(),
  nextServiceDate: z.coerce.date().optional(),
  cost: z.number().min(0).default(0),
  workshop: z.string().max(120).optional(),
  description: z.string().max(1000).optional(),
  status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).default('SCHEDULED'),
});

export const updateMaintenanceSchema = createMaintenanceSchema.partial().omit({ vehicleId: true });
