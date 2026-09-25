import { z } from 'zod';

export const createDriverSchema = z.object({
  employeeId: z.string().min(2).max(20),
  name: z.string().min(2).max(100),
  phone: z.string().min(7).max(20),
  email: z.string().email().toLowerCase().optional(),
  licenseNumber: z.string().min(4).max(30),
  licenseExpiry: z.coerce.date(),
  experienceYears: z.number().int().min(0).max(60).default(0),
  userId: z.string().uuid().optional(),
});

export const updateDriverSchema = createDriverSchema.partial().extend({
  status: z.enum(['AVAILABLE', 'ASSIGNED', 'ON_TRIP', 'ON_LEAVE', 'INACTIVE']).optional(),
});
