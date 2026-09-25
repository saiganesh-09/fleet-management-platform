import { z } from 'zod';

export const createUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(100),
  phone: z.string().min(7).max(20).optional(),
  role: z.enum(['SUPER_ADMIN', 'FLEET_MANAGER', 'DRIVER', 'VIEWER']),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).default('ACTIVE'),
});

export const updateUserSchema = createUserSchema.partial().omit({ password: true });
