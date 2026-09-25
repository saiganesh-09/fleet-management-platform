import { DocumentStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { documentRepository } from '../repositories/misc.repository';
import { ApiError } from '../utils/apiError';
import { PageParams } from '../utils/pagination';
import { audit } from '../utils/audit';
import { daysUntil } from '../utils/generators';
import { DocumentEntityType } from '@prisma/client';

const EXPIRY_WARNING_DAYS = 30;

/** Derives a document's status from its expiry date. */
export function documentStatus(expiryDate: Date | null | undefined): DocumentStatus {
  if (!expiryDate) return 'VALID';
  const days = daysUntil(expiryDate);
  if (days < 0) return 'EXPIRED';
  if (days <= EXPIRY_WARNING_DAYS) return 'EXPIRING_SOON';
  return 'VALID';
}

async function assertEntityExists(entityType: DocumentEntityType, entityId: string) {
  const found =
    entityType === 'VEHICLE'
      ? await prisma.vehicle.findUnique({ where: { id: entityId }, select: { id: true } })
      : await prisma.driver.findUnique({ where: { id: entityId }, select: { id: true } });
  if (!found) throw ApiError.notFound(`${entityType === 'VEHICLE' ? 'Vehicle' : 'Driver'} not found`, 'ENTITY_NOT_FOUND');
}

export const documentService = {
  async list(params: PageParams, filters: { entityType?: DocumentEntityType; entityId?: string; status?: string; expiringInDays?: number }) {
    const { items, total } = await documentRepository.findMany(params, filters);
    const withStatus = items.map((d) => ({ ...d, computedStatus: documentStatus(d.expiryDate) }));
    return { items: withStatus, total, page: params.page, limit: params.limit, totalPages: Math.ceil(total / params.limit) };
  },

  async get(id: string) {
    const doc = await documentRepository.findById(id);
    if (!doc) throw ApiError.notFound('Document not found', 'DOCUMENT_NOT_FOUND');
    return { ...doc, computedStatus: documentStatus(doc.expiryDate) };
  },

  async create(input: {
    entityType: DocumentEntityType; entityId: string; documentType: never;
    documentNumber?: string; issueDate?: Date; expiryDate?: Date; fileUrl?: string;
  }, userId: string) {
    await assertEntityExists(input.entityType, input.entityId);
    if (input.issueDate && input.expiryDate && input.expiryDate <= input.issueDate) {
      throw ApiError.badRequest('Expiry date must be after issue date', 'INVALID_DATES');
    }
    const doc = await documentRepository.create({
      ...input,
      status: documentStatus(input.expiryDate),
    });
    await audit({ userId, action: 'DOCUMENT_CREATED', entity: 'Document', entityId: doc.id, newValue: doc });
    return doc;
  },

  async update(id: string, input: Parameters<typeof documentRepository.update>[1], userId: string) {
    const existing = await documentRepository.findById(id);
    if (!existing) throw ApiError.notFound('Document not found', 'DOCUMENT_NOT_FOUND');
    const expiry = (input.expiryDate as Date | undefined) ?? existing.expiryDate;
    const doc = await documentRepository.update(id, { ...input, status: documentStatus(expiry) });
    await audit({ userId, action: 'DOCUMENT_UPDATED', entity: 'Document', entityId: id, oldValue: existing, newValue: doc });
    return doc;
  },

  async delete(id: string, userId: string) {
    const existing = await documentRepository.findById(id);
    if (!existing) throw ApiError.notFound('Document not found', 'DOCUMENT_NOT_FOUND');
    await documentRepository.delete(id);
    await audit({ userId, action: 'DOCUMENT_DELETED', entity: 'Document', entityId: id, oldValue: existing });
  },

  /** Recompute statuses + return summary (used by alerts job & dashboard). */
  async refreshStatuses() {
    const docs = await prisma.document.findMany({ select: { id: true, expiryDate: true, status: true } });
    const updates = docs
      .map((d) => ({ id: d.id, next: documentStatus(d.expiryDate), current: d.status }))
      .filter((d) => d.next !== d.current);
    for (const u of updates) {
      await prisma.document.update({ where: { id: u.id }, data: { status: u.next } });
    }
    return updates.length;
  },
};
