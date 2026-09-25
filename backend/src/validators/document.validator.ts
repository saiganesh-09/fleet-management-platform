import { z } from 'zod';

export const createDocumentSchema = z.object({
  entityType: z.enum(['VEHICLE', 'DRIVER']),
  entityId: z.string().uuid(),
  documentType: z.enum([
    'REGISTRATION',
    'INSURANCE',
    'PUC',
    'PERMIT',
    'DRIVING_LICENSE',
    'FITNESS_CERTIFICATE',
    'OTHER',
  ]),
  documentNumber: z.string().max(60).optional(),
  issueDate: z.coerce.date().optional(),
  expiryDate: z.coerce.date().optional(),
  fileUrl: z.string().max(500).optional(),
});

export const updateDocumentSchema = createDocumentSchema.partial().omit({ entityType: true, entityId: true });
