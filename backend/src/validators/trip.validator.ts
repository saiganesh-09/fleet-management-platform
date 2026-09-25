import { z } from 'zod';

export const createTripSchema = z.object({
  vehicleId: z.string().uuid(),
  driverId: z.string().uuid(),
  source: z.string().min(2).max(200),
  destination: z.string().min(2).max(200),
  sourceLat: z.number().min(-90).max(90).optional(),
  sourceLng: z.number().min(-180).max(180).optional(),
  destinationLat: z.number().min(-90).max(90).optional(),
  destinationLng: z.number().min(-180).max(180).optional(),
  startTime: z.coerce.date(),
  expectedEndTime: z.coerce.date().optional(),
  distance: z.number().positive().optional(),
  notes: z.string().max(1000).optional(),
});

export const updateTripSchema = createTripSchema.partial();

export const tripStatusSchema = z.object({
  status: z.enum(['STARTED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED', 'DELAYED']),
  odometer: z.number().min(0).optional(),
  notes: z.string().max(1000).optional(),
});
